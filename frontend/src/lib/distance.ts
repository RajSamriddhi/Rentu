/**
 * Known geographic coordinates for Bangalore localities and metro hubs.
 * Used for accurate geocoding when latitude/longitude are not explicitly saved.
 */
export const LOCALITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'beml': { lat: 12.9140, lon: 77.4993 },
  'beml layout': { lat: 12.9140, lon: 77.4993 },
  'beml layout 7th phase': { lat: 12.9140, lon: 77.4993 },
  'mylasandra': { lat: 12.8850, lon: 77.5050 },
  'mailasandra': { lat: 12.8850, lon: 77.5050 },
  'kengeri': { lat: 12.9177, lon: 77.4838 },
  'kengeri satellite town': { lat: 12.9177, lon: 77.4838 },
  'rajarajeshwari nagar': { lat: 12.9275, lon: 77.5150 },
  'rr nagar': { lat: 12.9275, lon: 77.5150 },
  'jayanagar': { lat: 12.9308, lon: 77.5838 },
  'koramangala': { lat: 12.9352, lon: 77.6245 },
  'indiranagar': { lat: 12.9784, lon: 77.6408 },
  'hsr layout': { lat: 12.9121, lon: 77.6446 },
  'hsr': { lat: 12.9121, lon: 77.6446 },
  'whitefield': { lat: 12.9698, lon: 77.7500 },
  'electronic city': { lat: 12.8452, lon: 77.6602 },
  'bellandur': { lat: 12.9304, lon: 77.6784 },
  'marathahalli': { lat: 12.9591, lon: 77.6974 },
  'banashankari': { lat: 12.9255, lon: 77.5468 },
  'jp nagar': { lat: 12.9063, lon: 77.5857 },
  'malleshwaram': { lat: 12.9982, lon: 77.5684 },
  'hebbal': { lat: 13.0358, lon: 77.5970 },
  'saket': { lat: 28.5244, lon: 77.2167 },
  'hauz khas': { lat: 28.5494, lon: 77.2001 },
  'connaught place': { lat: 28.6315, lon: 77.2167 },
};

/**
 * Resolves latitude and longitude from explicit coords or known locality string
 */
export function resolveCoords(
  lat?: number | null,
  lon?: number | null,
  locality?: string | null
): { lat: number; lon: number } | null {
  if (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    !isNaN(lat) &&
    !isNaN(lon) &&
    lat !== 0 &&
    lon !== 0
  ) {
    return { lat, lon };
  }

  if (locality) {
    const locLower = locality.toLowerCase().trim();
    for (const [key, coords] of Object.entries(LOCALITY_COORDINATES)) {
      if (locLower.includes(key)) {
        return coords;
      }
    }
  }

  return null;
}

/**
 * Computes exact Haversine distance in kilometers between two geo-coordinates
 */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Computes exact distance in meters between user and item/request.
 */
export function getReachDistanceMeters(
  item: {
    distance_meters?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
    id?: string;
  },
  user?: {
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
  } | null
): number | null {
  // 1. If backend provided exact Haversine distance_meters
  if (
    typeof item.distance_meters === 'number' &&
    !isNaN(item.distance_meters) &&
    item.distance_meters >= 0 &&
    item.distance_meters < 5000000
  ) {
    return Math.round(item.distance_meters);
  }

  // 2. Resolve coordinates
  let userCoords = resolveCoords(user?.latitude, user?.longitude, user?.locality);

  // Check client-side cached location in localStorage if profile coords are not yet populated
  if (!userCoords && typeof window !== 'undefined') {
    try {
      const stored = localStorage.getItem('rentu_user_location');
      if (stored) {
        const parsed = JSON.parse(stored);
        userCoords = resolveCoords(parsed.latitude, parsed.longitude, parsed.locality);
      }
    } catch {}
  }

  const itemCoords = resolveCoords(item.latitude, item.longitude, item.locality);

  if (userCoords && itemCoords) {
    const km = haversineDistanceKm(userCoords.lat, userCoords.lon, itemCoords.lat, itemCoords.lon);
    return Math.round(km * 1000);
  }

  // 3. Locality proximity matching fallback
  const itemLoc = (item.locality || '').toLowerCase().trim();
  const userLoc = (user?.locality || '').toLowerCase().trim();

  if (itemLoc && userLoc) {
    if (itemLoc === userLoc || itemLoc.includes(userLoc) || userLoc.includes(itemLoc)) {
      return 500;
    }
    // Same city fallback
    if (
      (itemLoc.includes('bengaluru') || itemLoc.includes('bangalore')) &&
      (userLoc.includes('bengaluru') || userLoc.includes('bangalore'))
    ) {
      return 2000;
    }
  }

  return null;
}

/**
 * Calculates numeric distance in km (for filter ranges)
 */
export function getReachDistanceKm(
  item: {
    distance_meters?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
    id?: string;
  },
  user?: {
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
  } | null
): number {
  const meters = getReachDistanceMeters(item, user);
  if (meters === null) return 2.0;
  return Number((meters / 1000).toFixed(2));
}

/**
 * Formats distance into clean user-facing distance text:
 * - If <= 100m: "Within ~100 m"
 * - If < 1000m: "Within ~350 m", "Within ~500 m"
 * - If >= 1000m: "Within ~1.2 km", "Within ~2 km"
 */
export function formatDistanceString(totalMeters: number): string {
  if (totalMeters <= 100) {
    return 'Within ~100 m';
  }

  const roundedMeters = Math.round(totalMeters / 50) * 50;
  if (roundedMeters < 1000) {
    return `Within ~${roundedMeters} m`;
  }

  const km = roundedMeters / 1000;
  const formattedKm = Number(km.toFixed(1));
  return `Within ~${formattedKm} km`;
}

/**
 * Formats reach distance into clean user-facing string strictly indicating distance:
 * e.g. "Within ~500 m", "Within ~1.2 km", "Within ~2 km".
 * Privacy Rule: UNDER NO CIRCUMSTANCES is anyone's physical location/locality shown publicly.
 */
export function getReachDistance(
  item: {
    distance_meters?: number | null;
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
    id?: string;
    owner_id?: string;
  },
  user?: {
    id?: string;
    latitude?: number | null;
    longitude?: number | null;
    locality?: string | null;
  } | null
): string {
  // If the viewing user is the item owner
  if (user?.id && item.owner_id && String(user.id) === String(item.owner_id)) {
    return 'Within ~100 m (Your Gear)';
  }

  const meters = getReachDistanceMeters(item, user);
  if (meters !== null) {
    return formatDistanceString(meters);
  }

  // Privacy protection: Never expose raw locality/address publicly!
  return 'Within ~2 km';
}
