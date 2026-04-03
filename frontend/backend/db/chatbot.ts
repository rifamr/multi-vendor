import { getPool } from "./pool";

// ========== CHATBOT DB QUERIES ==========
// These functions power the chatbot's data-driven responses.

/**
 * Get a summary of a customer's bookings grouped by status.
 */
export async function chatGetCustomerBookingSummary(
    customerId: number
): Promise<{ total: number; pending: number; accepted: number; completed: number; cancelled: number }> {
    const pool = getPool();
    const { rows } = await pool.query<{
        total: string;
        pending: string;
        accepted: string;
        completed: string;
        cancelled: string;
    }>(
        `SELECT
       COUNT(*)::int AS total,
       COUNT(*) FILTER (WHERE status = 'pending')::int AS pending,
       COUNT(*) FILTER (WHERE status = 'accepted')::int AS accepted,
       COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
       COUNT(*) FILTER (WHERE status IN ('cancelled', 'declined'))::int AS cancelled
     FROM bookings
     WHERE customer_id = $1`,
        [customerId]
    );
    const r = rows[0];
    return {
        total: Number(r?.total ?? 0),
        pending: Number(r?.pending ?? 0),
        accepted: Number(r?.accepted ?? 0),
        completed: Number(r?.completed ?? 0),
        cancelled: Number(r?.cancelled ?? 0),
    };
}

/**
 * Get a summary of a vendor's bookings (using vendor user_id, NOT vendors.id).
 */
export async function chatGetVendorBookingSummary(
    vendorUserId: number
): Promise<{ total: number; pending: number; accepted: number; completed: number }> {
    const pool = getPool();
    const { rows } = await pool.query<{
        total: string;
        pending: string;
        accepted: string;
        completed: string;
    }>(
        `SELECT
       COUNT(b.id)::int AS total,
       COUNT(b.id) FILTER (WHERE b.status = 'pending')::int AS pending,
       COUNT(b.id) FILTER (WHERE b.status = 'accepted')::int AS accepted,
       COUNT(b.id) FILTER (WHERE b.status = 'completed')::int AS completed
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     JOIN vendors v ON s.vendor_id = v.id
     WHERE v.user_id = $1`,
        [vendorUserId]
    );
    const r = rows[0];
    return {
        total: Number(r?.total ?? 0),
        pending: Number(r?.pending ?? 0),
        accepted: Number(r?.accepted ?? 0),
        completed: Number(r?.completed ?? 0),
    };
}

/**
 * Get vendor's recent bookings list (last 5).
 */
export async function chatGetVendorRecentBookings(
    vendorUserId: number,
    limit = 5
): Promise<{ id: number; serviceTitle: string; customerName: string; status: string; date: string }[]> {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT b.id, s.title AS service_title, u.name AS customer_name,
            b.status, b.booking_date::text AS date
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     JOIN vendors v ON s.vendor_id = v.id
     JOIN users u ON b.customer_id = u.id
     WHERE v.user_id = $1
     ORDER BY b.booking_date DESC NULLS LAST
     LIMIT $2`,
        [vendorUserId, limit]
    );
    return rows.map((r: any) => ({
        id: r.id,
        serviceTitle: r.service_title ?? "Untitled",
        customerName: r.customer_name ?? "Customer",
        status: r.status ?? "pending",
        date: r.date ?? "",
    }));
}

/**
 * Get vendor's earnings summary.
 */
export async function chatGetVendorEarnings(
    vendorUserId: number
): Promise<{ totalEarnings: number; thisMonthEarnings: number; pendingPayout: number }> {
    const pool = getPool();

    const { rows } = await pool.query<{
        total_earnings: string | null;
        this_month: string | null;
        pending_payout: string | null;
    }>(
        `SELECT
       COALESCE(SUM(s.price) FILTER (WHERE b.status IN ('accepted','completed')), 0) AS total_earnings,
       COALESCE(SUM(s.price) FILTER (
         WHERE b.status IN ('accepted','completed')
           AND DATE_TRUNC('month', b.booking_date) = DATE_TRUNC('month', CURRENT_DATE)
       ), 0) AS this_month,
       COALESCE(SUM(p.amount) FILTER (WHERE p.payment_status = 'success'), 0) AS pending_payout
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     JOIN vendors v ON s.vendor_id = v.id
     LEFT JOIN payments p ON p.booking_id = b.id
     WHERE v.user_id = $1`,
        [vendorUserId]
    );

    const r = rows[0];
    return {
        totalEarnings: Number(r?.total_earnings ?? 0),
        thisMonthEarnings: Number(r?.this_month ?? 0),
        pendingPayout: Number(r?.pending_payout ?? 0),
    };
}

/**
 * Get vendor's active service count.
 */
export async function chatGetVendorServiceCount(
    vendorUserId: number
): Promise<{ active: number; total: number }> {
    const pool = getPool();
    const { rows } = await pool.query<{ active: string; total: string }>(
        `SELECT
       COUNT(*) FILTER (WHERE s.is_active = true)::int AS active,
       COUNT(*)::int AS total
     FROM services s
     JOIN vendors v ON s.vendor_id = v.id
     WHERE v.user_id = $1`,
        [vendorUserId]
    );
    const r = rows[0];
    return { active: Number(r?.active ?? 0), total: Number(r?.total ?? 0) };
}

/**
 * Search services by keyword (for any role).
 */
export async function chatSearchServices(
    keyword: string,
    limit = 5
): Promise<{ id: number; title: string; price: number; vendorName: string; rating: number }[]> {
    const pool = getPool();
    const search = `%${keyword}%`;
    const { rows } = await pool.query(
        `SELECT s.id, s.title, s.price,
            COALESCE(u.name, 'Vendor') AS vendor_name,
            COALESCE(AVG(r.rating), 0) AS rating
     FROM services s
     JOIN vendors v ON s.vendor_id = v.id
     JOIN users u ON v.user_id = u.id
     LEFT JOIN reviews r ON r.service_id = s.id AND r.moderation_status = 'approved'
     WHERE s.is_active = true
       AND (s.title ILIKE $1 OR s.description ILIKE $1)
     GROUP BY s.id, s.title, s.price, u.name
     ORDER BY s.title ASC
     LIMIT $2`,
        [search, limit]
    );
    return rows.map((r: any) => ({
        id: r.id,
        title: r.title ?? "Service",
        price: Number(r.price ?? 0),
        vendorName: r.vendor_name,
        rating: Math.round(Number(r.rating ?? 0) * 10) / 10,
    }));
}

/**
 * Get admin platform stats (simplified).
 */
export async function chatGetAdminStats(): Promise<{
    totalUsers: number;
    totalVendors: number;
    totalBookings: number;
    totalRevenue: number;
    pendingReviews: number;
}> {
    const pool = getPool();

    const { rows } = await pool.query<{
        total_users: string;
        total_vendors: string;
        total_bookings: string;
        total_revenue: string | null;
        pending_reviews: string;
    }>(
        `SELECT
       (SELECT COUNT(*) FROM users WHERE role = 'customer') AS total_users,
       (SELECT COUNT(*) FROM users WHERE role = 'vendor') AS total_vendors,
       (SELECT COUNT(*) FROM bookings) AS total_bookings,
       (SELECT COALESCE(SUM(s.price), 0) FROM bookings b JOIN services s ON b.service_id = s.id WHERE b.status IN ('accepted','completed')) AS total_revenue,
       (SELECT COUNT(*) FROM reviews WHERE moderation_status = 'pending') AS pending_reviews`
    );

    const r = rows[0];
    return {
        totalUsers: Number(r?.total_users ?? 0),
        totalVendors: Number(r?.total_vendors ?? 0),
        totalBookings: Number(r?.total_bookings ?? 0),
        totalRevenue: Number(r?.total_revenue ?? 0),
        pendingReviews: Number(r?.pending_reviews ?? 0),
    };
}

/**
 * Get customer's recent bookings (last 5).
 */
export async function chatGetCustomerRecentBookings(
    customerId: number,
    limit = 5
): Promise<{ id: number; serviceTitle: string; vendorName: string; status: string; date: string }[]> {
    const pool = getPool();
    const { rows } = await pool.query(
        `SELECT b.id, s.title AS service_title,
            COALESCE(u.name, 'Vendor') AS vendor_name,
            b.status, b.booking_date::text AS date
     FROM bookings b
     JOIN services s ON b.service_id = s.id
     JOIN vendors v ON s.vendor_id = v.id
     JOIN users u ON v.user_id = u.id
     WHERE b.customer_id = $1
     ORDER BY b.booking_date DESC NULLS LAST
     LIMIT $2`,
        [customerId, limit]
    );
    return rows.map((r: any) => ({
        id: r.id,
        serviceTitle: r.service_title ?? "Service",
        vendorName: r.vendor_name ?? "Vendor",
        status: r.status ?? "pending",
        date: r.date ?? "",
    }));
}
