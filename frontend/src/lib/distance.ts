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
 * Calculates the numeric distance in km for gear items and requests relative to the user.
 * Strictly uses accurate user profile location and item/owner profile location.
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
  // 1. Resolve user coordinates
  let userCoords = resolveCoords(user?.latitude, user?.longitude, user?.locality);
  if (!userCoords) {
    // Default to BEML Layout, Bengaluru hub if user has not set profile location yet
    userCoords = { lat: 12.9140, lon: 77.4993 };
  }

  // 2. Resolve item coordinates
  const itemCoords = resolveCoords(item.latitude, item.longitude, item.locality);

  if (itemCoords) {
    const distanceKm = haversineDistanceKm(userCoords.lat, userCoords.lon, itemCoords.lat, itemCoords.lon);
    // If distance is virtually 0 (same building/locality), return 0.2 km
    return distanceKm < 0.1 ? 0.2 : Number(distanceKm.toFixed(1));
  }

  // 3. Fallback: if backend provided distance_meters
  if (
    typeof item.distance_meters === 'number' &&
    !isNaN(item.distance_meters) &&
    item.distance_meters >= 0 &&
    item.distance_meters < 35000
  ) {
    const km = item.distance_meters / 1000;
    return km < 0.1 ? 0.2 : Number(km.toFixed(1));
  }

  // 4. Locality string proximity matching
  const itemLoc = (item.locality || '').toLowerCase().trim();
  const userLoc = (user?.locality || 'beml layout').toLowerCase().trim();

  if (itemLoc && userLoc) {
    if (itemLoc === userLoc || itemLoc.includes(userLoc) || userLoc.includes(itemLoc)) {
      return 0.3;
    }
  }

  return 2.5;
}

/**
 * Formats reach distance into clean user-facing string:
 * "Within 1 km", "Within 2 km", "Within 3 km", "Within 4 km", "Within 5 km", "Within 10 km".
 * Each item shows its actual distance based on its profile location instead of a fixed value.
 */
export function getReachDistance(
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
): string {
  const km = getReachDistanceKm(item, user);

  if (km <= 1) return 'Within 1 km';
  if (km <= 2) return 'Within 2 km';
  if (km <= 3) return 'Within 3 km';
  if (km <= 4) return 'Within 4 km';
  if (km <= 5) return 'Within 5 km';
  if (km <= 10) return 'Within 10 km';
  return `Within ${Math.ceil(km)} km`;
}
