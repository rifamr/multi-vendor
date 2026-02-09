import { getPool } from "./pool";

export type BookingStatus = "pending" | "accepted" | "rejected" | "completed" | "cancelled";

export type AvailabilitySlot = {
  id: number;
  vendorId: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
};

export type Booking = {
  id: number;
  customerId: number;
  serviceId: number;
  slotId: number;
  status: BookingStatus;
  bookingDate: string;
  customerName: string | null;
  customerEmail: string;
  serviceTitle: string;
  servicePrice: number | null;
  vendorId: number;
  vendorName: string | null;
  slotDate: string;
  startTime: string;
  endTime: string;
};

export async function getAvailableSlots(params: {
  vendorId?: number;
  serviceId?: number;
  fromDate?: string;
  includeBooked?: boolean;
}): Promise<AvailabilitySlot[]> {
  const pool = getPool();

  const where: string[] = [];
  const values: Array<number | string> = [];

  // Only filter by is_available if not includeBooked
  if (!params.includeBooked) {
    where.push("slots.is_available = true");
  }

  if (params.vendorId) {
    values.push(params.vendorId);
    where.push(`slots.vendor_id = $${values.length}`);
  }

  if (params.serviceId) {
    values.push(params.serviceId);
    where.push(`services.id = $${values.length}`);
  }

  // Always filter by date - show only current and future slots
  if (params.fromDate) {
    values.push(params.fromDate);
    where.push(`slots.slot_date >= $${values.length}::date`);
  } else {
    where.push(`slots.slot_date >= CURRENT_DATE`);
  }

  const sql = `
    SELECT DISTINCT
      slots.id,
      slots.vendor_id AS "vendorId",
      slots.slot_date::text AS "slotDate",
      slots.start_time::text AS "startTime",
      slots.end_time::text AS "endTime",
      slots.is_available AS "isAvailable"
    FROM availability_slots slots
    ${params.serviceId ? "JOIN services ON services.vendor_id = slots.vendor_id" : ""}
    ${where.length > 0 ? `WHERE ${where.join(" AND ")}` : ""}
    ORDER BY slots.slot_date ASC, slots.start_time ASC
    LIMIT 100
  `;

  const result = await pool.query<AvailabilitySlot>(sql, values);
  return result.rows;
}

export async function createBooking(params: {
  customerId: number;
  serviceId: number;
  slotId: number;
}): Promise<Booking> {
  const pool = getPool();

  // Check if slot is available
  const slotCheck = await pool.query<{ is_available: boolean; vendor_id: number }>(
    `SELECT is_available, vendor_id FROM availability_slots WHERE id = $1`,
    [params.slotId]
  );

  if (slotCheck.rows.length === 0) {
    throw new Error("Availability slot not found");
  }

  if (!slotCheck.rows[0]?.is_available) {
    throw new Error("This slot is no longer available");
  }

  // Verify service belongs to the vendor
  const serviceCheck = await pool.query<{ vendor_id: number }>(
    `SELECT vendor_id FROM services WHERE id = $1`,
    [params.serviceId]
  );

  if (serviceCheck.rows.length === 0) {
    throw new Error("Service not found");
  }

  if (serviceCheck.rows[0]?.vendor_id !== slotCheck.rows[0]?.vendor_id) {
    throw new Error("Service does not match the selected time slot");
  }

  // Create booking and mark slot as unavailable in a transaction
  await pool.query("BEGIN");

  try {
    const insertResult = await pool.query<{ id: number }>(
      `INSERT INTO bookings (customer_id, service_id, slot_id, status, booking_date)
       VALUES ($1, $2, $3, 'pending', NOW())
       RETURNING id`,
      [params.customerId, params.serviceId, params.slotId]
    );

    const bookingId = insertResult.rows[0]?.id;
    if (!bookingId) throw new Error("Failed to create booking");

    // Mark slot as unavailable
    await pool.query(
      `UPDATE availability_slots SET is_available = false WHERE id = $1`,
      [params.slotId]
    );

    await pool.query("COMMIT");

    // Fetch the full booking details
    const booking = await getBookingById(bookingId);
    if (!booking) throw new Error("Failed to retrieve created booking");

    return booking;
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

export async function getBookingById(id: number): Promise<Booking | null> {
  const pool = getPool();

  const result = await pool.query<Booking>(
    `SELECT
      b.id,
      b.customer_id AS "customerId",
      b.service_id AS "serviceId",
      b.slot_id AS "slotId",
      b.status,
      b.booking_date::text AS "bookingDate",
      u.name AS "customerName",
      u.email AS "customerEmail",
      s.title AS "serviceTitle",
      s.price::float AS "servicePrice",
      v.id AS "vendorId",
      v.business_name AS "vendorName",
      slots.slot_date::text AS "slotDate",
      slots.start_time::text AS "startTime",
      slots.end_time::text AS "endTime"
    FROM bookings b
    JOIN users u ON u.id = b.customer_id
    JOIN services s ON s.id = b.service_id
    JOIN vendors v ON v.id = s.vendor_id
    JOIN availability_slots slots ON slots.id = b.slot_id
    WHERE b.id = $1`,
    [id]
  );

  return result.rows[0] ?? null;
}

export async function listBookings(params: {
  customerId?: number;
  vendorId?: number;
  status?: BookingStatus;
  limit?: number;
}): Promise<Booking[]> {
  const pool = getPool();

  const where: string[] = [];
  const values: Array<number | string> = [];

  if (params.customerId) {
    values.push(params.customerId);
    where.push(`b.customer_id = $${values.length}`);
  }

  if (params.vendorId) {
    values.push(params.vendorId);
    where.push(`v.id = $${values.length}`);
  }

  if (params.status) {
    values.push(params.status);
    where.push(`b.status = $${values.length}`);
  }

  const limit = params.limit ?? 50;
  const whereClause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

  const sql = `
    SELECT
      b.id,
      b.customer_id AS "customerId",
      b.service_id AS "serviceId",
      b.slot_id AS "slotId",
      b.status,
      b.booking_date::text AS "bookingDate",
      u.name AS "customerName",
      u.email AS "customerEmail",
      s.title AS "serviceTitle",
      s.price::float AS "servicePrice",
      v.id AS "vendorId",
      v.business_name AS "vendorName",
      slots.slot_date::text AS "slotDate",
      slots.start_time::text AS "startTime",
      slots.end_time::text AS "endTime"
    FROM bookings b
    JOIN users u ON u.id = b.customer_id
    JOIN services s ON s.id = b.service_id
    JOIN vendors v ON v.id = s.vendor_id
    JOIN availability_slots slots ON slots.id = b.slot_id
    ${whereClause}
    ORDER BY slots.slot_date DESC, slots.start_time DESC
    LIMIT $${values.length + 1}
  `;

  const result = await pool.query<Booking>(sql, [...values, limit]);
  return result.rows;
}

export async function updateBookingStatus(params: {
  bookingId: number;
  status: BookingStatus;
  userId: number;
  userRole: "customer" | "vendor" | "admin";
}): Promise<Booking> {
  const pool = getPool();

  // Fetch booking to validate ownership/permission
  const booking = await getBookingById(params.bookingId);
  if (!booking) throw new Error("Booking not found");

  // Validate permission
  if (params.userRole === "customer" && booking.customerId !== params.userId) {
    throw new Error("You can only update your own bookings");
  }

  if (params.userRole === "vendor") {
    // Verify vendor owns the service
    const vendorCheck = await pool.query<{ user_id: number }>(
      `SELECT user_id FROM vendors WHERE id = $1`,
      [booking.vendorId]
    );
    if (vendorCheck.rows[0]?.user_id !== params.userId) {
      throw new Error("You can only update bookings for your services");
    }
  }

  // Validate status transitions
  if (params.status === "accepted" || params.status === "rejected") {
    if (params.userRole !== "vendor" && params.userRole !== "admin") {
      throw new Error("Only vendors can accept or reject bookings");
    }
    if (booking.status !== "pending") {
      throw new Error("Only pending bookings can be accepted or rejected");
    }
  }

  if (params.status === "cancelled") {
    if (booking.status === "completed") {
      throw new Error("Cannot cancel a completed booking");
    }
  }

  if (params.status === "completed") {
    if (booking.status !== "accepted") {
      throw new Error("Only accepted bookings can be marked as completed");
    }
  }

  // Update status
  await pool.query(
    `UPDATE bookings SET status = $1 WHERE id = $2`,
    [params.status, params.bookingId]
  );

  // If rejected or cancelled, free up the slot
  if (params.status === "rejected" || params.status === "cancelled") {
    await pool.query(
      `UPDATE availability_slots SET is_available = true WHERE id = $1`,
      [booking.slotId]
    );
  }

  const updated = await getBookingById(params.bookingId);
  if (!updated) throw new Error("Failed to retrieve updated booking");

  return updated;
}

export async function rescheduleBooking(params: {
  bookingId: number;
  newSlotId: number;
  userId: number;
}): Promise<Booking> {
  const pool = getPool();

  const booking = await getBookingById(params.bookingId);
  if (!booking) throw new Error("Booking not found");

  if (booking.customerId !== params.userId) {
    throw new Error("You can only reschedule your own bookings");
  }

  if (booking.status === "completed" || booking.status === "cancelled") {
    throw new Error("Cannot reschedule a completed or cancelled booking");
  }

  // Check new slot availability and that it belongs to same vendor
  const slotCheck = await pool.query<{ is_available: boolean; vendor_id: number }>(
    `SELECT is_available, vendor_id FROM availability_slots WHERE id = $1`,
    [params.newSlotId]
  );

  if (slotCheck.rows.length === 0) {
    throw new Error("New slot not found");
  }

  if (!slotCheck.rows[0]?.is_available) {
    throw new Error("New slot is not available");
  }

  if (slotCheck.rows[0]?.vendor_id !== booking.vendorId) {
    throw new Error("New slot must be from the same vendor");
  }

  // Transaction: free old slot, book new slot, update booking, reset status to pending
  await pool.query("BEGIN");

  try {
    await pool.query(
      `UPDATE availability_slots SET is_available = true WHERE id = $1`,
      [booking.slotId]
    );

    await pool.query(
      `UPDATE availability_slots SET is_available = false WHERE id = $1`,
      [params.newSlotId]
    );

    await pool.query(
      `UPDATE bookings SET slot_id = $1, status = 'pending' WHERE id = $2`,
      [params.newSlotId, params.bookingId]
    );

    await pool.query("COMMIT");

    const updated = await getBookingById(params.bookingId);
    if (!updated) throw new Error("Failed to retrieve rescheduled booking");

    return updated;
  } catch (err) {
    await pool.query("ROLLBACK");
    throw err;
  }
}

export async function createAvailabilitySlot(params: {
  vendorId: number;
  slotDate: string;
  startTime: string;
  endTime: string;
}): Promise<AvailabilitySlot> {
  const pool = getPool();

  const result = await pool.query<{ id: number }>(
    `INSERT INTO availability_slots (vendor_id, slot_date, start_time, end_time, is_available)
     VALUES ($1, $2::date, $3::time, $4::time, true)
     RETURNING id`,
    [params.vendorId, params.slotDate, params.startTime, params.endTime]
  );

  const slotId = result.rows[0]?.id;
  if (!slotId) throw new Error("Failed to create availability slot");

  return {
    id: slotId,
    vendorId: params.vendorId,
    slotDate: params.slotDate,
    startTime: params.startTime,
    endTime: params.endTime,
    isAvailable: true,
  };
}

export async function deleteAvailabilitySlot(params: {
  slotId: number;
  vendorId: number;
}): Promise<void> {
  const pool = getPool();

  // Check if slot has any bookings
  const bookingCheck = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM bookings WHERE slot_id = $1 AND status NOT IN ('rejected', 'cancelled')`,
    [params.slotId]
  );

  if ((bookingCheck.rows[0]?.count ?? 0) > 0) {
    throw new Error("Cannot delete a slot with active bookings");
  }

  const result = await pool.query(
    `DELETE FROM availability_slots WHERE id = $1 AND vendor_id = $2`,
    [params.slotId, params.vendorId]
  );

  if (result.rowCount === 0) {
    throw new Error("Slot not found or you do not have permission to delete it");
  }
}
