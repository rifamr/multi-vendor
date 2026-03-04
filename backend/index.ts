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
import { getUserProfile, updateUserProfile, upsertVendorProfile, getVendorIdByUserId } from "./db/profile";
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
  getVendorTransactions,
  getVendorPendingPayout,
  getVendorMostBookedServices,
  getAdminStats,
  getAdminUserGrowth,
  getAdminBookingsTrend,
  getCustomerStats,
} from "./db/analytics";
import {
  getNotifications,
  getUnreadCount,
  markAsRead,
  markAllAsRead,
  createNotification,
  notifyVendorForBooking,
  notifyCustomerForBooking,
} from "./db/notifications";
import {
  chatGetCustomerBookingSummary,
  chatGetCustomerRecentBookings,
  chatGetVendorBookingSummary,
  chatGetVendorRecentBookings,
  chatGetVendorEarnings,
  chatGetVendorServiceCount,
  chatSearchServices,
  chatGetAdminStats,
} from "./db/chatbot";
import { Groq } from "groq-sdk";
import { retrieveRAGContext } from "./db/rag";

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

  // Initialize Groq client for RAG chatbot
  const groq = new Groq({
    apiKey: process.env.GROQ_API_KEY,
  });

  const frontendUrl = process.env.FRONTEND_URL ?? "http://localhost:8080";
  const backendUrl = process.env.BACKEND_URL ?? `http://localhost:${PORT}`;

  app.set("trust proxy", 1);

  app.use(
    cors<cors.CorsRequest>({
      origin: true,
      credentials: true,
    })
  );

  app.use(express.json({ limit: '10mb' }));

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


  // --- Chatbot Route ---
  // Import chatbot router
  try {
    // Use dynamic import for ESModule default export
    const { default: chatbotRouter } = await import("../routes/chatbot.js");
    app.use("/api/chatbot", chatbotRouter);
  } catch (err) {
    console.error("Failed to load chatbot route:", err);
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
        console.log("[POST /auth/register] Creating vendor profile with data:", vendorProfile);
        try {
          const createdVendorProfile = await upsertVendorProfile({
            userId: user.id,
            businessName: vendorProfile?.businessName,
            state: vendorProfile?.state,
            district: vendorProfile?.district,
            city: vendorProfile?.city,
            address: vendorProfile?.address,
            experienceYears: vendorProfile?.experienceYears,
            serviceCategoryId: vendorProfile?.serviceCategoryId,
            licenseDocumentUrl: vendorProfile?.licenseDocumentUrl,
            phoneNumber: vendorProfile?.phoneNumber,
            description: vendorProfile?.description,
          });
          console.log("[POST /auth/register] Vendor profile created:", createdVendorProfile);
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
      if (!isAuthRole(role)) {
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

        // For vendors, redirect to profile page to complete setup
        // For customers, redirect to services
        const redirectPath = role === "vendor" ? "/vendor/profile?setup=true" : "/customer/services";
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
      console.log("[GET /auth/profile] User ID:", user.id, "Vendor profile:", profile.vendor);
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
    const phone = typeof body.phone === "string" ? body.phone : undefined;

    try {
      const updatedUser = (name === undefined && phone === undefined)
        ? (await getUserProfile(user.id)).user
        : await updateUserProfile(user.id, name ?? (await getUserProfile(user.id)).user.name ?? null, phone);

      let vendorProfile: any = null;
      if (updatedUser.role === "vendor") {
        const businessName = typeof body.businessName === "string" ? body.businessName : undefined;
        const state = typeof body.state === "string" ? body.state : undefined;
        const district = typeof body.district === "string" ? body.district : undefined;
        const city = typeof body.city === "string" ? body.city : undefined;
        const address = typeof body.address === "string" ? body.address : undefined;
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
        const shopImageUrl = typeof body.shopImageUrl === "string" ? body.shopImageUrl : undefined;

        vendorProfile = await upsertVendorProfile({
          userId: updatedUser.id,
          businessName,
          state,
          district,
          city,
          address,
          experienceYears: typeof experienceYears === "number" && Number.isFinite(experienceYears) ? experienceYears : null,
          serviceCategoryId,
          licenseDocumentUrl,
          phoneNumber,
          description,
          shopImageUrl,
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
      let includeBooked = req.query.includeBooked === "true";

      // If user is a vendor and no vendorId specified, use their vendor ID and include booked slots
      if (user && user.role === "vendor" && !vendorId) {
        vendorId = await getVendorIdByUserId(user.id);
        includeBooked = true; // Vendors see all their slots (booked and available)
        console.log("[GET /api/availability] User ID:", user.id, "Vendor ID:", vendorId, "Include Booked:", includeBooked);
      }

      const serviceId = req.query.serviceId ? Number(req.query.serviceId) : undefined;
      const fromDate = typeof req.query.fromDate === "string" ? req.query.fromDate : undefined;

      // When filtering by serviceId, also resolve the vendor so we include their generic slots
      if (serviceId && !vendorId) {
        const svcPool = getPool();
        const svcRes = await svcPool.query<{ vendor_id: number }>(
          'SELECT vendor_id FROM services WHERE id = $1', [serviceId]
        );
        if (svcRes.rows[0]) {
          vendorId = svcRes.rows[0].vendor_id;
        }
      }

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

    const { serviceId, slotDate, startTime, endTime } = req.body ?? {};

    if (!slotDate || !startTime || !endTime) {
      res.status(400).json({ error: "Missing required fields: slotDate, startTime, endTime" });
      return;
    }

    try {
      // Get the vendor ID from the user ID
      const vendorId = await getVendorIdByUserId(user.id);
      console.log("[POST /api/availability] User ID:", user.id, "Vendor ID:", vendorId, "Service ID:", serviceId, "Date:", slotDate, "Time:", startTime, "-", endTime);

      const slot = await createAvailabilitySlot({
        vendorId,
        serviceId: serviceId ? Number(serviceId) : undefined,
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

  // Generate dynamic time slots based on service duration (vendors only)
  app.post("/api/availability/generate", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "vendor") {
      res.status(403).json({ error: "Forbidden: vendors only" });
      return;
    }

    const { serviceId, startDate, endDate, workingStartTime, workingEndTime } = req.body ?? {};

    if (!serviceId || !startDate || !endDate || !workingStartTime || !workingEndTime) {
      res.status(400).json({ error: "Missing required fields: serviceId, startDate, endDate, workingStartTime, workingEndTime" });
      return;
    }

    try {
      const vendorId = await getVendorIdByUserId(user.id);
      const pool = getPool();

      // Get service duration
      const serviceResult = await pool.query(
        `SELECT duration_minutes, vendor_id FROM services WHERE id = $1`,
        [serviceId]
      );

      if (serviceResult.rows.length === 0) {
        res.status(404).json({ error: "Service not found" });
        return;
      }

      const service = serviceResult.rows[0];
      if (service.vendor_id !== vendorId) {
        res.status(403).json({ error: "You can only generate slots for your own services" });
        return;
      }

      const durationMinutes = service.duration_minutes || 60;
      const breakMinutes = 10;

      // Generate slots for each date in the range
      const start = new Date(startDate);
      const end = new Date(endDate);
      const generatedSlots: any[] = [];

      for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
        const dateStr = date.toISOString().split('T')[0];

        // Parse working hours (format: "HH:MM")
        const [workStartHour, workStartMin] = workingStartTime.split(':').map(Number);
        const [workEndHour, workEndMin] = workingEndTime.split(':').map(Number);

        let currentHour = workStartHour;
        let currentMin = workStartMin;

        while (true) {
          // Calculate end time for this slot
          let endHour = currentHour;
          let endMin = currentMin + durationMinutes;

          // Handle minute overflow
          if (endMin >= 60) {
            endHour += Math.floor(endMin / 60);
            endMin = endMin % 60;
          }

          // Check if slot end exceeds working hours
          const endTimeMinutes = endHour * 60 + endMin;
          const workEndMinutes = workEndHour * 60 + workEndMin;

          if (endTimeMinutes > workEndMinutes) {
            break; // End of working day
          }

          // Format times
          const startTime = `${String(currentHour).padStart(2, '0')}:${String(currentMin).padStart(2, '0')}:00`;
          const endTime = `${String(endHour).padStart(2, '0')}:${String(endMin).padStart(2, '0')}:00`;

          // Check if slot already exists
          const existingSlot = await pool.query(
            `SELECT id FROM availability_slots 
             WHERE vendor_id = $1 AND slot_date = $2 AND start_time = $3`,
            [vendorId, dateStr, startTime]
          );

          if (existingSlot.rows.length === 0) {
            // Create slot with service_id
            const slotResult = await pool.query(
              `INSERT INTO availability_slots (vendor_id, service_id, slot_date, start_time, end_time, is_available)
               VALUES ($1, $2, $3, $4, $5, true)
               RETURNING id, vendor_id, service_id, slot_date::text, start_time::text, end_time::text, is_available`,
              [vendorId, serviceId, dateStr, startTime, endTime]
            );
            generatedSlots.push(slotResult.rows[0]);
          }

          // Move to next slot (service duration + break)
          currentMin += durationMinutes + breakMinutes;
          while (currentMin >= 60) {
            currentHour++;
            currentMin -= 60;
          }
        }
      }

      res.status(200).json({
        ok: true,
        slotsGenerated: generatedSlots.length,
        slots: generatedSlots,
        message: `Generated ${generatedSlots.length} time slots based on service duration (${durationMinutes} mins + ${breakMinutes} mins break)`
      });
    } catch (err: any) {
      console.error("[POST /api/availability/generate] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to generate slots" });
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

    const { serviceId, slotId, paymentMethod, paymentStatus } = req.body ?? {};

    if (!serviceId || !slotId) {
      res.status(400).json({ error: "Missing required fields: serviceId, slotId" });
      return;
    }

    try {
      const pool = getPool();

      // Get service price
      const serviceResult = await pool.query(
        `SELECT price FROM services WHERE id = $1`,
        [serviceId]
      );

      if (serviceResult.rows.length === 0) {
        res.status(404).json({ error: "Service not found" });
        return;
      }

      const amount = serviceResult.rows[0].price;

      // Start transaction
      await pool.query('BEGIN');

      try {
        // Create booking
        const booking = await createBooking({
          customerId: user.id,
          serviceId: Number(serviceId),
          slotId: Number(slotId),
        });

        // Create payment record
        const paymentResult = await pool.query(
          `INSERT INTO payments (booking_id, amount, payment_status, payment_date)
           VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
           RETURNING id, booking_id, amount, payment_status, payment_date`,
          [booking.id, amount, paymentStatus || 'initiated']
        );

        const payment = paymentResult.rows[0];

        await pool.query('COMMIT');

        console.log("[POST /api/bookings] Booking created:", booking.id, "Payment:", payment.id, "Status:", payment.payment_status);

        // Notify vendor about new booking
        try {
          const svcResult = await pool.query(`SELECT title FROM services WHERE id = $1`, [serviceId]);
          const svcTitle = svcResult.rows[0]?.title ?? 'a service';
          await notifyVendorForBooking(booking.id, `New booking #${booking.id} received for "${svcTitle}".`);
        } catch (_) { /* non-critical */ }

        res.status(201).json({
          ok: true,
          booking,
          payment: {
            id: payment.id,
            amount: payment.amount,
            status: payment.payment_status,
            paymentDate: payment.payment_date
          }
        });
      } catch (err) {
        await pool.query('ROLLBACK');
        throw err;
      }
    } catch (err: any) {
      console.error("[POST /api/bookings] Error:", err);
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

      // Notify the other party about the status change
      try {
        const statusLabel = status.charAt(0).toUpperCase() + status.slice(1);
        if (user.role === 'vendor') {
          await notifyCustomerForBooking(bookingId, `Your booking #${bookingId} has been ${statusLabel.toLowerCase()} by the vendor.`);
        } else {
          await notifyVendorForBooking(bookingId, `Booking #${bookingId} status changed to "${statusLabel}" by the customer.`);
        }
      } catch (_) { /* non-critical */ }

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

      // Notify vendor about reschedule
      try {
        await notifyVendorForBooking(bookingId, `Booking #${bookingId} has been rescheduled by the customer.`);
      } catch (_) { /* non-critical */ }

      res.status(200).json({ ok: true, booking });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to reschedule booking" });
    }
  });

  // ---- Payment Management API ----
  // Get payment details for a booking
  app.get("/api/bookings/:bookingId/payment", async (req, res) => {
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
      const pool = getPool();

      // Verify booking belongs to user
      const bookingCheck = await pool.query(
        `SELECT customer_id FROM bookings WHERE id = $1`,
        [bookingId]
      );

      if (bookingCheck.rows.length === 0) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      if (user.role === "customer" && bookingCheck.rows[0].customer_id !== user.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      // Get payment details
      const result = await pool.query(
        `SELECT id, booking_id, amount, payment_status, payment_date
         FROM payments
         WHERE booking_id = $1`,
        [bookingId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Payment not found" });
        return;
      }

      res.status(200).json({ ok: true, payment: result.rows[0] });
    } catch (err: any) {
      console.error("[GET /api/bookings/:bookingId/payment] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to fetch payment" });
    }
  });

  // Update payment status (simulate payment processing)
  app.patch("/api/bookings/:bookingId/payment", async (req, res) => {
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

    const { paymentStatus } = req.body ?? {};
    if (!paymentStatus || !['initiated', 'success', 'failed'].includes(paymentStatus)) {
      res.status(400).json({ error: "Invalid payment status. Must be: initiated, success, or failed" });
      return;
    }

    try {
      const pool = getPool();

      // Verify booking belongs to user
      const bookingCheck = await pool.query(
        `SELECT customer_id, status FROM bookings WHERE id = $1`,
        [bookingId]
      );

      if (bookingCheck.rows.length === 0) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      if (bookingCheck.rows[0].customer_id !== user.id) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      // Update payment status
      const result = await pool.query(
        `UPDATE payments
         SET payment_status = $1, payment_date = CURRENT_TIMESTAMP
         WHERE booking_id = $2
         RETURNING id, booking_id, amount, payment_status, payment_date`,
        [paymentStatus, bookingId]
      );

      // If payment successful, update booking status to accepted
      if (paymentStatus === 'success') {
        await pool.query(
          `UPDATE bookings SET status = 'accepted' WHERE id = $1`,
          [bookingId]
        );
        // Notify vendor about successful payment
        try {
          await notifyVendorForBooking(bookingId, `Payment of ₹${result.rows[0].amount} received for booking #${bookingId}.`);
        } catch (_) { /* non-critical */ }
      } else if (paymentStatus === 'failed') {
        await pool.query(
          `UPDATE bookings SET status = 'cancelled' WHERE id = $1`,
          [bookingId]
        );
      }

      console.log("[PATCH /api/bookings/:bookingId/payment] Payment updated:", result.rows[0]);

      res.status(200).json({ ok: true, payment: result.rows[0] });
    } catch (err: any) {
      console.error("[PATCH /api/bookings/:bookingId/payment] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to update payment" });
    }
  });

  // Generate invoice for a booking
  app.get("/api/bookings/:bookingId/invoice", async (req, res) => {
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
      const pool = getPool();

      // Get complete booking details with payment, service, vendor, and customer info
      const result = await pool.query(
        `SELECT 
          b.id as booking_id,
          b.booking_date,
          b.status as booking_status,
          u_customer.name as customer_name,
          u_customer.email as customer_email,
          s.title as service_title,
          s.description as service_description,
          s.price as service_price,
          s.duration_minutes as service_duration,
          sc.name as category_name,
          u_vendor.name as vendor_name,
          u_vendor.email as vendor_email,
          v.business_name as vendor_business_name,
          v.service_area as vendor_service_area,
          slots.slot_date,
          slots.start_time::text as slot_start_time,
          slots.end_time::text as slot_end_time,
          p.id as payment_id,
          p.amount as payment_amount,
          p.payment_status,
          p.payment_date
         FROM bookings b
         JOIN users u_customer ON u_customer.id = b.customer_id
         JOIN services s ON s.id = b.service_id
         JOIN service_categories sc ON sc.id = s.category_id
         JOIN vendors v ON v.id = s.vendor_id
         JOIN users u_vendor ON u_vendor.id = v.user_id
         JOIN availability_slots slots ON slots.id = b.slot_id
         LEFT JOIN payments p ON p.booking_id = b.id
         WHERE b.id = $1`,
        [bookingId]
      );

      if (result.rows.length === 0) {
        res.status(404).json({ error: "Booking not found" });
        return;
      }

      const data = result.rows[0];

      // Verify user has access (customer owns booking or vendor owns service)
      if (user.role === "customer" && data.customer_email !== user.email) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      if (user.role === "vendor" && data.vendor_email !== user.email) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }

      // Generate invoice number (format: INV-YYYYMMDD-BookingID)
      const invoiceDate = new Date();
      const dateStr = invoiceDate.toISOString().slice(0, 10).replace(/-/g, '');
      const invoiceNumber = `INV-${dateStr}-${bookingId}`;

      const invoice = {
        invoiceNumber,
        invoiceDate: invoiceDate.toISOString(),
        bookingId: data.booking_id,
        bookingDate: data.booking_date,
        bookingStatus: data.booking_status,
        customer: {
          name: data.customer_name,
          email: data.customer_email,
        },
        vendor: {
          name: data.vendor_name,
          email: data.vendor_email,
          businessName: data.vendor_business_name,
          serviceArea: data.vendor_service_area,
        },
        service: {
          title: data.service_title,
          description: data.service_description,
          category: data.category_name,
          price: data.service_price,
          duration: data.service_duration,
        },
        appointment: {
          date: data.slot_date,
          startTime: data.slot_start_time,
          endTime: data.slot_end_time,
        },
        payment: {
          id: data.payment_id,
          amount: data.payment_amount,
          status: data.payment_status,
          date: data.payment_date,
        },
      };

      console.log("[GET /api/bookings/:bookingId/invoice] Invoice generated:", invoiceNumber);

      res.status(200).json({ ok: true, invoice });
    } catch (err: any) {
      console.error("[GET /api/bookings/:bookingId/invoice] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to generate invoice" });
    }
  });

  // ---- Reviews & Ratings API ----
  // Create a review (customers only)
  app.post("/api/reviews", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "customer") {
      res.status(403).json({ error: "Forbidden: customers only" });
      return;
    }

    const { bookingId, serviceId, rating, comment } = req.body ?? {};

    if (!bookingId || !serviceId || !rating) {
      res.status(400).json({ error: "Missing required fields: bookingId, serviceId, rating" });
      return;
    }

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      res.status(400).json({ error: "Rating must be a number between 1 and 5" });
      return;
    }

    try {
      const { createReview } = await import("./db/reviews");

      const review = await createReview({
        bookingId: Number(bookingId),
        customerId: user.id,
        serviceId: Number(serviceId),
        rating: Number(rating),
        comment: comment || undefined,
      });

      console.log("[POST /api/reviews] Review created:", review.id, "for booking:", bookingId);

      // Notify vendor about the new review
      try {
        const pool = getPool();
        const svcResult = await pool.query(`SELECT title FROM services WHERE id = $1`, [serviceId]);
        const svcTitle = svcResult.rows[0]?.title ?? 'your service';
        await notifyVendorForBooking(Number(bookingId), `New ${rating}-star review on "${svcTitle}".`);
      } catch (_) { /* non-critical */ }

      res.status(201).json({ ok: true, review });
    } catch (err: any) {
      console.error("[POST /api/reviews] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to create review" });
    }
  });

  // Get reviews for a service
  app.get("/api/services/:serviceId/reviews", async (req, res) => {
    const serviceId = Number(req.params.serviceId);
    if (isNaN(serviceId)) {
      res.status(400).json({ error: "Invalid service ID" });
      return;
    }

    try {
      const { getServiceReviews } = await import("./db/reviews");
      const reviews = await getServiceReviews({ serviceId });

      res.status(200).json({ ok: true, reviews });
    } catch (err: any) {
      console.error("[GET /api/services/:serviceId/reviews] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to fetch reviews" });
    }
  });

  // Get rating stats for a service
  app.get("/api/services/:serviceId/rating-stats", async (req, res) => {
    const serviceId = Number(req.params.serviceId);
    if (isNaN(serviceId)) {
      res.status(400).json({ error: "Invalid service ID" });
      return;
    }

    try {
      const { getServiceRatingStats } = await import("./db/reviews");
      const stats = await getServiceRatingStats(serviceId);

      res.status(200).json({ ok: true, stats });
    } catch (err: any) {
      console.error("[GET /api/services/:serviceId/rating-stats] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to fetch rating stats" });
    }
  });

  // Check if a booking can be reviewed
  app.get("/api/bookings/:bookingId/can-review", async (req, res) => {
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

    try {
      const { canReviewBooking } = await import("./db/reviews");
      const result = await canReviewBooking({
        bookingId,
        customerId: user.id,
      });

      res.status(200).json({ ok: true, ...result });
    } catch (err: any) {
      console.error("[GET /api/bookings/:bookingId/can-review] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to check review status" });
    }
  });

  // ---- Admin Users API ----
  // List all users (admin only)
  app.get("/api/admin/users", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admins only" });
      return;
    }

    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT id, name, email, role, created_at
         FROM users
         ORDER BY created_at DESC`
      );
      res.status(200).json({
        ok: true,
        users: rows.map((r: any) => ({
          id: r.id,
          name: r.name || "Anonymous",
          email: r.email,
          role: r.role,
          joined: new Date(r.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" }),
          createdAt: r.created_at,
        })),
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch users" });
    }
  });

  // ---- Admin Vendor Approval API ----

  // List all vendors with their user info and verification status
  app.get("/api/admin/vendors", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admins only" });
      return;
    }

    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT v.id, v.business_name, v.is_verified, v.created_at,
                u.name AS owner_name, u.email AS owner_email
         FROM vendors v
         JOIN users u ON u.id = v.user_id
         ORDER BY v.created_at DESC`
      );
      res.status(200).json({
        ok: true,
        vendors: rows.map((r: any) => ({
          id: r.id,
          businessName: r.business_name,
          isVerified: r.is_verified,
          createdAt: r.created_at,
          ownerName: r.owner_name,
          ownerEmail: r.owner_email,
        })),
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch vendors" });
    }
  });

  // Approve a vendor
  app.patch("/api/admin/vendors/:vendorId/approve", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admins only" });
      return;
    }

    const vendorId = Number(req.params.vendorId);
    if (isNaN(vendorId)) { res.status(400).json({ error: "Invalid vendor ID" }); return; }

    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `UPDATE vendors SET is_verified = true WHERE id = $1 RETURNING id, user_id, business_name`,
        [vendorId]
      );
      if (rows.length === 0) { res.status(404).json({ error: "Vendor not found" }); return; }

      // Notify the vendor
      try {
        await createNotification(rows[0].user_id, `Your vendor account "${rows[0].business_name}" has been approved! You can now receive bookings.`);
      } catch (_) { }

      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to approve vendor" });
    }
  });

  // Reject a vendor
  app.patch("/api/admin/vendors/:vendorId/reject", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admins only" });
      return;
    }

    const vendorId = Number(req.params.vendorId);
    if (isNaN(vendorId)) { res.status(400).json({ error: "Invalid vendor ID" }); return; }

    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `UPDATE vendors SET is_verified = false WHERE id = $1 RETURNING id, user_id, business_name`,
        [vendorId]
      );
      if (rows.length === 0) { res.status(404).json({ error: "Vendor not found" }); return; }

      // Notify the vendor
      try {
        await createNotification(rows[0].user_id, `Your vendor account "${rows[0].business_name}" application was not approved. Please contact support for details.`);
      } catch (_) { }

      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to reject vendor" });
    }
  });

  // Get all reviews (admin only)
  app.get("/api/admin/reviews", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admins only" });
      return;
    }

    const status = typeof req.query.status === "string" ? req.query.status : undefined;
    const limit = req.query.limit ? Number(req.query.limit) : undefined;

    try {
      const { getAllReviews } = await import("./db/reviews");
      const reviews = await getAllReviews({
        status: status as any,
        limit,
      });

      res.status(200).json({ ok: true, reviews });
    } catch (err: any) {
      console.error("[GET /api/admin/reviews] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to fetch reviews" });
    }
  });

  // Update review moderation status (admin only)
  app.patch("/api/admin/reviews/:reviewId", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admins only" });
      return;
    }

    const reviewId = Number(req.params.reviewId);
    if (isNaN(reviewId)) {
      res.status(400).json({ error: "Invalid review ID" });
      return;
    }

    const { status } = req.body ?? {};
    if (!status || !['pending', 'approved', 'rejected'].includes(status)) {
      res.status(400).json({ error: "Invalid status. Must be: pending, approved, or rejected" });
      return;
    }

    try {
      const { updateReviewStatus } = await import("./db/reviews");
      const review = await updateReviewStatus({ reviewId, status });

      console.log("[PATCH /api/admin/reviews/:reviewId] Review status updated:", reviewId, "->", status);

      res.status(200).json({ ok: true, review });
    } catch (err: any) {
      console.error("[PATCH /api/admin/reviews/:reviewId] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to update review" });
    }
  });

  // Delete review (admin only)
  app.delete("/api/admin/reviews/:reviewId", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "admin") {
      res.status(403).json({ error: "Forbidden: admins only" });
      return;
    }

    const reviewId = Number(req.params.reviewId);
    if (isNaN(reviewId)) {
      res.status(400).json({ error: "Invalid review ID" });
      return;
    }

    try {
      const { deleteReview } = await import("./db/reviews");
      await deleteReview(reviewId);

      console.log("[DELETE /api/admin/reviews/:reviewId] Review deleted:", reviewId);

      res.status(200).json({ ok: true, message: "Review deleted" });
    } catch (err: any) {
      console.error("[DELETE /api/admin/reviews/:reviewId] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to delete review" });
    }
  });

  // ---- Analytics API (JWT protected) ----
  // Vendor Reviews
  app.get("/api/vendor/reviews", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "vendor") {
      res.status(403).json({ error: "Forbidden: vendors only" });
      return;
    }

    try {
      const pool = getPool();

      // Get vendor ID
      const vendorResult = await pool.query(
        `SELECT id FROM vendors WHERE user_id = $1`,
        [user.id]
      );

      if (vendorResult.rows.length === 0) {
        res.status(404).json({ error: "Vendor profile not found" });
        return;
      }

      const vendorId = vendorResult.rows[0].id;

      // Get reviews for vendor's services
      const result = await pool.query(
        `SELECT 
          r.id,
          r.booking_id,
          r.customer_id,
          r.service_id,
          r.rating,
          r.comment,
          r.moderation_status,
          r.created_at,
          u.name as customer_name,
          s.title as service_title
        FROM reviews r
        JOIN bookings b ON b.id = r.booking_id
        JOIN services s ON s.id = r.service_id
        JOIN users u ON u.id = r.customer_id
        WHERE s.vendor_id = $1
        ORDER BY r.created_at DESC`,
        [vendorId]
      );

      const reviews = result.rows.map((row) => ({
        id: row.id,
        booking_id: row.booking_id,
        customer_id: row.customer_id,
        customer_name: row.customer_name,
        service_id: row.service_id,
        service_title: row.service_title,
        rating: row.rating,
        comment: row.comment,
        moderation_status: row.moderation_status,
        created_at: row.created_at.toISOString(),
      }));

      res.status(200).json({ ok: true, reviews });
    } catch (err: any) {
      console.error("[GET /api/vendor/reviews] Error:", err);
      res.status(400).json({ error: err?.message ?? "Failed to fetch reviews" });
    }
  });

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
      console.log("[POST /api/vendor/services] User ID:", user.id, "Vendor ID:", vendorId, "Category ID:", categoryId);
      const pool = getPool();

      const result = await pool.query(
        `INSERT INTO services (vendor_id, category_id, title, description, price, duration_minutes, is_active)
         VALUES ($1, $2, $3, $4, $5, $6, true)
         RETURNING id, title, description, price, duration_minutes, is_active, category_id`,
        [vendorId, categoryId, title, description || null, price || null, durationMinutes || null]
      );

      console.log("[POST /api/vendor/services] Service created:", result.rows[0]);
      res.status(201).json({ ok: true, service: result.rows[0] });
    } catch (err: any) {
      console.error("[POST /api/vendor/services] Error:", err);
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

      // Check if service has any bookings
      const bookingsCheck = await pool.query(
        `SELECT COUNT(*) as count FROM bookings WHERE service_id = $1`,
        [serviceId]
      );

      if (bookingsCheck.rows[0].count > 0) {
        res.status(400).json({
          error: "Cannot delete service with existing bookings. Please mark it as inactive instead."
        });
        return;
      }

      // Also check if service has any availability slots
      const slotsCheck = await pool.query(
        `SELECT COUNT(*) as count FROM availability_slots WHERE service_id = $1`,
        [serviceId]
      );

      // Delete availability slots first if any exist
      if (slotsCheck.rows[0].count > 0) {
        await pool.query(`DELETE FROM availability_slots WHERE service_id = $1`, [serviceId]);
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
      const vendorId = await getVendorIdByUserId(user.id);
      const stats = await getVendorStats(vendorId);
      const monthlyEarnings = await getVendorMonthlyEarnings(vendorId, 6);
      const ratingDistribution = await getVendorRatingDistribution(vendorId);
      const mostBookedServices = await getVendorMostBookedServices(vendorId, 5);

      res.status(200).json({
        ok: true,
        stats,
        monthlyEarnings,
        ratingDistribution,
        mostBookedServices,
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch analytics" });
    }
  });

  // Vendor earnings (stats + chart + transactions)
  app.get("/api/analytics/vendor/earnings", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user || user.role !== "vendor") {
      res.status(403).json({ error: "Forbidden: vendors only" });
      return;
    }

    try {
      const vendorId = await getVendorIdByUserId(user.id);
      const stats = await getVendorStats(vendorId);
      const monthlyEarnings = await getVendorMonthlyEarnings(vendorId, 6);
      const transactions = await getVendorTransactions(vendorId, 20);
      const pendingPayout = await getVendorPendingPayout(vendorId);

      res.status(200).json({
        ok: true,
        stats: {
          totalEarnings: stats.totalEarnings,
          thisMonthEarnings: stats.thisMonthEarnings,
          earningsTrend: stats.earningsTrend,
          pendingPayout,
        },
        monthlyEarnings,
        transactions,
      });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch earnings" });
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

  // ---- Notifications API ----

  // Get notifications for the logged-in user
  app.get("/api/notifications", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    try {
      const notifications = await getNotifications(user.id);
      const unreadCount = await getUnreadCount(user.id);
      res.status(200).json({ ok: true, notifications, unreadCount });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to fetch notifications" });
    }
  });

  // Mark a single notification as read
  app.patch("/api/notifications/:id/read", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    try {
      await markAsRead(Number(req.params.id), user.id);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to mark as read" });
    }
  });

  // Mark all notifications as read
  app.patch("/api/notifications/read-all", async (req, res) => {
    const user = getAuthUserFromRequest(req);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }

    try {
      await markAllAsRead(user.id);
      res.status(200).json({ ok: true });
    } catch (err: any) {
      res.status(400).json({ error: err?.message ?? "Failed to mark all as read" });
    }
  });

  // ---- Locations API ----
  app.get("/api/locations", async (_req, res) => {
    try {
      const pool = (await import("./db/pool")).getPool();
      const { rows } = await pool.query<{ city: string }>(
        `SELECT DISTINCT city
         FROM vendors
         WHERE city IS NOT NULL AND city != ''
         ORDER BY city ASC`
      );
      const locations = rows.map((r) => r.city);
      res.status(200).json({ ok: true, locations });
    } catch (err: any) {
      console.error("[GET /api/locations] Error:", err);
      res.status(500).json({ error: "Failed to fetch locations" });
    }
  });

  // ---- Chatbot API ----

  type RoleCtx = "customer" | "vendor" | "admin" | "public";

  type IntentEntry = {
    intent: string;
    keywords: string[];
    roles: RoleCtx[];
  };

  const intents: IntentEntry[] = [
    { intent: "greeting", keywords: ["hello", "hi", "hey", "good morning", "good evening"], roles: ["customer", "vendor", "admin", "public"] },
    { intent: "help", keywords: ["help", "what can you do", "how to use", "guide"], roles: ["customer", "vendor", "admin", "public"] },
    { intent: "thanks", keywords: ["thank", "thanks", "appreciate"], roles: ["customer", "vendor", "admin", "public"] },
    { intent: "booking_info", keywords: ["my booking", "booking status", "how many booking", "booking count", "bookings"], roles: ["customer", "vendor"] },
    { intent: "book_service", keywords: ["book a", "make appointment", "schedule", "book service"], roles: ["customer", "public"] },
    { intent: "cancel_reschedule", keywords: ["cancel", "reschedule", "change date", "change time"], roles: ["customer"] },
    { intent: "find_service", keywords: ["find", "search", "looking for", "discover", "browse"], roles: ["customer", "vendor", "admin", "public"] },
    { intent: "pricing", keywords: ["price", "cost", "how much", "pricing", "fee"], roles: ["customer", "public"] },
    { intent: "review", keywords: ["review", "rate", "feedback", "rating"], roles: ["customer", "vendor", "admin"] },
    { intent: "earnings", keywords: ["earning", "revenue", "income", "money", "payout", "payment"], roles: ["vendor"] },
    { intent: "service_mgmt", keywords: ["add service", "create listing", "new service", "my service", "edit service"], roles: ["vendor"] },
    { intent: "profile", keywords: ["profile", "verify", "verification", "account", "settings"], roles: ["customer", "vendor"] },
    { intent: "vendor_mgmt", keywords: ["approve vendor", "vendor application", "pending vendor", "manage vendor"], roles: ["admin"] },
    { intent: "platform_stats", keywords: ["stats", "analytics", "report", "users", "dashboard", "overview"], roles: ["admin"] },
    { intent: "categories", keywords: ["category", "categories"], roles: ["admin"] },
    { intent: "moderation", keywords: ["moderate", "flag", "reported", "spam"], roles: ["admin"] },
    { intent: "notifications", keywords: ["notification", "alert", "unread"], roles: ["customer", "vendor", "admin"] },
    { intent: "signup", keywords: ["sign up", "register", "create account", "join", "sign in", "login", "log in"], roles: ["public"] },
    { intent: "become_vendor", keywords: ["become vendor", "offer service", "sell service", "provider", "start business"], roles: ["public"] },
  ];

  function detectIntent(message: string, role: RoleCtx): string {
    const lower = message.toLowerCase();
    for (const entry of intents) {
      if (!entry.roles.includes(role)) continue;
      if (entry.keywords.some((kw) => lower.includes(kw))) return entry.intent;
    }
    return "fallback";
  }

  // Extract a search keyword from the message (the first noun phrase after intent keywords)
  function extractSearchKeyword(message: string): string {
    const lower = message.toLowerCase();
    const prefixes = ["find ", "search ", "looking for ", "search for ", "find me ", "i need ", "i want "];
    for (const p of prefixes) {
      const idx = lower.indexOf(p);
      if (idx !== -1) {
        const rest = message.slice(idx + p.length).trim().replace(/[?.!]+$/, "");
        if (rest.length > 0 && rest.length < 80) return rest;
      }
    }
    // Fallback: use the whole message without common words
    const cleaned = lower.replace(/\b(a|an|the|is|are|i|me|my|for|to|in|on|any|some|please|can|you|do|have)\b/g, "").trim();
    return cleaned.length > 0 && cleaned.length < 80 ? cleaned : "";
  }

  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body ?? {};
      if (typeof message !== "string" || !message.trim()) {
        res.status(400).json({ error: "Message is required" });
        return;
      }

      const user = getAuthUserFromRequest(req);
      const role: RoleCtx = user?.role ?? "public";
      const intent = detectIntent(message, role);

      let reply = "";
      let suggestions: string[] = [];

      switch (intent) {
        // --- Shared intents ---
        case "greeting":
          if (role === "customer") {
            reply = `Hello${user?.name ? `, ${user.name}` : ""}! 😊 How can I help you today? You can ask about your bookings, find services, or get help navigating the platform.`;
            suggestions = ["My bookings", "Find a service", "Help"];
          } else if (role === "vendor") {
            reply = `Hello${user?.name ? `, ${user.name}` : ""}! 👋 I'm here to help with your vendor dashboard. Ask me about earnings, bookings, or service management.`;
            suggestions = ["My earnings", "My bookings", "Add service"];
          } else if (role === "admin") {
            reply = `Hello, Admin! 🛡️ I can help you with platform analytics, vendor management, and content moderation.`;
            suggestions = ["Platform stats", "Pending reviews", "Manage vendors"];
          } else {
            reply = `Hello! 😊 Welcome to ServiceBook! I can help you find services, learn about our platform, or get started. What would you like to know?`;
            suggestions = ["Browse services", "How to book", "Sign up"];
          }
          break;

        case "help":
          if (role === "customer") {
            reply = `Here's what I can help you with:\n\n📋 Bookings - View your bookings, check statuses\n🔍 Services - Find and search for services\n⭐ Reviews - Leave feedback after completed bookings\n👤 Profile - Manage your account settings\n🔔 Notifications - Check your alerts\n\nJust ask about any of these!`;
            suggestions = ["My bookings", "Find a service", "My profile"];
          } else if (role === "vendor") {
            reply = `Here's what I can help you with:\n\n💰 Earnings - Revenue, payouts, transaction history\n📋 Bookings - View and manage booking requests\n🛠️ Services - Create, edit, manage listings\n⭐ Reviews - See customer feedback\n👤 Profile - Update your business details\n\nJust ask about any of these!`;
            suggestions = ["My earnings", "My bookings", "My services"];
          } else if (role === "admin") {
            reply = `Here's what I can help you with:\n\n📊 Analytics - Platform stats, user growth, revenue\n🏪 Vendors - Approve/manage vendor applications\n📂 Categories - Manage service categories\n⭐ Reviews - Moderate user reviews\n👥 Users - User management\n\nJust ask about any of these!`;
            suggestions = ["Platform stats", "Manage vendors", "Moderate reviews"];
          } else {
            reply = `I can help you with:\n\n🔍 Find Services - Browse and discover service providers\n📝 How to Book - Learn the booking process\n🤝 Become a Vendor - Start offering your services\n📋 Sign Up - Create your account\n\nWhat are you interested in?`;
            suggestions = ["Find services", "How to book", "Sign up"];
          }
          break;

        case "thanks":
          reply = "You're welcome! 😊 Let me know if there's anything else I can help with.";
          suggestions = ["Help"];
          break;

        // --- Customer intents ---
        case "booking_info":
          if (role === "customer" && user) {
            try {
              const summary = await chatGetCustomerBookingSummary(user.id);
              const recent = await chatGetCustomerRecentBookings(user.id, 3);
              reply = `Your Booking Summary:\nTotal: ${summary.total} bookings\nPending: ${summary.pending}\nAccepted: ${summary.accepted}\nCompleted: ${summary.completed}\nCancelled: ${summary.cancelled}`;
              if (recent.length > 0) {
                reply += `\n\nRecent Bookings:`;
                recent.forEach((b) => {
                  reply += `\n#${b.id} - ${b.serviceTitle} (${b.status})`;
                });
              }
              suggestions = ["Find a service", "Help"];
            } catch {
              reply = "Couldn't fetch your booking data right now. View your bookings on the My Bookings page.";
              suggestions = ["Help"];
            }
          } else if (role === "vendor" && user) {
            try {
              const summary = await chatGetVendorBookingSummary(user.id);
              const recent = await chatGetVendorRecentBookings(user.id, 3);
              reply = `Your Booking Summary:\nTotal: ${summary.total} bookings\nPending: ${summary.pending} (need your action)\nAccepted: ${summary.accepted}\nCompleted: ${summary.completed}`;
              if (recent.length > 0) {
                reply += `\n\nRecent Bookings:`;
                recent.forEach((b) => {
                  reply += `\n#${b.id} - ${b.serviceTitle} from ${b.customerName} (${b.status})`;
                });
              }
              suggestions = ["My earnings", "My services", "Help"];
            } catch {
              reply = "Couldn't fetch your booking data right now. View your bookings on the Bookings page.";
              suggestions = ["Help"];
            }
          } else {
            reply = "Please sign in to view your bookings.";
            suggestions = ["Sign up", "Help"];
          }
          break;

        case "book_service":
          if (role === "customer") {
            reply = `To book a service:\n\n1️⃣ Browse or search for a service\n2️⃣ Select your preferred date & time slot\n3️⃣ Confirm the booking on the checkout page\n\nWould you like to search for a specific service?`;
            suggestions = ["Find a service", "My bookings"];
          } else {
            reply = `To book a service, you'll need to sign in as a customer first. Once logged in, browse services and follow the booking flow!`;
            suggestions = ["Sign up", "Browse services"];
          }
          break;

        case "cancel_reschedule":
          reply = `You can manage your bookings from the My Bookings page:\n\nCancel - Click the cancel button on any pending/accepted booking\nReschedule - Select a new time slot for your booking\n\nNote: Some cancellation policies may apply depending on the service provider.`;
          suggestions = ["My bookings", "Help"];
          break;

        case "find_service": {
          const keyword = extractSearchKeyword(message);
          if (keyword.length > 1) {
            try {
              const results = await chatSearchServices(keyword, 5);
              if (results.length > 0) {
                reply = `Services matching "${keyword}":\n`;
                results.forEach((s) => {
                  reply += `\n${s.title} - ₹${s.price} by ${s.vendorName}${s.rating > 0 ? ` (⭐ ${s.rating})` : ""}`;
                });
                reply += `\n\nVisit the Services page for full details and booking!`;
              } else {
                reply = `Couldn't find services matching "${keyword}". Try a different search or browse all services on the Services page.`;
              }
              suggestions = ["Browse all services", "Help"];
            } catch {
              reply = "Couldn't search services right now. Browse all services on the Services page!";
              suggestions = ["Help"];
            }
          } else {
            reply = `Browse all services on the Services page! Use the search bar and category filters to narrow down what you're looking for.\n\nOr tell me what you're looking for, e.g., "Find plumbing services".`;
            suggestions = ["Browse services", "Help"];
          }
          break;
        }

        case "pricing":
          reply = `Service prices vary by provider. You can view each service's pricing on its detail page.\n\nPrices are displayed upfront before you confirm a booking, so there are no hidden costs!`;
          suggestions = ["Find a service", "Help"];
          break;

        case "review":
          if (role === "customer") {
            reply = `After a completed service, you'll see a Leave Review option on your bookings page. Your feedback helps other customers and the vendor!\n\nRate from 1-5 stars and leave a comment.`;
            suggestions = ["My bookings", "Help"];
          } else if (role === "vendor") {
            reply = `View all customer reviews on your Reviews page. Reviews are visible to customers after admin approval.`;
            suggestions = ["My bookings", "My earnings"];
          } else if (role === "admin") {
            try {
              const stats = await chatGetAdminStats();
              reply = `Review Moderation:\n\nPending reviews: ${stats.pendingReviews}\n\nHead to the Reviews page to approve, edit, or remove reviews that violate platform guidelines.`;
              suggestions = ["Platform stats", "Manage vendors"];
            } catch {
              reply = "Check the Reviews page for flagged or reported reviews. You can approve, edit, or remove reviews.";
              suggestions = ["Platform stats", "Help"];
            }
          } else {
            reply = "Sign in to leave reviews after booking a service!";
            suggestions = ["Sign up", "Help"];
          }
          break;

        // --- Vendor intents ---
        case "earnings":
          if (role === "vendor" && user) {
            try {
              const earnings = await chatGetVendorEarnings(user.id);
              reply = `Your Earnings Summary:\n\nTotal Earnings: ₹${earnings.totalEarnings}\nThis Month: ₹${earnings.thisMonthEarnings}\nPending Payout: ₹${earnings.pendingPayout}\n\nVisit the Earnings page for a full breakdown and transaction history!`;
              suggestions = ["My bookings", "My services"];
            } catch {
              reply = "Couldn't fetch your earnings right now. Check the Earnings page for a full breakdown.";
              suggestions = ["Help"];
            }
          } else {
            reply = "Earnings information is available to vendors. Sign in as a vendor to view your earnings.";
            suggestions = ["Help"];
          }
          break;

        case "service_mgmt":
          if (role === "vendor" && user) {
            try {
              const svcCount = await chatGetVendorServiceCount(user.id);
              reply = `Your Services:\n\nActive: ${svcCount.active} services\nTotal: ${svcCount.total} services\n\nTo create a new service:\n1. Go to My Services\n2. Click Add Service\n3. Fill in details, pricing, and availability\n\nTip: Detailed descriptions and competitive pricing get more bookings!`;
              suggestions = ["My bookings", "My earnings"];
            } catch {
              reply = "To manage your services, visit the My Services page. You can add, edit, or deactivate listings there.";
              suggestions = ["Help"];
            }
          } else {
            reply = "Service management is available to vendors. Sign up as a vendor to create and manage service listings!";
            suggestions = ["Become a vendor", "Help"];
          }
          break;

        case "profile":
          if (role === "vendor") {
            reply = `Complete your vendor profile to increase visibility:\n\nBusiness name & description\nService area\nUpload license/certification for verification\nAdd a shop image\n\nVisit the Profile page to update your details.`;
            suggestions = ["My earnings", "My services"];
          } else if (role === "customer") {
            reply = `Update your profile from the Profile page:\n\nName & contact info\nPhone number\n\nKeep your info up to date so vendors can reach you about bookings!`;
            suggestions = ["My bookings", "Help"];
          } else {
            reply = "Sign in to manage your profile settings.";
            suggestions = ["Sign up", "Help"];
          }
          break;

        // --- Admin intents ---
        case "vendor_mgmt":
          reply = `Head to the Vendors page to review pending applications. You can:\n\nApprove vendors\nReject applications\nView vendor details and documents\n\nVerified vendors get a badge on their profile.`;
          suggestions = ["Platform stats", "Moderate reviews"];
          break;

        case "platform_stats":
          if (role === "admin") {
            try {
              const stats = await chatGetAdminStats();
              reply = `Platform Overview:\n\nTotal Customers: ${stats.totalUsers}\nTotal Vendors: ${stats.totalVendors}\nTotal Bookings: ${stats.totalBookings}\nTotal Revenue: ₹${stats.totalRevenue}\nPending Reviews: ${stats.pendingReviews}\n\nVisit the Dashboard for detailed charts and trends!`;
              suggestions = ["Manage vendors", "Moderate reviews"];
            } catch {
              reply = "Couldn't fetch platform stats right now. Check the Dashboard for detailed analytics.";
              suggestions = ["Help"];
            }
          } else {
            reply = "Platform analytics are available to administrators.";
            suggestions = ["Help"];
          }
          break;

        case "categories":
          reply = `Manage service categories from the Categories page:\n\nAdd new categories\nEdit existing category names\nOrganize the service catalog\n\nCategories help customers find services quickly!`;
          suggestions = ["Platform stats", "Manage vendors"];
          break;

        case "moderation":
          reply = `Check the Reviews page for flagged or reported content. You can:\n\nApprove legitimate reviews\nEdit inappropriate content\nRemove policy-violating reviews\n\nTimely moderation keeps the platform trustworthy!`;
          suggestions = ["Platform stats", "Manage vendors"];
          break;

        // --- Public intents ---
        case "signup":
          reply = `Getting started is easy!\n\n1. Click Sign In at the top of the page\n2. Choose to sign up as a Customer or Vendor\n3. Fill in your details or use Google Sign-In\n\nCustomer - Book services from top providers\nVendor - List your services and grow your business`;
          suggestions = ["Browse services", "Become a vendor"];
          break;

        case "become_vendor":
          reply = `Want to offer your services?\n\n1. Sign up as a Vendor\n2. Complete your business profile\n3. Add your service listings with pricing\n4. Set your availability\n5. Start receiving bookings!\n\nVendors can manage everything from their dashboard.`;
          suggestions = ["Sign up", "Browse services"];
          break;

        case "notifications":
          reply = `Check your Notifications page for alerts about:\n\nBooking updates\nNew reviews\nImportant platform announcements\n\nUnread notifications are shown with a badge in the sidebar.`;
          suggestions = ["My bookings", "Help"];
          break;

        // --- Fallback ---
        default: {
          // Use Groq with RAG for unrecognized intents
          try {
            const { context, sources } = await retrieveRAGContext(
              message,
              user?.id,
              role
            );

            const systemPrompt = `You are a direct, concise customer service chatbot for ServiceBook.
Role: ${role} ${user?.name ? `(${user.name})` : ""}

IMPORTANT RULES:
- Give SHORT, direct answers (1-3 sentences max)
- NO long explanations or lists unless specifically asked
- Use bullet points ONLY when necessary
- Be helpful but brief
- Reference specific data from context when available
- If you don't know, say so directly

Context data:
${context}`;

            const completion = await groq.chat.completions.create({
              messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: message },
              ],
              model: "llama-3.1-8b-instant",
              temperature: 0.7,
              max_tokens: 150,
            });

            reply =
              completion.choices[0]?.message?.content ||
              "I couldn't process that request. Please try again.";

            // Add context-aware suggestions
            if (sources.servicesCount > 0) {
              suggestions.push("Browse services");
            }
            if (role === "customer") {
              suggestions.push("My bookings");
            } else if (role === "vendor") {
              suggestions.push("My services");
            }
            suggestions.push("Help");
          } catch (groqError) {
            console.error("Groq RAG error:", groqError);
            // Fallback to static response if Groq fails
            const fallbacks = [
              `I'm not sure I understand. Could you rephrase that? You can ask me about ${role === "vendor" ? "earnings, bookings, or services" : role === "admin" ? "platform stats, vendors, or moderation" : "services, bookings, or how the platform works"}.`,
              `Hmm, I don't have an answer for that yet. Try asking about ${role === "vendor" ? "your earnings or managing services" : role === "admin" ? "analytics or vendor management" : "finding services or managing bookings"}!`,
              `I'm still learning! Try asking me about ${role === "vendor" ? "service management, bookings, or revenue" : role === "admin" ? "platform overview or content moderation" : "discovering services, bookings, or your account"}.`,
            ];
            reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
            suggestions = ["Help"];
          }
          break;
        }
      }

      res.status(200).json({ reply, suggestions });
    } catch (err: any) {
      console.error("[POST /api/chat] Error:", err);
      res.status(500).json({ error: "Something went wrong. Please try again." });
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
