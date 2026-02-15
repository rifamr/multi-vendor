import { getPool } from "./pool";

export type ReviewModerationStatus = "pending" | "approved" | "rejected";

export interface Review {
  id: number;
  bookingId: number;
  customerId: number;
  serviceId: number;
  rating: number;
  comment: string | null;
  moderationStatus: ReviewModerationStatus;
  createdAt: string;
  customerName?: string;
  serviceTitle?: string;
}

export interface ReviewStats {
  serviceId: number;
  averageRating: number;
  totalReviews: number;
  ratingDistribution: {
    rating: number;
    count: number;
  }[];
}

/**
 * Create a new review for a completed booking
 */
export async function createReview(params: {
  bookingId: number;
  customerId: number;
  serviceId: number;
  rating: number;
  comment?: string;
}): Promise<Review> {
  const pool = getPool();

  // Verify booking exists, is completed, and belongs to the customer
  const bookingCheck = await pool.query(
    `SELECT b.id, b.customer_id, b.service_id, b.status
     FROM bookings b
     WHERE b.id = $1`,
    [params.bookingId]
  );

  if (bookingCheck.rows.length === 0) {
    throw new Error("Booking not found");
  }

  const booking = bookingCheck.rows[0];

  if (booking.customer_id !== params.customerId) {
    throw new Error("Unauthorized: booking does not belong to this customer");
  }

  if (booking.status !== "completed") {
    throw new Error("Cannot review: booking is not completed");
  }

  // Check if review already exists for this booking
  const existingReview = await pool.query(
    `SELECT id FROM reviews WHERE booking_id = $1`,
    [params.bookingId]
  );

  if (existingReview.rows.length > 0) {
    throw new Error("Review already exists for this booking");
  }

  // Create the review
  const result = await pool.query(
    `INSERT INTO reviews (booking_id, customer_id, service_id, rating, comment, moderation_status, created_at)
     VALUES ($1, $2, $3, $4, $5, 'approved', NOW())
     RETURNING id, booking_id as "bookingId", customer_id as "customerId", 
               service_id as "serviceId", rating, comment, 
               moderation_status as "moderationStatus", created_at as "createdAt"`,
    [params.bookingId, params.customerId, params.serviceId, params.rating, params.comment || null]
  );

  return result.rows[0];
}

/**
 * Get reviews for a specific service (approved only by default)
 */
export async function getServiceReviews(params: {
  serviceId: number;
  includeAll?: boolean;
}): Promise<Review[]> {
  const pool = getPool();

  const query = params.includeAll
    ? `SELECT r.id, r.booking_id as "bookingId", r.customer_id as "customerId", 
              r.service_id as "serviceId", r.rating, r.comment, 
              r.moderation_status as "moderationStatus", r.created_at as "createdAt",
              u.name as "customerName"
       FROM reviews r
       JOIN users u ON u.id = r.customer_id
       WHERE r.service_id = $1
       ORDER BY r.created_at DESC`
    : `SELECT r.id, r.booking_id as "bookingId", r.customer_id as "customerId", 
              r.service_id as "serviceId", r.rating, r.comment, 
              r.moderation_status as "moderationStatus", r.created_at as "createdAt",
              u.name as "customerName"
       FROM reviews r
       JOIN users u ON u.id = r.customer_id
       WHERE r.service_id = $1 AND r.moderation_status = 'approved'
       ORDER BY r.created_at DESC`;

  const result = await pool.query(query, [params.serviceId]);
  return result.rows;
}

/**
 * Get all reviews (for admin moderation)
 */
export async function getAllReviews(params: {
  status?: ReviewModerationStatus;
  limit?: number;
}): Promise<Review[]> {
  const pool = getPool();

  const values: any[] = [];
  let whereClause = "";

  if (params.status) {
    values.push(params.status);
    whereClause = `WHERE r.moderation_status = $1`;
  }

  const limit = params.limit || 100;
  values.push(limit);

  const query = `
    SELECT r.id, r.booking_id as "bookingId", r.customer_id as "customerId", 
           r.service_id as "serviceId", r.rating, r.comment, 
           r.moderation_status as "moderationStatus", r.created_at as "createdAt",
           u.name as "customerName",
           s.title as "serviceTitle"
    FROM reviews r
    JOIN users u ON u.id = r.customer_id
    JOIN services s ON s.id = r.service_id
    ${whereClause}
    ORDER BY r.created_at DESC
    LIMIT $${values.length}
  `;

  const result = await pool.query(query, values);
  return result.rows;
}

/**
 * Update review moderation status (admin only)
 */
export async function updateReviewStatus(params: {
  reviewId: number;
  status: ReviewModerationStatus;
}): Promise<Review> {
  const pool = getPool();

  const result = await pool.query(
    `UPDATE reviews
     SET moderation_status = $1
     WHERE id = $2
     RETURNING id, booking_id as "bookingId", customer_id as "customerId", 
               service_id as "serviceId", rating, comment, 
               moderation_status as "moderationStatus", created_at as "createdAt"`,
    [params.status, params.reviewId]
  );

  if (result.rows.length === 0) {
    throw new Error("Review not found");
  }

  return result.rows[0];
}

/**
 * Delete a review (admin only)
 */
export async function deleteReview(reviewId: number): Promise<void> {
  const pool = getPool();
  await pool.query(`DELETE FROM reviews WHERE id = $1`, [reviewId]);
}

/**
 * Calculate average rating and stats for a service
 */
export async function getServiceRatingStats(serviceId: number): Promise<ReviewStats> {
  const pool = getPool();

  // Get average rating and total count
  const statsResult = await pool.query(
    `SELECT 
      COALESCE(AVG(rating), 0)::float as "averageRating",
      COUNT(*)::int as "totalReviews"
     FROM reviews
     WHERE service_id = $1 AND moderation_status = 'approved'`,
    [serviceId]
  );

  // Get rating distribution
  const distributionResult = await pool.query(
    `SELECT rating, COUNT(*)::int as count
     FROM reviews
     WHERE service_id = $1 AND moderation_status = 'approved'
     GROUP BY rating
     ORDER BY rating DESC`,
    [serviceId]
  );

  return {
    serviceId,
    averageRating: statsResult.rows[0].averageRating,
    totalReviews: statsResult.rows[0].totalReviews,
    ratingDistribution: distributionResult.rows,
  };
}

/**
 * Get rating stats for multiple services efficiently
 */
export async function getBulkServiceRatingStats(serviceIds: number[]): Promise<Map<number, ReviewStats>> {
  if (serviceIds.length === 0) {
    return new Map();
  }

  const pool = getPool();

  const result = await pool.query(
    `SELECT 
      service_id as "serviceId",
      COALESCE(AVG(rating), 0)::float as "averageRating",
      COUNT(*)::int as "totalReviews"
     FROM reviews
     WHERE service_id = ANY($1) AND moderation_status = 'approved'
     GROUP BY service_id`,
    [serviceIds]
  );

  const statsMap = new Map<number, ReviewStats>();

  // Initialize all services with zero stats
  serviceIds.forEach((id) => {
    statsMap.set(id, {
      serviceId: id,
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: [],
    });
  });

  // Update with actual stats
  result.rows.forEach((row: any) => {
    statsMap.set(row.serviceId, {
      serviceId: row.serviceId,
      averageRating: row.averageRating,
      totalReviews: row.totalReviews,
      ratingDistribution: [],
    });
  });

  return statsMap;
}

/**
 * Check if a booking can be reviewed
 */
export async function canReviewBooking(params: {
  bookingId: number;
  customerId: number;
}): Promise<{ canReview: boolean; reason?: string }> {
  const pool = getPool();

  // Check booking status
  const bookingResult = await pool.query(
    `SELECT status, customer_id FROM bookings WHERE id = $1`,
    [params.bookingId]
  );

  if (bookingResult.rows.length === 0) {
    return { canReview: false, reason: "Booking not found" };
  }

  const booking = bookingResult.rows[0];

  if (booking.customer_id !== params.customerId) {
    return { canReview: false, reason: "Not your booking" };
  }

  if (booking.status !== "completed") {
    return { canReview: false, reason: "Booking not completed" };
  }

  // Check if already reviewed
  const reviewResult = await pool.query(
    `SELECT id FROM reviews WHERE booking_id = $1`,
    [params.bookingId]
  );

  if (reviewResult.rows.length > 0) {
    return { canReview: false, reason: "Already reviewed" };
  }

  return { canReview: true };
}
