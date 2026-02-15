import { getPool } from "./pool";

import type { AuthRole, SessionUser } from "./auth";

export type VendorProfile = {
  businessName: string | null;
  serviceArea: string | null;
  experienceYears: number | null;
  isVerified: boolean | null;
  serviceCategoryId: number | null;
  licenseDocumentUrl: string | null;
  phoneNumber: string | null;
  description: string | null;
};

export type UserProfile = {
  user: SessionUser;
  vendor: VendorProfile | null;
};

export async function getUserProfile(userId: number): Promise<UserProfile> {
  const pool = getPool();

  const userRes = await pool.query<{
    id: number;
    email: string;
    role: AuthRole;
    name: string | null;
    auth_provider: string | null;
    phone: string | null;
  }>(
    `SELECT id, email, role, name, auth_provider, phone
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  const row = userRes.rows[0];
  if (!row) throw new Error("User not found");

  const user: SessionUser = {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    phone: row.phone,
    provider: row.auth_provider === "google" ? "google" : "local",
  };

  if (user.role !== "vendor") {
    return { user, vendor: null };
  }

  const vendorRes = await pool.query<{
    business_name: string | null;
    service_area: string | null;
    experience_years: number | null;
    is_verified: boolean | null;
    service_category_id: number | null;
    license_document_url: string | null;
    phone_number: string | null;
    description: string | null;
  }>(
    `SELECT business_name, service_area, experience_years, is_verified,
            service_category_id, license_document_url, phone_number, description
     FROM vendors
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  const vendorRow = vendorRes.rows[0];
  const vendor: VendorProfile | null = vendorRow
    ? {
        businessName: vendorRow.business_name,
        serviceArea: vendorRow.service_area,
        experienceYears: vendorRow.experience_years,
        isVerified: vendorRow.is_verified,
        serviceCategoryId: vendorRow.service_category_id,
        licenseDocumentUrl: vendorRow.license_document_url,
        phoneNumber: vendorRow.phone_number,
        description: vendorRow.description,
      }
    : null;

  return { user, vendor };
}

export async function getVendorIdByUserId(userId: number): Promise<number> {
  const pool = getPool();

  const res = await pool.query<{ id: number }>(
    `SELECT id FROM vendors WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  const row = res.rows[0];
  if (!row) {
    // If vendor profile doesn't exist, create it
    const insertRes = await pool.query<{ id: number }>(
      `INSERT INTO vendors (user_id, business_name, service_area, experience_years, is_verified, 
                           service_category_id, license_document_url, phone_number, description)
       VALUES ($1, NULL, NULL, NULL, false, NULL, NULL, NULL, NULL)
       RETURNING id`,
      [userId]
    );
    
    const newRow = insertRes.rows[0];
    if (!newRow) throw new Error("Failed to create vendor profile");
    
    return newRow.id;
  }

  return row.id;
}

export async function updateUserProfile(userId: number, name: string | null, phone?: string | null): Promise<SessionUser> {
  const pool = getPool();

  const nextName = name?.trim() ? name.trim() : null;
  const nextPhone = phone !== undefined ? (phone?.trim() ? phone.trim() : null) : undefined;

  let sql: string;
  let params: any[];

  if (nextPhone !== undefined) {
    sql = `UPDATE users
     SET name = $1, phone = $2
     WHERE id = $3
     RETURNING id, email, role, name, auth_provider, phone`;
    params = [nextName, nextPhone, userId];
  } else {
    sql = `UPDATE users
     SET name = $1
     WHERE id = $2
     RETURNING id, email, role, name, auth_provider, phone`;
    params = [nextName, userId];
  }

  const res = await pool.query<{
    id: number;
    email: string;
    role: AuthRole;
    name: string | null;
    auth_provider: string | null;
    phone: string | null;
  }>(sql, params);

  const row = res.rows[0];
  if (!row) throw new Error("User not found");

  return {
    id: row.id,
    email: row.email,
    role: row.role,
    name: row.name,
    provider: row.auth_provider === "google" ? "google" : "local",
    phone: row.phone,
  };
}

export async function upsertVendorProfile(params: {
  userId: number;
  businessName?: string | null;
  serviceArea?: string | null;
  experienceYears?: number | null;
  serviceCategoryId?: number | null;
  licenseDocumentUrl?: string | null;
  phoneNumber?: string | null;
  description?: string | null;
}): Promise<VendorProfile> {
  const pool = getPool();

  const businessName = params.businessName?.trim() ? params.businessName.trim() : null;
  const serviceArea = params.serviceArea?.trim() ? params.serviceArea.trim() : null;
  const experienceYears =
    typeof params.experienceYears === "number" && Number.isFinite(params.experienceYears)
      ? Math.trunc(params.experienceYears)
      : null;
  const serviceCategoryId =
    typeof params.serviceCategoryId === "number" && params.serviceCategoryId > 0
      ? params.serviceCategoryId
      : null;
  const licenseDocumentUrl = params.licenseDocumentUrl?.trim() ? params.licenseDocumentUrl.trim() : null;
  const phoneNumber = params.phoneNumber?.trim() ? params.phoneNumber.trim() : null;
  const description = params.description?.trim() ? params.description.trim() : null;

  // Ensure vendor row exists.
  await pool.query(
    `INSERT INTO vendors (user_id, business_name, service_area, experience_years, is_verified,
                          service_category_id, license_document_url, phone_number, description)
     VALUES ($1, $2, $3, $4, false, $5, $6, $7, $8)
     ON CONFLICT (user_id)
     DO UPDATE SET
       business_name = COALESCE(EXCLUDED.business_name, vendors.business_name),
       service_area = COALESCE(EXCLUDED.service_area, vendors.service_area),
       experience_years = COALESCE(EXCLUDED.experience_years, vendors.experience_years),
       service_category_id = COALESCE(EXCLUDED.service_category_id, vendors.service_category_id),
       license_document_url = COALESCE(EXCLUDED.license_document_url, vendors.license_document_url),
       phone_number = COALESCE(EXCLUDED.phone_number, vendors.phone_number),
       description = COALESCE(EXCLUDED.description, vendors.description)
     `,
    [params.userId, businessName, serviceArea, experienceYears, serviceCategoryId, 
     licenseDocumentUrl, phoneNumber, description]
  );

  const vendorRes = await pool.query<{
    business_name: string | null;
    service_area: string | null;
    experience_years: number | null;
    is_verified: boolean | null;
    service_category_id: number | null;
    license_document_url: string | null;
    phone_number: string | null;
    description: string | null;
  }>(
    `SELECT business_name, service_area, experience_years, is_verified,
            service_category_id, license_document_url, phone_number, description
     FROM vendors
     WHERE user_id = $1
     LIMIT 1`,
    [params.userId]
  );

  const vendorRow = vendorRes.rows[0];
  if (!vendorRow) throw new Error("Vendor profile not found");

  return {
    businessName: vendorRow.business_name,
    serviceArea: vendorRow.service_area,
    experienceYears: vendorRow.experience_years,
    isVerified: vendorRow.is_verified,
    serviceCategoryId: vendorRow.service_category_id,
    licenseDocumentUrl: vendorRow.license_document_url,
    phoneNumber: vendorRow.phone_number,
    description: vendorRow.description,
  };
}
