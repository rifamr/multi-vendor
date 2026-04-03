import { getPool } from "./pool";
import { chatGetAdminStats } from "./chatbot";

export interface RetrievedService {
  id: number;
  vendor_id: number;
  title: string;
  description: string;
  price: number;
  vendor_name: string;
  category_name: string;
  rating: number;
  review_count: number;
}

export interface AvailabilitySlot {
  id: number;
  vendor_id: number;
  vendor_name: string;
  service_title: string;
  slot_date: string;
  start_time: string;
  end_time: string;
}

export interface UserBooking {
  id: number;
  service_title: string;
  vendor_name: string;
  status: string;
  booking_date: string;
  slot_date: string;
  start_time: string;
  price: number;
}

export interface FAQ {
  question: string;
  answer: string;
}

/**
 * Retrieve relevant services based on keyword search
 */
export async function retrieveRelevantServices(
  query: string
): Promise<RetrievedService[]> {
  const pool = getPool();
  const searchTerm = `%${query}%`;

  try {
    const result = await pool.query(
      `
      SELECT
        s.id,
        s.vendor_id,
        s.title,
        s.description,
        s.price,
        v.business_name AS vendor_name,
        sc.name AS category_name,
        COALESCE(AVG(r.rating)::numeric, 0) AS rating,
        COUNT(r.id)::integer AS review_count
      FROM services s
      JOIN vendors v ON s.vendor_id = v.id
      LEFT JOIN service_categories sc ON s.service_category_id = sc.id
      LEFT JOIN reviews r ON r.id IN (
        SELECT r2.id FROM reviews r2
        JOIN bookings b ON r2.booking_id = b.id
        WHERE b.service_id = s.id
      )
      WHERE (
        s.title ILIKE $1
        OR s.description ILIKE $1
        OR v.business_name ILIKE $1
        OR sc.name ILIKE $1
      )
      AND s.is_active = true
      GROUP BY s.id, v.id, sc.id
      ORDER BY rating DESC, review_count DESC
      LIMIT 5
      `,
      [searchTerm]
    );

    return result.rows;
  } catch (err) {
    console.error("Error retrieving services:", err);
    return [];
  }
}

/**
 * Retrieve available time slots for vendors
 */
export async function retrieveAvailableSlots(
  vendorId?: number
): Promise<AvailabilitySlot[]> {
  const pool = getPool();

  try {
    let query = `
      SELECT
        av.id,
        av.vendor_id,
        v.business_name AS vendor_name,
        s.title AS service_title,
        av.slot_date,
        av.start_time,
        av.end_time
      FROM availability_slots av
      JOIN vendors v ON av.vendor_id = v.id
      LEFT JOIN services s ON s.vendor_id = v.id
      WHERE av.is_available = true
      AND av.slot_date >= CURRENT_DATE
      AND av.slot_date <= CURRENT_DATE + INTERVAL '30 days'
    `;

    const params: any[] = [];

    if (vendorId) {
      query += ` AND av.vendor_id = $1`;
      params.push(vendorId);
    }

    query += ` ORDER BY av.slot_date, av.start_time LIMIT 10`;

    const result = await pool.query(query, params);
    return result.rows;
  } catch (err) {
    console.error("Error retrieving availability slots:", err);
    return [];
  }
}

/**
 * Retrieve a user's booking history
 */
export async function retrieveUserBookings(
  userId: number
): Promise<UserBooking[]> {
  const pool = getPool();

  try {
    const result = await pool.query(
      `
      SELECT
        b.id,
        s.title AS service_title,
        v.business_name AS vendor_name,
        b.status,
        TO_CHAR(b.booking_date, 'Mon DD, YYYY') AS booking_date,
        TO_CHAR(av.slot_date, 'Mon DD, YYYY') AS slot_date,
        av.start_time,
        s.price
      FROM bookings b
      JOIN services s ON b.service_id = s.id
      JOIN vendors v ON s.vendor_id = v.id
      LEFT JOIN availability_slots av ON b.slot_id = av.id
      WHERE b.customer_id = $1
      ORDER BY b.booking_date DESC
      LIMIT 10
      `,
      [userId]
    );

    return result.rows;
  } catch (err) {
    console.error("Error retrieving user bookings:", err);
    return [];
  }
}

/**
 * Retrieve platform FAQs
 */
export function retrievePlatformFAQs(): FAQ[] {
  return [
    {
      question: "How do I book a service?",
      answer:
        "Browse available services, select your preferred time slot, and confirm your booking. You'll receive a confirmation email with all details.",
    },
    {
      question: "How do I cancel a booking?",
      answer:
        "Go to 'My Bookings' and click the cancel button on your booking. Cancellation policies vary by service provider.",
    },
    {
      question: "How do I reschedule my booking?",
      answer:
        "In 'My Bookings', select your booking and choose a new available time slot. The service provider will confirm the new time.",
    },
    {
      question: "How do I become a vendor?",
      answer:
        "Apply through the vendor signup page. You'll need to provide your business details and documentation. Our team will review within 2-3 business days.",
    },
    {
      question: "What payment methods do you accept?",
      answer:
        "We accept all major credit cards, debit cards, and digital wallets. Payments are processed securely through our payment gateway.",
    },
    {
      question: "How do I leave a review?",
      answer:
        "After a completed booking, you can leave a review with a star rating and comment. Reviews help other customers and build vendor reputation.",
    },
    {
      question: "How are vendors verified?",
      answer:
        "Vendors undergo identity verification and credential checks. Verified vendors display a badge on their profile.",
    },
    {
      question: "What if I'm not satisfied with a service?",
      answer:
        "Contact our support team with details. We mediate disputes and can process refunds based on service quality issues.",
    },
  ];
}

/**
 * Build RAG context string from retrieved data
 */
export function buildRAGContext(
  userQuery: string,
  services: RetrievedService[],
  slots: AvailabilitySlot[],
  bookings: UserBooking[],
  faqs: FAQ[],
  adminStats?: {
    totalUsers: number;
    totalVendors: number;
    totalBookings: number;
    totalRevenue: number;
    pendingReviews: number;
  }
): string {
  let context = `User Query: "${userQuery}"\n\n`;

  // Add admin stats if available
  if (adminStats) {
    context += "Platform Statistics (Real-time Data):\n";
    context += `- Total Users: ${adminStats.totalUsers}\n`;
    context += `- Total Vendors: ${adminStats.totalVendors}\n`;
    context += `- Total Bookings: ${adminStats.totalBookings}\n`;
    context += `- Total Revenue: ₹${adminStats.totalRevenue}\n`;
    context += `- Pending Reviews: ${adminStats.pendingReviews}\n\n`;
  }

  // Add services context
  if (services.length > 0) {
    context += "Recent Services:\n";
    services.slice(0, 3).forEach((s) => {
      context += `- ${s.title} by ${s.vendor_name} - ₹${s.price} ⭐ ${s.rating.toFixed(1)} (${s.review_count} reviews)\n`;
    });
    context += "\n";
  }

  // Add availability context
  if (slots.length > 0) {
    context += "Available Time Slots:\n";
    slots.slice(0, 3).forEach((slot) => {
      context += `- ${slot.service_title} with ${slot.vendor_name} on ${slot.slot_date} at ${slot.start_time}\n`;
    });
    context += "\n";
  }

  // Add user bookings context
  if (bookings.length > 0) {
    context += "User's Recent Bookings:\n";
    bookings.slice(0, 3).forEach((b) => {
      context += `- ${b.service_title} with ${b.vendor_name} on ${b.slot_date} at ${b.start_time} (${b.status})\n`;
    });
    context += "\n";
  }

  // Add FAQ context
  context += "Relevant FAQs:\n";
  faqs.slice(0, 3).forEach((faq) => {
    context += `Q: ${faq.question}\nA: ${faq.answer}\n\n`;
  });

  return context;
}

/**
 * Main RAG retrieval function
 */
export async function retrieveRAGContext(
  userQuery: string,
  userId?: number,
  role?: "customer" | "vendor" | "admin" | "public"
): Promise<{
  context: string;
  sources: {
    servicesCount: number;
    slotsCount: number;
    bookingsCount: number;
    faqs: number;
  };
}> {
  // Retrieve relevant data in parallel
  const [services, slots, bookings, faqs, adminStats] = await Promise.all([
    retrieveRelevantServices(userQuery),
    retrieveAvailableSlots(),
    userId ? retrieveUserBookings(userId) : Promise.resolve([]),
    Promise.resolve(retrievePlatformFAQs()),
    role === "admin" ? chatGetAdminStats() : Promise.resolve(undefined),
  ]);

  const context = buildRAGContext(userQuery, services, slots, bookings, faqs, adminStats);

  return {
    context,
    sources: {
      servicesCount: services.length,
      slotsCount: slots.length,
      bookingsCount: bookings.length,
      faqs: faqs.length,
    },
  };
}
