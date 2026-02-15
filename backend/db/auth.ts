import bcrypt from "bcryptjs";

import { getPool } from "./pool";

export type AuthRole = "customer" | "vendor" | "admin";

export type SessionUser = {
  id: number;
  email: string;
  role: AuthRole;
  name: string | null;
  phone?: string | null;
  provider: "local" | "google";
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isAuthRole(role: unknown): role is AuthRole {
  return role === "customer" || role === "vendor" || role === "admin";
}

export async function registerLocalUser(params: {
  email: string;
  password: string;
  role: AuthRole;
  name?: string | null;
}): Promise<SessionUser> {
  const pool = getPool();

  const email = normalizeEmail(params.email);
  const passwordHash = await bcrypt.hash(params.password, 10);
  const name = params.name?.trim() ? params.name.trim() : null;

  // Enforce: email can repeat across roles, but not within same role.
  const existing = await pool.query<{ id: number }>(
    "SELECT id FROM users WHERE lower(email) = lower($1) AND role = $2 LIMIT 1",
    [email, params.role]
  );
  if (existing.rows.length > 0) {
    throw new Error("This email is already registered for this role.");
  }

  const inserted = await pool.query<{ id: number; email: string; role: AuthRole; name: string | null }>(
    `INSERT INTO users (name, email, role, auth_provider, password_hash)
     VALUES ($1, $2, $3, 'local', $4)
     RETURNING id, email, role, name`,
    [name, email, params.role, passwordHash]
  );

  const user = inserted.rows[0];
  if (!user) throw new Error("Failed to create user");

  if (user.role === "vendor") {
    // Create vendor profile if missing.
    await pool.query(
      `INSERT INTO vendors (user_id, business_name, service_area, experience_years, is_verified)
       VALUES ($1, $2, NULL, NULL, false)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, user.name ?? ""]
    );
  }

  return { id: user.id, email: user.email, role: user.role, name: user.name, provider: "local" };
}

export async function loginLocalUser(params: {
  email: string;
  password: string;
  role: AuthRole;
}): Promise<SessionUser> {
  const pool = getPool();
  const email = normalizeEmail(params.email);

  const result = await pool.query<{
    id: number;
    email: string;
    role: AuthRole;
    name: string | null;
    auth_provider: string | null;
    password_hash: string | null;
  }>(
    `SELECT id, email, role, name, auth_provider, password_hash
     FROM users
     WHERE lower(email) = lower($1) AND role = $2
     LIMIT 1`,
    [email, params.role]
  );

  const row = result.rows[0];
  if (!row) throw new Error("No account found for this email + role. Please sign up.");

  if (!row.password_hash) {
    throw new Error("This account does not have a password. Use Google sign-in.");
  }

  const ok = await bcrypt.compare(params.password, row.password_hash);
  if (!ok) throw new Error("Incorrect password.");

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    provider: row.auth_provider === "google" ? "google" : "local",
  };
}

export async function upsertGoogleUser(params: {
  email: string;
  role: AuthRole;
  displayName?: string | null;
}): Promise<SessionUser> {
  const pool = getPool();
  const email = normalizeEmail(params.email);
  const name = params.displayName?.trim() ? params.displayName.trim() : null;

  const existing = await pool.query<{ id: number; email: string; role: AuthRole; name: string | null }>(
    `SELECT id, email, role, name
     FROM users
     WHERE lower(email) = lower($1) AND role = $2
     LIMIT 1`,
    [email, params.role]
  );

  let user: { id: number; email: string; role: AuthRole; name: string | null };

  if (existing.rows[0]) {
    const updated = await pool.query<typeof user>(
      `UPDATE users
       SET auth_provider = 'google', name = COALESCE(name, $1)
       WHERE id = $2
       RETURNING id, email, role, name`,
      [name, existing.rows[0].id]
    );
    user = updated.rows[0] ?? existing.rows[0];
  } else {
    const inserted = await pool.query<typeof user>(
      `INSERT INTO users (name, email, role, auth_provider)
       VALUES ($1, $2, $3, 'google')
       RETURNING id, email, role, name`,
      [name, email, params.role]
    );
    user = inserted.rows[0];
  }

  if (!user) throw new Error("Failed to create/find Google user");

  if (user.role === "vendor") {
    await pool.query(
      `INSERT INTO vendors (user_id, business_name, service_area, experience_years, is_verified)
       VALUES ($1, $2, NULL, NULL, false)
       ON CONFLICT (user_id) DO NOTHING`,
      [user.id, user.name ?? ""]
    );
  }

  return { id: user.id, email: user.email, role: user.role, name: user.name, provider: "google" };
}
