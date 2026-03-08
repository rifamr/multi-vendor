import type { Resolvers } from "./types.generated";
import { categories, vendors, services, reviews } from "./data";
import { getPoolOptional } from "./db/pool";
import { getServiceReviews, getServiceRatingStats } from "./db/reviews";
import { servicesCache, categoriesCache } from "./db/cache";

// Pre-compute lookup maps for O(1) access instead of O(n) array searches
const categoryMap = new Map(categories.map(c => [c.id, c]));
const vendorMap = new Map(vendors.map(v => [v.id, v]));

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
  vendor_shop_image_url: string | null;
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

// Cached rating stats during resolver execution to avoid repeated calculations
let ratingStatsCache: Map<string, { avg: number; count: number }> | null = null;

function getInMemoryRatingStats(serviceId: string): { avg: number; count: number } {
  // Use cache if available (within same resolver execution)
  if (ratingStatsCache?.has(serviceId)) {
    return ratingStatsCache.get(serviceId)!;
  }

  const r = reviews.filter((x) => x.serviceId === serviceId);
  const stats = r.length === 0 
    ? { avg: 0, count: 0 }
    : { 
        avg: Math.round((r.reduce((acc, x) => acc + x.rating, 0) / r.length) * 10) / 10, 
        count: r.length 
      };

  if (ratingStatsCache) {
    ratingStatsCache.set(serviceId, stats);
  }

  return stats;
}

async function dbGetCategories() {
  // Check cache first
  const cached = categoriesCache.get('all_categories');
  if (cached) {
    return cached;
  }

  const pool = getPoolOptional();
  if (!pool) return null;
  
  try {
    const result = await pool.query<{ id: string; name: string }>(
      "SELECT id::text AS id, name FROM service_categories ORDER BY id ASC"
    );
    
    // Cache the result
    categoriesCache.set('all_categories', result.rows);
    
    return result.rows;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("DB categories query failed; falling back to in-memory data.", err);
    }
    return null;
  }
}

async function dbGetServiceById(id: string): Promise<DbServiceRow | null> {
  // Validate input
  if (!id || isNaN(Number(id))) {
    return null;
  }

  // Check cache first
  const cacheKey = `service_${id}`;
  const cached = servicesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

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
        v.shop_image_url AS vendor_shop_image_url,
        COALESCE(rs.rating_avg, 0)::float AS rating_avg,
        COALESCE(rs.reviews_count, 0)::int AS reviews_count
      FROM services s
      JOIN service_categories sc ON sc.id = s.category_id
      JOIN vendors v ON v.id = s.vendor_id
      LEFT JOIN (
        SELECT
          b.service_id,
          AVG(r.rating)::float AS rating_avg,
          COUNT(r.id)::int AS reviews_count
        FROM bookings b
        INNER JOIN reviews r ON r.booking_id = b.id
        GROUP BY b.service_id
      ) rs ON rs.service_id = s.id
      WHERE s.id = $1::int
      `,
      [id]
    );

    const service = result.rows[0] ?? null;
    
    // Cache the result
    if (service) {
      servicesCache.set(cacheKey, service);
    }

    return service;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("DB service query failed; falling back to in-memory data.", err);
    }
    return null;
  }
}

async function dbGetServices(args: { filter?: any; sort?: any; limit?: number; offset?: number }): Promise<DbServiceRow[] | null> {
  // Generate cache key from args
  const cacheKey = `services_${JSON.stringify(args)}`;
  const cached = servicesCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const pool = getPoolOptional();
  if (!pool) return null;

  const { filter, sort } = args;
  const where: string[] = ["COALESCE(s.is_active, true) = true"];
  const values: Array<string | number> = [];

  // Validate and sanitize filters
  if (filter?.categoryId) {
    const catId = Number(filter.categoryId);
    if (!isNaN(catId) && catId > 0) {
      values.push(catId);
      where.push(`s.category_id = $${values.length}::int`);
    }
  }

  const searchTerm = filter?.search ? String(filter.search).trim() : null;
  if (searchTerm && searchTerm.length > 0 && searchTerm.length < 200) {
    const q = `%${searchTerm}%`;
    values.push(q);
    where.push(
      `(s.title ILIKE $${values.length} OR s.description ILIKE $${values.length} OR v.business_name ILIKE $${values.length})`
    );
  }

  if (typeof filter?.minPrice === "number" && filter.minPrice >= 0) {
    values.push(filter.minPrice);
    where.push(`s.price >= $${values.length}`);
  }

  if (typeof filter?.maxPrice === "number" && filter.maxPrice >= 0) {
    values.push(filter.maxPrice);
    where.push(`s.price <= $${values.length}`);
  }

  if (typeof filter?.minRating === "number" && filter.minRating >= 0 && filter.minRating <= 5) {
    values.push(filter.minRating);
    where.push(`COALESCE(rs.rating_avg, 0) >= $${values.length}`);
  }

  const locationTerm = filter?.location ? String(filter.location).trim() : null;
  if (locationTerm && locationTerm.length > 0 && locationTerm.length < 100) {
    const loc = `%${locationTerm}%`;
    values.push(loc);
    where.push(`v.city ILIKE $${values.length}`);
  }

  let orderBy = "ORDER BY s.id ASC";
  const validSortTypes = ["PRICE_ASC", "PRICE_DESC", "RATING_DESC", "RELEVANCE"];
  const sortType = validSortTypes.includes(sort) ? sort : "RELEVANCE";
  
  switch (sortType) {
    case "PRICE_ASC":
      orderBy = "ORDER BY s.price ASC NULLS LAST, s.id ASC";
      break;
    case "PRICE_DESC":
      orderBy = "ORDER BY s.price DESC NULLS LAST, s.id ASC";
      break;
    case "RATING_DESC":
      orderBy = "ORDER BY COALESCE(rs.rating_avg, 0) DESC, s.id ASC";
      break;
    case "RELEVANCE":
    default:
      orderBy = "ORDER BY COALESCE(rs.rating_avg, 0) DESC, s.id ASC";
      break;
  }

  // Validate and apply pagination
  const limit = args.limit ? Math.min(Math.max(parseInt(String(args.limit), 10), 1), 100) : 50;
  const offset = args.offset ? Math.max(parseInt(String(args.offset), 10), 0) : 0;
  const pagination = `LIMIT ${limit} OFFSET ${offset}`;

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
      v.shop_image_url AS vendor_shop_image_url,
      COALESCE(rs.rating_avg, 0)::float AS rating_avg,
      COALESCE(rs.reviews_count, 0)::int AS reviews_count
    FROM services s
    JOIN service_categories sc ON sc.id = s.category_id
    JOIN vendors v ON v.id = s.vendor_id
    LEFT JOIN (
      SELECT
        b.service_id,
        AVG(r.rating)::float AS rating_avg,
        COUNT(r.id)::int AS reviews_count
      FROM bookings b
      INNER JOIN reviews r ON r.booking_id = b.id
      GROUP BY b.service_id
    ) rs ON rs.service_id = s.id
    WHERE ${where.join(" AND ")}
    ${orderBy}
    ${pagination}
  `;

  try {
    const result = await pool.query<DbServiceRow>(sql, values);
    
    // Cache the result
    servicesCache.set(cacheKey, result.rows);
    
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.log("[dbGetServices] Services found:", result.rows.length);
    }
    return result.rows;
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      // eslint-disable-next-line no-console
      console.warn("DB services query failed; falling back to in-memory data.", err);
    }
    return null;
  }
}

export const resolvers: any = {
  Query: {
    categories: async () => (await dbGetCategories()) ?? categories,

    services: async (_parent: any, args: any) => {
      const { filter, sort, limit, offset } = args;

      try {
        const dbRows = await dbGetServices({ filter, sort, limit, offset });
        if (dbRows) return dbRows;
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("[services resolver] Database query error:", err);
        }
        // Fall through to in-memory fallback
      }

      // For in-memory fallback, initialize cache and populate with all service stats
      ratingStatsCache = new Map();
      
      let list = services.filter((s) => s.active);

      if (filter?.categoryId) {
        list = list.filter((s) => s.categoryId === filter.categoryId);
      }

      if (filter?.search && filter.search.trim().length > 0) {
        const q = filter.search.trim().toLowerCase();
        list = list.filter((s) => {
          const vendor = vendorMap.get(s.vendorId);
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
        const minRating = filter.minRating;
        list = list.filter((s) => getInMemoryRatingStats(s.id).avg >= minRating);
      }

      const withStats = list.map((s) => {
        const stats = getInMemoryRatingStats(s.id);
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

      // Apply pagination
      const limitVal = limit ? Math.min(Math.max(parseInt(String(limit), 10), 1), 100) : 50;
      const offsetVal = offset ? Math.max(parseInt(String(offset), 10), 0) : 0;
      const paginatedStats = withStats.slice(offsetVal, offsetVal + limitVal);

      const result = paginatedStats.map(({ s }) => s);
      ratingStatsCache = null; // Clear cache after resolver completes
      return result;
    },

    service: async (_parent: any, args: any) => {
      try {
        const dbService = await dbGetServiceById(args.id);
        if (dbService) return dbService;
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("[service resolver] Database query error:", err);
        }
      }
      
      // Fallback to in-memory data
      return services.find((s) => s.id === args.id) ?? null;
    },

    serviceReviews: async (_parent: any, args: any) => {
      try {
        const reviewList = await getServiceReviews({ serviceId: Number(args.serviceId) });
        return reviewList.map((r: any) => ({
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
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("[serviceReviews resolver] Error:", err);
        }
        return [];
      }
    },

    serviceRatingStats: async (_parent: any, args: any) => {
      try {
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
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("[serviceRatingStats resolver] Error:", err);
        }
        // Return default stats on error
        return {
          serviceId: args.serviceId,
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: [],
        };
      }
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
        // Combined single query for stats + recent reviews
        const result = await pool.query(`
          WITH review_stats AS (
            SELECT
              COUNT(*)::int as total_reviews,
              COALESCE(AVG(rating), 0)::float as average_rating,
              COUNT(CASE WHEN moderation_status = 'pending' THEN 1 END)::int as pending_reviews,
              COUNT(CASE WHEN moderation_status = 'approved' THEN 1 END)::int as approved_reviews,
              COUNT(CASE WHEN moderation_status = 'rejected' THEN 1 END)::int as rejected_reviews
            FROM reviews
          ),
          recent_reviews AS (
            SELECT 
              r.id, r.booking_id, r.customer_id, r.service_id, r.rating, r.comment,
              r.moderation_status, r.created_at,
              u.name as customer_name,
              ROW_NUMBER() OVER (ORDER BY r.created_at DESC) as rn
            FROM reviews r
            LEFT JOIN users u ON u.id = r.customer_id
          )
          SELECT
            rs.total_reviews,
            rs.average_rating,
            rs.pending_reviews,
            rs.approved_reviews,
            rs.rejected_reviews,
            rr.id as recent_id,
            rr.booking_id,
            rr.customer_id,
            rr.service_id,
            rr.rating,
            rr.comment,
            rr.moderation_status,
            rr.created_at,
            rr.customer_name
          FROM review_stats rs
          LEFT JOIN recent_reviews rr ON rr.rn <= 10
          ORDER BY rr.created_at DESC NULLS LAST
        `);

        if (result.rows.length === 0) {
          return {
            totalReviews: 0,
            averageRating: 0,
            pendingReviews: 0,
            approvedReviews: 0,
            rejectedReviews: 0,
            recentReviews: [],
          };
        }

        // Extract stats from first row
        const stats = result.rows[0];

        // Extract recent reviews (filter out null rows)
        const recentReviews = result.rows
          .filter(r => r.recent_id !== null)
          .map((r) => ({
            id: r.recent_id.toString(),
            bookingId: r.booking_id,
            customerId: r.customer_id,
            customerName: r.customer_name || "Anonymous",
            serviceId: r.service_id,
            rating: r.rating,
            comment: r.comment,
            moderationStatus: r.moderation_status,
            createdAt: r.created_at.toISOString(),
          }));

        return {
          totalReviews: stats.total_reviews,
          averageRating: stats.average_rating,
          pendingReviews: stats.pending_reviews,
          approvedReviews: stats.approved_reviews,
          rejectedReviews: stats.rejected_reviews,
          recentReviews,
        };
      } catch (err) {
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.error("[reviewAnalytics] Error:", err);
        }
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
      const c = categoryMap.get(parent.categoryId);
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
          shopImageUrl: parent.vendor_shop_image_url ?? null,
        };
      }
      const v = vendorMap.get(parent.vendorId);
      if (!v) throw new Error(`Vendor not found for service ${parent.id}`);
      return v;
    },
    rating: (parent: any) => {
      if (typeof parent.rating_avg === "number") return parent.rating_avg;
      return getInMemoryRatingStats(parent.id).avg;
    },
    reviews: (parent: any) => {
      if (typeof parent.reviews_count === "number") return parent.reviews_count;
      return getInMemoryRatingStats(parent.id).count;
    },
  },
};
