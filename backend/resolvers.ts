import type { Resolvers } from "./types.generated";
import { categories, vendors, services, reviews } from "./data";
import { getPoolOptional } from "./db/pool";

type DbServiceRow = {
  id: string;
  title: string;
  description: string;
  price: number | null;
  duration_minutes: number | null;
  active: boolean | null;
  category_id: string;
  category_name: string;
  vendor_id: string;
  vendor_name: string | null;
  vendor_area: string | null;
  rating_avg: number;
  reviews_count: number;
};

function dollarsFromCents(cents: number): number {
  return Math.round((cents / 100) * 100) / 100;
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = minutes / 60;
  if (Number.isInteger(hours)) return `${hours} hr${hours === 1 ? "" : "s"}`;
  return `${hours.toFixed(1)} hrs`;
}

function parseServiceArea(area: string | null): { city: string; region: string } {
  if (!area) return { city: "Unknown", region: "" };
  const parts = area.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length >= 2) return { city: parts[0] ?? "Unknown", region: parts[1] ?? "" };
  return { city: area.trim() || "Unknown", region: "" };
}

function getServiceRatingStats(serviceId: string): { avg: number; count: number } {
  const r = reviews.filter((x) => x.serviceId === serviceId);
  if (r.length === 0) return { avg: 0, count: 0 };
  const sum = r.reduce((acc, x) => acc + x.rating, 0);
  return { avg: Math.round((sum / r.length) * 10) / 10, count: r.length };
}

async function dbGetCategories() {
  const pool = getPoolOptional();
  if (!pool) return null;
  try {
    const result = await pool.query<{ id: string; name: string }>(
      "SELECT id::text AS id, name FROM service_categories ORDER BY id ASC"
    );
    return result.rows;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("DB categories query failed; falling back to in-memory data.", err);
    return null;
  }
}

async function dbGetServiceById(id: string): Promise<DbServiceRow | null> {
  const pool = getPoolOptional();
  if (!pool) return null;

  try {
    const result = await pool.query<DbServiceRow>(
      `
      SELECT
        s.id::text AS id,
        s.title,
        s.description,
        s.price::float AS price,
        s.duration_minutes,
        s.is_active AS active,
        s.category_id::text AS category_id,
        sc.name AS category_name,
        v.id::text AS vendor_id,
        v.business_name AS vendor_name,
        v.service_area AS vendor_area,
        COALESCE(AVG(r.rating), 0)::float AS rating_avg,
        COUNT(r.id)::int AS reviews_count
      FROM services s
      JOIN service_categories sc ON sc.id = s.category_id
      JOIN vendors v ON v.id = s.vendor_id
      LEFT JOIN bookings b ON b.service_id = s.id
      LEFT JOIN reviews r ON r.booking_id = b.id
      WHERE s.id = $1::int
      GROUP BY
        s.id, s.title, s.description, s.price, s.duration_minutes, s.is_active,
        s.category_id, sc.name,
        v.id, v.business_name, v.service_area
      `,
      [id]
    );

    return result.rows[0] ?? null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("DB service query failed; falling back to in-memory data.", err);
    return null;
  }
}

async function dbGetServices(args: { filter?: any; sort?: any }): Promise<DbServiceRow[] | null> {
  const pool = getPoolOptional();
  if (!pool) return null;

  const { filter, sort } = args;
  const where: string[] = ["COALESCE(s.is_active, true) = true"]; 
  const values: Array<string | number> = [];

  if (filter?.categoryId) {
    values.push(Number(filter.categoryId));
    where.push(`s.category_id = $${values.length}::int`);
  }

  if (filter?.search && String(filter.search).trim().length > 0) {
    const q = `%${String(filter.search).trim()}%`;
    values.push(q);
    where.push(
      `(s.title ILIKE $${values.length} OR s.description ILIKE $${values.length} OR v.business_name ILIKE $${values.length})`
    );
  }

  if (typeof filter?.minPrice === "number") {
    values.push(filter.minPrice);
    where.push(`s.price >= $${values.length}`);
  }

  if (typeof filter?.maxPrice === "number") {
    values.push(filter.maxPrice);
    where.push(`s.price <= $${values.length}`);
  }

  const hasMinRating = typeof filter?.minRating === "number";
  let havingClause = "";
  if (hasMinRating) {
    values.push(filter.minRating);
    havingClause = `HAVING COALESCE(AVG(r.rating), 0) >= $${values.length}`;
  }

  let orderBy = "ORDER BY s.id ASC";
  switch (sort) {
    case "PRICE_ASC":
      orderBy = "ORDER BY s.price ASC NULLS LAST, s.id ASC";
      break;
    case "PRICE_DESC":
      orderBy = "ORDER BY s.price DESC NULLS LAST, s.id ASC";
      break;
    case "RATING_DESC":
      orderBy = "ORDER BY COALESCE(AVG(r.rating), 0) DESC, s.id ASC";
      break;
    case "RELEVANCE":
    default:
      // If searching, keep a stable order; otherwise default to rating.
      if (filter?.search) {
        orderBy = "ORDER BY COALESCE(AVG(r.rating), 0) DESC, s.id ASC";
      } else {
        orderBy = "ORDER BY COALESCE(AVG(r.rating), 0) DESC, s.id ASC";
      }
      break;
  }

  const sql = `
    SELECT
      s.id::text AS id,
      s.title,
      s.description,
      s.price::float AS price,
      s.duration_minutes,
      s.is_active AS active,
      s.category_id::text AS category_id,
      sc.name AS category_name,
      v.id::text AS vendor_id,
      v.business_name AS vendor_name,
      v.service_area AS vendor_area,
      COALESCE(AVG(r.rating), 0)::float AS rating_avg,
      COUNT(r.id)::int AS reviews_count
    FROM services s
    JOIN service_categories sc ON sc.id = s.category_id
    JOIN vendors v ON v.id = s.vendor_id
    LEFT JOIN bookings b ON b.service_id = s.id
    LEFT JOIN reviews r ON r.booking_id = b.id
    WHERE ${where.join(" AND ")}
    GROUP BY
      s.id, s.title, s.description, s.price, s.duration_minutes, s.is_active,
      s.category_id, sc.name,
      v.id, v.business_name, v.service_area
    ${havingClause}
    ${orderBy}
  `;

  try {
    const result = await pool.query<DbServiceRow>(sql, values);
    console.log("[dbGetServices] Services found:", result.rows.length);
    if (result.rows.length > 0) {
      console.log("[dbGetServices] Sample service:", result.rows[0]);
    }
    return result.rows;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("DB services query failed; falling back to in-memory data.", err);
    return null;
  }
}

export const resolvers: any = {
  Query: {
    categories: async () => (await dbGetCategories()) ?? categories,

    services: async (_parent: any, args: any) => {
      const { filter, sort } = args;

      const dbRows = await dbGetServices({ filter, sort });
      if (dbRows) return dbRows;

      let list = services.filter((s) => s.active);

      if (filter?.categoryId) {
        list = list.filter((s) => s.categoryId === filter.categoryId);
      }

      if (filter?.search && filter.search.trim().length > 0) {
        const q = filter.search.trim().toLowerCase();
        list = list.filter((s) => {
          const vendor = vendors.find((v) => v.id === s.vendorId);
          return (
            s.title.toLowerCase().includes(q) ||
            s.description.toLowerCase().includes(q) ||
            (vendor?.displayName.toLowerCase().includes(q) ?? false)
          );
        });
      }

      if (typeof filter?.minPrice === "number") {
        list = list.filter((s) => dollarsFromCents(s.priceCents) >= filter.minPrice!);
      }

      if (typeof filter?.maxPrice === "number") {
        list = list.filter((s) => dollarsFromCents(s.priceCents) <= filter.maxPrice!);
      }

      if (typeof filter?.minRating === "number") {
        list = list.filter((s) => getServiceRatingStats(s.id).avg >= filter.minRating!);
      }

      const withStats = list.map((s) => {
        const stats = getServiceRatingStats(s.id);
        return { s, stats };
      });

      switch (sort) {
        case "PRICE_ASC":
          withStats.sort((a, b) => a.s.priceCents - b.s.priceCents);
          break;
        case "PRICE_DESC":
          withStats.sort((a, b) => b.s.priceCents - a.s.priceCents);
          break;
        case "RATING_DESC":
          withStats.sort((a, b) => b.stats.avg - a.stats.avg);
          break;
        case "RELEVANCE":
        default:
          // If search is present, keep current order (seed data is curated). Otherwise sort by rating.
          if (!filter?.search) {
            withStats.sort((a, b) => b.stats.avg - a.stats.avg);
          }
          break;
      }

      return withStats.map(({ s }) => s);
    },

    service: async (_parent: any, args: any) => (await dbGetServiceById(args.id)) ?? (services.find((s) => s.id === args.id) ?? null),

    serviceReviews: async (_parent: any, args: any) => {
      const { getServiceReviews } = await import("./db/reviews");
      const reviews = await getServiceReviews({ serviceId: Number(args.serviceId) });
      return reviews.map((r: any) => ({
        id: r.id.toString(),
        bookingId: r.bookingId,
        customerId: r.customerId,
        customerName: r.customerName || "Anonymous",
        serviceId: r.serviceId,
        rating: r.rating,
        comment: r.comment,
        moderationStatus: r.moderationStatus,
        createdAt: r.createdAt,
      }));
    },

    serviceRatingStats: async (_parent: any, args: any) => {
      const { getServiceRatingStats } = await import("./db/reviews");
      const stats = await getServiceRatingStats(Number(args.serviceId));
      return {
        serviceId: stats.serviceId,
        averageRating: stats.averageRating,
        totalReviews: stats.totalReviews,
        ratingDistribution: stats.ratingDistribution.map((d: any) => ({
          rating: d.rating,
          count: d.count,
        })),
      };
    },

    reviewAnalytics: async () => {
      const pool = getPoolOptional();
      if (!pool) {
        return {
          totalReviews: 0,
          averageRating: 0,
          pendingReviews: 0,
          approvedReviews: 0,
          rejectedReviews: 0,
          recentReviews: [],
        };
      }

      try {
        // Get overall stats
        const statsResult = await pool.query(`
          SELECT
            COUNT(*)::int as total_reviews,
            COALESCE(AVG(rating), 0)::float as average_rating,
            COUNT(CASE WHEN moderation_status = 'pending' THEN 1 END)::int as pending_reviews,
            COUNT(CASE WHEN moderation_status = 'approved' THEN 1 END)::int as approved_reviews,
            COUNT(CASE WHEN moderation_status = 'rejected' THEN 1 END)::int as rejected_reviews
          FROM reviews
        `);

        // Get recent reviews
        const recentResult = await pool.query(`
          SELECT 
            r.id, r.booking_id, r.customer_id, r.service_id, r.rating, r.comment,
            r.moderation_status, r.created_at,
            u.name as customer_name
          FROM reviews r
          JOIN users u ON u.id = r.customer_id
          ORDER BY r.created_at DESC
          LIMIT 10
        `);

        const stats = statsResult.rows[0];

        return {
          totalReviews: stats.total_reviews,
          averageRating: stats.average_rating,
          pendingReviews: stats.pending_reviews,
          approvedReviews: stats.approved_reviews,
          rejectedReviews: stats.rejected_reviews,
          recentReviews: recentResult.rows.map((r) => ({
            id: r.id.toString(),
            bookingId: r.booking_id,
            customerId: r.customer_id,
            customerName: r.customer_name || "Anonymous",
            serviceId: r.service_id,
            rating: r.rating,
            comment: r.comment,
            moderationStatus: r.moderation_status,
            createdAt: r.created_at.toISOString(),
          })),
        };
      } catch (err) {
        console.error("[reviewAnalytics] Error:", err);
        return {
          totalReviews: 0,
          averageRating: 0,
          pendingReviews: 0,
          approvedReviews: 0,
          rejectedReviews: 0,
          recentReviews: [],
        };
      }
    },
  },

  Service: {
    price: (parent: any) => {
      if (typeof parent.price === "number") return parent.price;
      if (typeof parent.priceCents === "number") return dollarsFromCents(parent.priceCents);
      return 0;
    },
    duration: (parent: any) => {
      if (typeof parent.duration_minutes === "number") return formatDuration(parent.duration_minutes);
      if (typeof parent.durationMinutes === "number") return formatDuration(parent.durationMinutes);
      return "";
    },
    image: (parent: any) => parent.image ?? parent.imageUrl ?? "/placeholder.svg",
    category: (parent: any) => {
      if (parent.category_id && parent.category_name) {
        return { id: parent.category_id, name: parent.category_name };
      }
      const c = categories.find((x) => x.id === parent.categoryId);
      if (!c) throw new Error(`Category not found for service ${parent.id}`);
      return c;
    },
    vendor: (parent: any) => {
      if (parent.vendor_id) {
        const { city, region } = parseServiceArea(parent.vendor_area ?? null);
        return {
          id: parent.vendor_id,
          displayName: parent.vendor_name ?? "",
          city,
          region,
        };
      }
      const v = vendors.find((x) => x.id === parent.vendorId);
      if (!v) throw new Error(`Vendor not found for service ${parent.id}`);
      return v;
    },
    rating: (parent: any) => {
      if (typeof parent.rating_avg === "number") return parent.rating_avg;
      return getServiceRatingStats(parent.id).avg;
    },
    reviews: (parent: any) => {
      if (typeof parent.reviews_count === "number") return parent.reviews_count;
      return getServiceRatingStats(parent.id).count;
    },
  },
};
