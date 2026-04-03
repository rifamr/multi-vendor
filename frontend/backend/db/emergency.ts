import { getPool } from "./pool";

export type EmergencyStatus = "pending" | "accepted" | "completed";

export type NearbyVendor = {
  vendorId: number;
  userId: number;
  businessName: string;
  latitude: number;
  longitude: number;
  distanceKm: number;
  rating: number;
  isAvailable: boolean;
};

export type EmergencyRequestRecord = {
  id: number;
  userId: number;
  vendorId: number | null;
  latitude: number;
  longitude: number;
  issue: string;
  status: EmergencyStatus;
  createdAt: string;
  acceptedAt: string | null;
  completedAt: string | null;
  vendorLatitude: number | null;
  vendorLongitude: number | null;
  vendorBusinessName: string | null;
  vendorPhoneNumber: string | null;
};

export type EmergencyEventType =
  | "request_created"
  | "vendor_notified"
  | "vendor_accepted"
  | "search_expanded"
  | "completed"
  | "no_vendor_found";

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

// Haversine formula for great-circle distance between two coordinates.
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

export async function createEmergencyRequest(params: {
  userId: number;
  latitude: number;
  longitude: number;
  issue: string;
}): Promise<{ id: number; status: EmergencyStatus; createdAt: string }> {
  const pool = getPool();

  const result = await pool.query<{ id: number; status: EmergencyStatus; created_at: Date }>(
    `INSERT INTO emergency_requests (user_id, latitude, longitude, issue, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING id, status, created_at`,
    [params.userId, params.latitude, params.longitude, params.issue]
  );

  const row = result.rows[0];
  if (!row) throw new Error("Failed to create emergency request");

  await logEmergencyEvent({
    emergencyRequestId: row.id,
    eventType: "request_created",
    message: "Emergency request created",
    metadata: {
      latitude: params.latitude,
      longitude: params.longitude,
      issue: params.issue,
    },
  });

  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findNearbyVendors(params: {
  latitude: number;
  longitude: number;
  radiusKm: number;
}): Promise<NearbyVendor[]> {
  const pool = getPool();

  const result = await pool.query<{
    vendor_id: number;
    user_id: number;
    business_name: string | null;
    latitude: number;
    longitude: number;
    is_verified: boolean | null;
    rating: number | null;
    is_available: boolean | null;
  }>(
    `SELECT v.id AS vendor_id,
            v.user_id,
            v.business_name,
            v.latitude,
            v.longitude,
            v.is_verified,
            COALESCE(vr.avg_rating, 0)::float AS rating,
            COALESCE(vs.is_available, false) AS is_available
     FROM vendors v
     LEFT JOIN (
       SELECT s.vendor_id, AVG(r.rating)::float AS avg_rating
       FROM services s
       INNER JOIN reviews r ON r.service_id = s.id
       GROUP BY s.vendor_id
     ) vr ON vr.vendor_id = v.id
     LEFT JOIN (
       SELECT vendor_id, BOOL_OR(COALESCE(is_available, false) = true AND slot_date >= CURRENT_DATE) AS is_available
       FROM availability_slots
       GROUP BY vendor_id
     ) vs ON vs.vendor_id = v.id
     WHERE latitude IS NOT NULL
       AND longitude IS NOT NULL
       AND COALESCE(is_verified, true) = true`
  );

  const nearby = result.rows
    .map((row) => {
      const distanceKm = haversineDistanceKm(
        params.latitude,
        params.longitude,
        row.latitude,
        row.longitude
      );

      return {
        vendorId: row.vendor_id,
        userId: row.user_id,
        businessName: row.business_name?.trim() || "Vendor",
        latitude: row.latitude,
        longitude: row.longitude,
        distanceKm,
        rating: Number(row.rating ?? 0),
        isAvailable: Boolean(row.is_available),
      };
    })
    .filter((vendor) => vendor.distanceKm <= params.radiusKm)
    .sort((a, b) => {
      if (a.distanceKm !== b.distanceKm) return a.distanceKm - b.distanceKm;
      if (a.rating !== b.rating) return b.rating - a.rating;
      if (a.isAvailable !== b.isAvailable) return Number(b.isAvailable) - Number(a.isAvailable);
      return a.vendorId - b.vendorId;
    });

  return nearby;
}

export async function acceptEmergencyRequest(params: {
  requestId: number;
  vendorId: number;
}): Promise<EmergencyRequestRecord | null> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const pending = await client.query<{ id: number; user_id: number; status: EmergencyStatus }>(
      `SELECT id, user_id, status
       FROM emergency_requests
       WHERE id = $1
       FOR UPDATE`,
      [params.requestId]
    );

    const current = pending.rows[0];
    if (!current || current.status !== "pending") {
      await client.query("ROLLBACK");
      return null;
    }

    const updateResult = await client.query<{
      id: number;
      user_id: number;
      vendor_id: number | null;
      latitude: number;
      longitude: number;
      issue: string;
      status: EmergencyStatus;
      created_at: Date;
      accepted_at: Date | null;
      completed_at: Date | null;
      vendor_latitude: number | null;
      vendor_longitude: number | null;
      vendor_business_name: string | null;
      vendor_phone_number: string | null;
    }>(
      `UPDATE emergency_requests er
       SET vendor_id = $2,
           status = 'accepted',
           accepted_at = NOW()
       FROM vendors v
       WHERE er.id = $1
         AND v.id = $2
       RETURNING er.id,
                 er.user_id,
                 er.vendor_id,
                 er.latitude,
                 er.longitude,
                 er.issue,
                 er.status,
                 er.created_at,
                 er.accepted_at,
                 er.completed_at,
                 v.latitude AS vendor_latitude,
                 v.longitude AS vendor_longitude,
                 v.business_name AS vendor_business_name,
                 v.phone_number AS vendor_phone_number`,
      [params.requestId, params.vendorId]
    );

    const acceptedRow = updateResult.rows[0];
    if (acceptedRow) {
      await client.query(
        `INSERT INTO emergency_request_events (emergency_request_id, event_type, vendor_id, message)
         VALUES ($1, 'vendor_accepted', $2, $3)`,
        [params.requestId, params.vendorId, "Vendor accepted emergency request"]
      );
    }

    await client.query("COMMIT");

    const row = acceptedRow;
    if (!row) return null;

    return {
      id: row.id,
      userId: row.user_id,
      vendorId: row.vendor_id,
      latitude: row.latitude,
      longitude: row.longitude,
      issue: row.issue,
      status: row.status,
      createdAt: row.created_at.toISOString(),
      acceptedAt: row.accepted_at ? row.accepted_at.toISOString() : null,
      completedAt: row.completed_at ? row.completed_at.toISOString() : null,
      vendorLatitude: row.vendor_latitude,
      vendorLongitude: row.vendor_longitude,
      vendorBusinessName: row.vendor_business_name,
      vendorPhoneNumber: row.vendor_phone_number,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

export async function getEmergencyRequestStatus(requestId: number): Promise<EmergencyRequestRecord | null> {
  const pool = getPool();
  const result = await pool.query<{
    id: number;
    user_id: number;
    vendor_id: number | null;
    latitude: number;
    longitude: number;
    issue: string;
    status: EmergencyStatus;
    created_at: Date;
    accepted_at: Date | null;
    completed_at: Date | null;
    vendor_latitude: number | null;
    vendor_longitude: number | null;
    vendor_business_name: string | null;
    vendor_phone_number: string | null;
  }>(
    `SELECT er.id,
            er.user_id,
            er.vendor_id,
            er.latitude,
            er.longitude,
            er.issue,
            er.status,
            er.created_at,
            er.accepted_at,
            er.completed_at,
            v.latitude AS vendor_latitude,
            v.longitude AS vendor_longitude,
                 v.business_name AS vendor_business_name,
                 v.phone_number AS vendor_phone_number
     FROM emergency_requests er
     LEFT JOIN vendors v ON v.id = er.vendor_id
     WHERE er.id = $1
     LIMIT 1`,
    [requestId]
  );

  const row = result.rows[0];
  if (!row) return null;

  return {
    id: row.id,
    userId: row.user_id,
    vendorId: row.vendor_id,
    latitude: row.latitude,
    longitude: row.longitude,
    issue: row.issue,
    status: row.status,
    createdAt: row.created_at.toISOString(),
    acceptedAt: row.accepted_at ? row.accepted_at.toISOString() : null,
    completedAt: row.completed_at ? row.completed_at.toISOString() : null,
    vendorLatitude: row.vendor_latitude,
    vendorLongitude: row.vendor_longitude,
    vendorBusinessName: row.vendor_business_name,
    vendorPhoneNumber: row.vendor_phone_number,
  };
}

export async function updateEmergencyRequestLocation(params: {
  requestId: number;
  userId: number;
  latitude: number;
  longitude: number;
}): Promise<EmergencyRequestRecord | null> {
  const pool = getPool();

  const updateResult = await pool.query<{ id: number }>(
    `UPDATE emergency_requests
     SET latitude = $3,
         longitude = $4
     WHERE id = $1
       AND user_id = $2
       AND status IN ('pending', 'accepted')
     RETURNING id`,
    [params.requestId, params.userId, params.latitude, params.longitude]
  );

  if (!updateResult.rows[0]) {
    const fallback = await getEmergencyRequestStatus(params.requestId);
    if (!fallback || fallback.userId !== params.userId || fallback.status === "completed") {
      return null;
    }
    return fallback;
  }

  return getEmergencyRequestStatus(params.requestId);
}

export async function completeEmergencyRequest(params: {
  requestId: number;
  completedByUserId: number;
  vendorId?: number;
}): Promise<EmergencyRequestRecord | null> {
  const pool = getPool();

  const result = await pool.query<{ id: number }>(
    `UPDATE emergency_requests
     SET status = 'completed',
         completed_at = NOW()
     WHERE id = $1
       AND status = 'accepted'
       AND (
         user_id = $2
         OR ($3::int IS NOT NULL AND vendor_id = $3::int)
       )
     RETURNING id`,
    [params.requestId, params.completedByUserId, params.vendorId ?? null]
  );

  if (!result.rows[0]) return null;

  await logEmergencyEvent({
    emergencyRequestId: params.requestId,
    eventType: "completed",
    vendorId: params.vendorId,
    message: "Emergency request marked as completed",
    metadata: { completedByUserId: params.completedByUserId },
  });

  return getEmergencyRequestStatus(params.requestId);
}

export async function logEmergencyEvent(params: {
  emergencyRequestId: number;
  eventType: EmergencyEventType;
  vendorId?: number | null;
  message?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const pool = getPool();
  await pool.query(
    `INSERT INTO emergency_request_events (emergency_request_id, event_type, vendor_id, message, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [
      params.emergencyRequestId,
      params.eventType,
      params.vendorId ?? null,
      params.message ?? null,
      params.metadata ? JSON.stringify(params.metadata) : null,
    ]
  );
}
