import { getPool } from "./pool";

export interface Notification {
  id: number;
  userId: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/** Get all notifications for a user, newest first */
export async function getNotifications(userId: number): Promise<Notification[]> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, user_id, message, is_read, created_at
     FROM notifications
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT 50`,
    [userId]
  );
  return rows.map((r: any) => ({
    id: r.id,
    userId: r.user_id,
    message: r.message,
    isRead: r.is_read,
    createdAt: r.created_at,
  }));
}

/** Get unread count for a user */
export async function getUnreadCount(userId: number): Promise<number> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM notifications WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
  return rows[0]?.count ?? 0;
}

/** Create a notification */
export async function createNotification(userId: number, message: string): Promise<Notification> {
  const pool = getPool();
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, message, is_read, created_at)
     VALUES ($1, $2, false, CURRENT_TIMESTAMP)
     RETURNING id, user_id, message, is_read, created_at`,
    [userId, message]
  );
  const r = rows[0];
  return {
    id: r.id,
    userId: r.user_id,
    message: r.message,
    isRead: r.is_read,
    createdAt: r.created_at,
  };
}

/** Mark a single notification as read */
export async function markAsRead(notificationId: number, userId: number): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE notifications SET is_read = true WHERE id = $1 AND user_id = $2`,
    [notificationId, userId]
  );
}

/** Mark all notifications as read for a user */
export async function markAllAsRead(userId: number): Promise<void> {
  const pool = getPool();
  await pool.query(
    `UPDATE notifications SET is_read = true WHERE user_id = $1 AND is_read = false`,
    [userId]
  );
}

/**
 * Helper: send notification to the vendor who owns a booking.
 * Looks up the vendor's user_id from the booking's service.
 */
export async function notifyVendorForBooking(bookingId: number, message: string): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT v.user_id
     FROM bookings b
     JOIN services s ON s.id = b.service_id
     JOIN vendors v ON v.id = s.vendor_id
     WHERE b.id = $1`,
    [bookingId]
  );
  if (rows.length > 0) {
    await createNotification(rows[0].user_id, message);
  }
}

/**
 * Helper: send notification to the customer who owns a booking.
 */
export async function notifyCustomerForBooking(bookingId: number, message: string): Promise<void> {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT customer_id FROM bookings WHERE id = $1`,
    [bookingId]
  );
  if (rows.length > 0) {
    await createNotification(rows[0].customer_id, message);
  }
}
