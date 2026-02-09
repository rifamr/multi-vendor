import "dotenv/config";

import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import jwt from "jsonwebtoken";
import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type { Request } from "express";
import type { Profile } from "passport";
import type { VerifyCallback } from "passport-google-oauth20";
import { ApolloServer } from "@apollo/server";
import { expressMiddleware } from "@as-integrations/express4";

import { typeDefs } from "./schema";
import { resolvers } from "./resolvers";
import {
  isAuthRole,
  loginLocalUser,
  registerLocalUser,
  type AuthRole,
  type SessionUser,
  upsertGoogleUser,
} from "./db/auth";
import { getUserProfile, updateUserName, upsertVendorProfile, getVendorIdByUserId } from "./db/profile";
import { getPool } from "./db/pool";
import {
  getAvailableSlots,
  createBooking,
  getBookingById,
  listBookings,
  updateBookingStatus,
  rescheduleBooking,
  createAvailabilitySlot,
  deleteAvailabilitySlot,
} from "./db/bookings";
import {
  getVendorStats,
  getVendorMonthlyEarnings,
  getVendorRatingDistribution,
  getAdminStats,
  getAdminUserGrowth,
  getAdminBookingsTrend,
  getCustomerStats,
} from "./db/analytics";

const PORT = Number(process.env.PORT ?? 4000);

const AUTH_COOKIE_NAME = "auth_token";

type AuthTokenPayload = {
  user: SessionUser;
};

function getEnvOrThrow(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`Missing env var: ${key}`);
  return value;
}

function getJwtSecret(): string {
  return process.env.JWT_SECRET ?? "dev-only-jwt-secret-change-me";
}

function signAuthToken(user: SessionUser): string {
  return jwt.sign({ user } satisfies AuthTokenPayload, getJwtSecret(), {
    expiresIn: "7d",
  });
}

function readTokenFromRequest(req: Request): string | null {
  const cookieToken = (req as any).cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === "string" && cookieToken.length > 0) return cookieToken;

  const authHeader = req.headers.authorization;
  if (typeof authHeader === "string") {
    const match = authHeader.match(/^Bearer\s+(.+)$/i);
    if (match?.[1]) return match[1];
  }

  return null;
}

function verifyAuthToken(token: string): SessionUser | null {
  try {
    const payload = jwt.verify(token, getJwtSecret()) as any;
    const user = payload?.user as SessionUser | undefined;
    if (!user || typeof user.id !== "number" || typeof user.email !== "string") return null;
    if (!isAuthRole(user.role)) return null;
    if (user.provider !== "local" && user.provider !== "google") return null;
    return user;
  } catch {
    return null;
  }
}

function getAuthUserFromRequest(req: Request): SessionUser | null {
  const token = readTokenFromRequest(req);
  return token ? verifyAuthToken(token) : null;
}

function setAuthCookie(res: express.Response, token: string): void {
  // For local dev we keep `secure:false`. In production behind HTTPS, set `secure:true`.
  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });
}

function clearAuthCookie(res: express.Response): void {
  res.clearCookie(AUTH_COOKIE_NAME, { path: "/" });
}

async function start() {
  const app = express();

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:8080";
  const backendUrl = process.env.BACKEND_URL ?? `http://localhost:${PORT}`;

  app.set("trust proxy", 1);

  app.use(
    cors<cors.CorsRequest>({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json());

  app.use(cookieParser());

  app.use(passport.initialize());

  try {
    const googleClientId = getEnvOrThrow("GOOGLE_CLIENT_ID");
    const googleClientSecret = getEnvOrThrow("GOOGLE_CLIENT_SECRET");

    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL: `${backendUrl}/auth/google/callback`,
          passReqToCallback: true,
        },
        (
          req: Request,
          _accessToken: string,
          _refreshToken: string,
          profile: Profile,
          done: VerifyCallback
        ) => {
          const roleFromState = (req.query.state ?? "customer") as unknown;
          const role: AuthRole = isAuthRole(roleFromState) ? roleFromState : "customer";

          const email = profile.emails?.[0]?.value;

          // Stash minimal info into passport; we'll upsert into DB in the callback route.
          done(null, { email, displayName: profile.displayName, role } as any);
        }
      )
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.warn(
      "OAuth not fully configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.",
      e
    );
  }

  app.get("/health", (_req, res) => res.status(200).send("ok"));

  // ---- OAuth / Session Auth ----
  app.post("/auth/register", async (req, res) => {
    try {
      const { email, password, role, name, vendorProfile } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }
      if (!isAuthRole(role) || role === "admin") {
        res.status(400).json({ error: "Invalid role" });
        return;
      }
      if (password.length < 6) {
        res.status(400).json({ error: "Password must be at least 6 characters" });
        return;
      }

      const user = await registerLocalUser({ email, password, role, name });
      
      // If registering as vendor, always create vendor profile (even if empty)
      if (role === "vendor") {
        try {
          await upsertVendorProfile({
            userId: user.id,
            businessName: vendorProfile?.businessName,
            serviceArea: vendorProfile?.serviceArea,
            experienceYears: vendorProfile?.experienceYears,
            serviceCategoryId: vendorProfile?.serviceCategoryId,
            licenseDocumentUrl: vendorProfile?.licenseDocumentUrl,
            phoneNumber: vendorProfile?.phoneNumber,
            description: vendorProfile?.description,
          });
        } catch (vendorErr: any) {
          // Log error but don't fail registration - they can update profile later
          console.warn("Vendor profile creation failed:", vendorErr.message);
        }
      }

      const token = signAuthToken(user);
      setAuthCookie(res, token);
      res.status(201).json({ ok: true, user });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Registration failed" });
    }
  });

  app.post("/auth/login", async (req, res) => {
    try {
      const { email, password, role } = req.body ?? {};
      if (typeof email !== "string" || typeof password !== "string") {
        res.status(400).json({ error: "Email and password are required" });
        return;
      }
      if (!isAuthRole(role) || role === "admin") {
        res.status(400).json({ error: "Invalid role" });
        return;
      }

      const user = await loginLocalUser({ email, password, role });
      const token = signAuthToken(user);
      setAuthCookie(res, token);
      res.status(200).json({ ok: true, user });
    } catch (err: any) {
      res.status(401).json({ error: err?.message ?? "Login failed" });
    }
  });

  app.get("/auth/google", (req, res, next) => {
    const role = req.query.role;
    if (!isAuthRole(role) || role === "admin") {
      res.status(400).send("Missing or invalid role. Use ?role=customer or ?role=vendor");
      return;
    }
    passport.authenticate("google", {
      scope: ["profile", "email"],
      state: role,
      session: false,
    })(req, res, next);
  });

  app.get(
    "/auth/google/callback",
    passport.authenticate("google", {
      failureRedirect: `${frontendUrl}/login?oauth=failed`,
      session: false,
    }),
    async (req, res) => {
      try {
        const passportUser = req.user as any;
        const role: AuthRole = isAuthRole(passportUser?.role) ? passportUser.role : "customer";
        const email = passportUser?.email as string | undefined;
        const displayName = passportUser?.displayName as string | undefined;
        if (!email) {
          res.redirect(`${frontendUrl}/login?oauth=missing_email`);
          return;
        }

        const dbUser = await upsertGoogleUser({ email, role, displayName });
        const token = signAuthToken(dbUser);
        setAuthCookie(res, token);

        const redirectPath = role === "vendor" ? "/vendor/dashboard" : "/customer/services";
        res.redirect(`${frontendUrl}${redirectPath}`);
      } catch {
        res.redirect(`${frontendUrl}/login?oauth=failed`);
      }
    }
  );

  app.get("/auth/me", (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ authenticated: false });
      return;
    }
    res.json({ authenticated: true, user });
  });

  // ---- Profile (JWT protected) ----
  app.get("/auth/profile", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const profile = await getUserProfile(user.id);
      res.status(200).json({ ok: true, profile });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch profile" });
    }
  });

  app.patch("/auth/profile", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const body = req.body ?? {};
    const hasName = Object.prototype.hasOwnProperty.call(body, "name");
    const name = hasName && typeof body.name === "string" ? body.name : undefined;

    try {
      const updatedUser = name === undefined ? (await getUserProfile(user.id)).user : await updateUserName(user.id, name);

      let vendorProfile: any = null;
      if (updatedUser.role === "vendor") {
        const businessName = typeof body.businessName === "string" ? body.businessName : undefined;
        const serviceArea = typeof body.serviceArea === "string" ? body.serviceArea : undefined;
        const experienceYearsRaw = body.experienceYears;
        const experienceYears =
          typeof experienceYearsRaw === "number"
            ? experienceYearsRaw
            : typeof experienceYearsRaw === "string" && experienceYearsRaw.trim()
              ? Number(experienceYearsRaw)
              : undefined;
        const serviceCategoryId = typeof body.serviceCategoryId === "number" ? body.serviceCategoryId : undefined;
        const licenseDocumentUrl = typeof body.licenseDocumentUrl === "string" ? body.licenseDocumentUrl : undefined;
        const phoneNumber = typeof body.phoneNumber === "string" ? body.phoneNumber : undefined;
        const description = typeof body.description === "string" ? body.description : undefined;

        vendorProfile = await upsertVendorProfile({
          userId: updatedUser.id,
          businessName,
          serviceArea,
          experienceYears: typeof experienceYears === "number" && Number.isFinite(experienceYears) ? experienceYears : null,
          serviceCategoryId,
          licenseDocumentUrl,
          phoneNumber,
          description,
        });
      }

      // Re-issue token so `/auth/me` reflects updated name.
      const token = signAuthToken(updatedUser);
      setAuthCookie(res, token);

      res.status(200).json({ ok: true, user: updatedUser, vendor: vendorProfile });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to update profile" });
    }
  });

  app.post("/auth/logout", (req, res) => {
    clearAuthCookie(res);
    res.status(200).json({ ok: true });
  });

  // ---- Availability Slots API (JWT protected) ----
  // Get available slots (optional filters: vendorId, serviceId, fromDate)
  app.get("/api/availability", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    
    try {
      let vendorId = req.query.vendorId ? Number(req.query.vendorId) : undefined;
      let includeBooked = false;
      
      // If user is a vendor and no vendorId specified, use their vendor ID and include booked slots
      if (user && user.role === "vendor" && !vendorId) {
        vendorId = await getVendorIdByUserId(user.id);
        includeBooked = true; // Vendors see all their slots (booked and available)
        console.log("[GET /api/availability] User ID:", user.id, "Vendor ID:", vendorId, "Include Booked:", includeBooked);
      }
      
      const serviceId = req.query.serviceId ? Number(req.query.serviceId) : undefined;
      const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;

      const slots = await getAvailableSlots({ vendorId, serviceId, fromDate, includeBooked });
      console.log("[GET /api/availability] Slots returned:", slots.length);
      res.status(200).json({ ok: true, slots });
    } catch (err: any) {
      console.error("[GET /api/availability] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to fetch availability" });
    }
  });

  // Create availability slot (vendors only)
  app.post("/api/availability", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "vendor") {
      res.status(403).json({ error: "Forbidden: vendors only" });
      return;
    }

    const { slotDate, startTime, endTime } = req.body ?? {};

    if (!slotDate || !startTime || !endTime) {
      res.status(400).json({ error: "Missing required fields: slotDate, startTime, endTime" });
      return;
    }

    try {
      // Get the vendor ID from the user ID
      const vendorId = await getVendorIdByUserId(user.id);
      console.log("[POST /api/availability] User ID:", user.id, "Vendor ID:", vendorId, "Date:", slotDate, "Time:", startTime, "-", endTime);
      
      const slot = await createAvailabilitySlot({
        vendorId,
        slotDate,
        startTime,
        endTime,
      });
      console.log("[POST /api/availability] Slot created:", slot);
      res.status(201).json({ ok: true, slot });
    } catch (err: any) {
      console.error("[POST /api/availability] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to create availability slot" });
    }
  });

  // Delete availability slot (vendors only)
  app.delete("/api/availability/:slotId", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "vendor") {
      res.status(403).json({ error: "Forbidden: vendors only" });
      return;
    }

    const slotId = Number(req.params.slotId);
    if (isNaN(slotId)) {
      res.status(400).json({ error: "Invalid slot ID" });
      return;
    }

    try {
      // Get the vendor ID from the user ID
      const vendorId = await getVendorIdByUserId(user.id);
      
      await deleteAvailabilitySlot({ slotId, vendorId });
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to delete slot" });
    }
  });

  // ---- Bookings API (JWT protected) ----
  // List bookings (with filters)
  app.get("/api/bookings", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    try {
      const status = typeof req.query.status === "string" ? req.query.status : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const filters: any = { limit };
      if (status) filters.status = status;

      // Customer sees their bookings, vendor sees bookings for their services
      if (user.role === "customer") {
        filters.customerId = user.id;
      } else if (user.role === "vendor") {
        filters.vendorId = user.id;
      }

      const bookings = await listBookings(filters);
      res.status(200).json({ ok: true, bookings });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch bookings" });
    }
  });

  // Get single booking by ID
  app.get("/api/bookings/:bookingId", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const bookingId = Number(req.params.bookingId);
    if (isNaN(bookingId)) {
      res.status(400).json({ error: "Invalid booking ID" });
      return;
    }

    try {
      const booking = await getBookingById(bookingId);
      if (!booking) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      // Check if user has permission to view this booking
      if (user.role === "customer" && booking.customerId !== user.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      if (user.role === "vendor" && booking.vendorId !== user.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      res.status(200).json({ ok: true, booking });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch booking" });
    }
  });

  // Create booking (customers only)
  app.post("/api/bookings", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "customer") {
      res.status(403).json({ error: "Forbidden: customers only" });
      return;
    }

    const { serviceId, slotId } = req.body ?? {};

    if (!serviceId || !slotId) {
      res.status(400).json({ error: "Missing required fields: serviceId, slotId" });
      return;
    }

    try {
      const booking = await createBooking({
        customerId: user.id,
        serviceId: Number(serviceId),
        slotId: Number(slotId),
      });
      res.status(201).json({ ok: true, booking });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to create booking" });
    }
  });

  // Update booking status
  app.patch("/api/bookings/:bookingId/status", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const bookingId = Number(req.params.bookingId);
    if (isNaN(bookingId)) {
      res.status(400).json({ error: "Invalid booking ID" });
      return;
    }

    const { status } = req.body ?? {};
    if (!status || typeof status !== "string") {
      res.status(400).json({ error: "Missing or invalid status" });
      return;
    }

    try {
      const booking = await updateBookingStatus({
        bookingId,
        status: status as any,
        userId: user.id,
        userRole: user.role,
      });
      res.status(200).json({ ok: true, booking });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to update booking status" });
    }
  });

  // Reschedule booking
  app.post("/api/bookings/:bookingId/reschedule", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "customer") {
      res.status(403).json({ error: "Forbidden: customers only" });
      return;
    }

    const bookingId = Number(req.params.bookingId);
    if (isNaN(bookingId)) {
      res.status(400).json({ error: "Invalid booking ID" });
      return;
    }

    const { newSlotId } = req.body ?? {};
    if (!newSlotId) {
      res.status(400).json({ error: "Missing required field: newSlotId" });
      return;
    }

    try {
      const booking = await rescheduleBooking({
        bookingId,
        newSlotId: Number(newSlotId),
        userId: user.id,
      });
      res.status(200).json({ ok: true, booking });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to reschedule booking" });
    }
  });

  // ---- Analytics API (JWT protected) ----
  // Vendor Services Management
  app.get("/api/vendor/services", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "vendor") {
      res.status(403).json({ error: "Forbidden: vendors only" });
      return;
    }

    try {
      const vendorId = await getVendorIdByUserId(user.id);
      const pool = getPool();
      
      const result = await pool.query(
        `SELECT 
          s.id, 
          s.title, 
          s.description, 
          s.price, 
          s.duration_minutes, 
          s.is_active,
          s.category_id,
          sc.name as category_name
         FROM services s
         JOIN service_categories sc ON sc.id = s.category_id
         WHERE s.vendor_id = $1
         ORDER BY s.created_at DESC`,
        [vendorId]
      );

      res.status(200).json({ ok: true, services: result.rows });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch services" });
    }
  });

  app.post("/api/vendor/services", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "vendor") {
      res.status(403).json({ error: "Forbidden: vendors only" });
      return;
    }

    const { title, description, price, durationMinutes, categoryId } = req.body ?? {};

    if (!title || !categoryId) {
      res.status(400).json({ error: "Missing required fields: title, categoryId" });
      return;
    }

    try {
      const vendorId = await getVendorIdByUserId(user.id);
      const pool = getPool();
      
      const result = await pool.query(
        `INSERT INTO services (vendor_id, category_id, title, description, price, duration_minutes, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id, title, description, price, duration_minutes, is_active, category_id`,
        [vendorId, categoryId, title, description || null, price || null, durationMinutes || null]
      );

      res.status(201).json({ ok: true, service: result.rows[0] });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to create service" });
    }
  });

  app.patch("/api/vendor/services/:serviceId", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "vendor") {
      res.status(403).json({ error: "Forbidden: vendors only" });
      return;
    }

    const serviceId = Number(req.params.serviceId);
    if (isNaN(serviceId)) {
      res.status(400).json({ error: "Invalid service ID" });
      return;
    }

    const { title, description, price, durationMinutes, categoryId, isActive } = req.body ?? {};

    try {
      const vendorId = await getVendorIdByUserId(user.id);
      const pool = getPool();
      
      // Verify service belongs to this vendor
      const checkResult = await pool.query(
        `SELECT vendor_id FROM services WHERE id = $1`,
        [serviceId]
      );

      if (checkResult.rows.length === 0) {
        res.status(404).json({ error: "Service not found" });
        return;
      }

      if (checkResult.rows[0].vendor_id !== vendorId) {
        res.status(403).json({ error: "Forbidden: not your service" });
        return;
      }

      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        values.push(title);
      }
      if (description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(description);
      }
      if (price !== undefined) {
        updates.push(`price = $${paramCount++}`);
        values.push(price);
      }
      if (durationMinutes !== undefined) {
        updates.push(`duration_minutes = $${paramCount++}`);
        values.push(durationMinutes);
      }
      if (categoryId !== undefined) {
        updates.push(`category_id = $${paramCount++}`);
        values.push(categoryId);
      }
      if (isActive !== undefined) {
        updates.push(`is_active = $${paramCount++}`);
        values.push(isActive);
      }

      if (updates.length === 0) {
        res.status(400).json({ error: "No fields to update" });
        return;
      }

      values.push(serviceId);
      const result = await pool.query(
        `UPDATE services 
         SET ${updates.join(", ")}
         WHERE id = $${paramCount}
         RETURNING id, title, description, price, duration_minutes, is_active, category_id`,
        values
      );

      res.status(200).json({ ok: true, service: result.rows[0] });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to update service" });
    }
  });

  app.delete("/api/vendor/services/:serviceId", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "vendor") {
      res.status(403).json({ error: "Forbidden: vendors only" });
      return;
    }

    const serviceId = Number(req.params.serviceId);
    if (isNaN(serviceId)) {
      res.status(400).json({ error: "Invalid service ID" });
      return;
    }

    try {
      const vendorId = await getVendorIdByUserId(user.id);
      const pool = getPool();
      
      // Verify service belongs to this vendor
      const checkResult = await pool.query(
        `SELECT vendor_id FROM services WHERE id = $1`,
        [serviceId]
      );

      if (checkResult.rows.length === 0) {
        res.status(404).json({ error: "Service not found" });
        return;
      }

      if (checkResult.rows[0].vendor_id !== vendorId) {
        res.status(403).json({ error: "Forbidden: not your service" });
        return;
      }

      await pool.query(`DELETE FROM services WHERE id = $1`, [serviceId]);

      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to delete service" });
    }
  });

  // Vendor analytics
  app.get("/api/analytics/vendor", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "vendor") {
      res.status(403).json({ error: "Forbidden: vendors only" });
      return;
    }

    try {
      const stats = await getVendorStats(user.id);
      const monthlyEarnings = await getVendorMonthlyEarnings(user.id, 6);
      const ratingDistribution = await getVendorRatingDistribution(user.id);

      res.status(200).json({
        ok: true,
        stats,
        monthlyEarnings,
        ratingDistribution,
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch analytics" });
    }
  });

  // Admin analytics
  app.get("/api/analytics/admin", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admins only" });
      return;
    }

    try {
      const stats = await getAdminStats();
      const userGrowth = await getAdminUserGrowth(6);
      const bookingsTrend = await getAdminBookingsTrend(6);

      res.status(200).json({
        ok: true,
        stats,
        userGrowth,
        bookingsTrend,
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch analytics" });
    }
  });

  // Customer analytics
  app.get("/api/analytics/customer", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "customer") {
      res.status(403).json({ error: "Forbidden: customers only" });
      return;
    }

    try {
      const stats = await getCustomerStats(user.id);

      res.status(200).json({
        ok: true,
        stats,
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch analytics" });
    }
  });

  // ---- GraphQL ----
  const apollo = new ApolloServer({
    typeDefs,
    resolvers: resolvers as any,
  });

  await apollo.start();

  app.use(
    "/graphql",
    expressMiddleware(apollo)
  );

  app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`GraphQL server running at http://localhost:${PORT}/graphql`);
  });
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
