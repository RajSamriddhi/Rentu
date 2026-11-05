/**
 * Rentu⁺ Geolocation & Reverse Geocoding Utility
 * High-accuracy GPS detection with OpenStreetMap Nominatim + BigDataCloud fallback
 */

import { User, SavedLocation } from './types';

export interface ResolvedLocation {
  locality: string;
  city: string;
  building_no?: string;
  address_text: string;
  pincode: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  full_address: string;
  state?: string;
}

/**
 * Request GPS coordinates from browser Geolocation API
 */
export const getCoordinates = (
  options: PositionOptions = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
): Promise<{ latitude: number; longitude: number; accuracy?: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: Math.round(pos.coords.accuracy || 10),
        });
      },
      (err) => {
        switch (err.code) {
          case err.PERMISSION_DENIED:
            reject(new Error('Location permission denied. Please allow location access in your browser settings to find your current location.'));
            break;
          case err.POSITION_UNAVAILABLE:
            reject(new Error('Location information is unavailable. Please check your GPS signal or enter your address manually.'));
            break;
          case err.TIMEOUT:
            reject(new Error('Location request timed out. Please try again or type your locality manually.'));
            break;
          default:
            reject(new Error('Could not acquire your current location. Please enter manually.'));
        }
      },
      options
    );
  });
};

function deduplicateAddressParts(parts: (string | undefined | null)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const part of parts) {
    const trimmed = (part || '').trim();
    if (!trimmed) continue;
    const lower = trimmed.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      result.push(trimmed);
    }
  }
  return result;
}

/**
 * Reverse geocode latitude and longitude into street address, locality, city, and pincode.
 * Tries OpenStreetMap Nominatim first, with BigDataCloud as a reliable instant fallback.
 */
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<ResolvedLocation> => {
  // Strategy 1: OpenStreetMap Nominatim with 5s timeout
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'en' },
        signal: AbortSignal.timeout(5000),
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        // Building/Flat/House is compulsory and MUST be entered manually by the user
        const building_no = '';
        const road = addr.road || addr.pedestrian || addr.amenity || '';
        const neighbourhood = addr.neighbourhood || addr.suburb || addr.residential || '';
        const city = addr.city || addr.town || addr.village || addr.city_district || addr.state_district || addr.state || '';
        const state = addr.state || '';
        const pincode = addr.postcode || '';

        // Build human-friendly locality without duplicating identical city/neighbourhood tokens
        const primaryLocality = neighbourhood || road || city;
        const locality = primaryLocality && city && !primaryLocality.toLowerCase().includes(city.toLowerCase())
          ? `${primaryLocality}, ${city}`
          : primaryLocality || city;

        // Street/Road/Landmark should only be road/pedestrian, NOT locality/neighbourhood
        const address_text = road || addr.pedestrian || addr.amenity || '';

        return {
          locality,
          city,
          building_no: '',
          address_text,
          pincode,
          latitude,
          longitude,
          full_address: address_text,
          state,
        };
      }
    }
  } catch (err) {
    console.warn('Nominatim reverse geocode error or timeout, trying BigDataCloud fallback:', err);
  }

  // Strategy 2: BigDataCloud Reverse Geocode Fallback with 5s timeout
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
      {
        signal: AbortSignal.timeout(5000),
      }
    );
    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.locality || data.principalSubdivision || '';
      const rawLocality = data.locality || city;
      const locality = rawLocality && city && !rawLocality.toLowerCase().includes(city.toLowerCase())
        ? `${rawLocality}, ${city}`
        : rawLocality;
      const pincode = data.postcode || '';
      const state = data.principalSubdivision || '';
      // BigDataCloud does not provide road-level accuracy, keep address_text empty so user enters street
      const address_text = '';

      return {
        locality,
        city,
        building_no: '',
        address_text,
        pincode,
        latitude,
        longitude,
        full_address: address_text,
        state,
      };
    }
  } catch (err) {
    console.warn('BigDataCloud fallback failed:', err);
  }

  // Fallback with coordinates
  return {
    locality: `(${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
    city: '',
    building_no: '',
    address_text: '',
    pincode: '',
    latitude,
    longitude,
    full_address: '',
  };
};

/**
 * 1-Click Detect Location: Gets coordinates and parses into address
 */
export const detectCurrentLocation = async (
  options: PositionOptions = { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
): Promise<ResolvedLocation> => {
  const coords = await getCoordinates(options);
  const resolved = await reverseGeocode(coords.latitude, coords.longitude);
  return {
    ...resolved,
    accuracy: coords.accuracy,
  };
};

/**
 * Returns exact Google Maps URL pointing directly to coordinate pin
 */
export const getGoogleMapsUrl = (latitude?: number | null, longitude?: number | null, fallbackQuery?: string): string => {
  if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude) && (latitude !== 0 || longitude !== 0)) {
    return `https://www.google.com/maps?q=${latitude},${longitude}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fallbackQuery || 'Bengaluru')}`;
};

/**
 * Returns exact Google Maps Directions URL navigating directly to the meetup spot
 */
export const getGoogleMapsDirectionsUrl = (latitude?: number | null, longitude?: number | null, fallbackQuery?: string): string => {
  if (typeof latitude === 'number' && typeof longitude === 'number' && !isNaN(latitude) && !isNaN(longitude) && (latitude !== 0 || longitude !== 0)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fallbackQuery || 'Bengaluru')}`;
};

/**
 * Parses an address string into Building/Flat/House No. and Street/Road/Landmark.
 * Prevents area/locality/neighborhood names (e.g., Mylasandra, BEML Layout) from mistakenly
 * being parsed as a building number.
 */
export function parseAddressText(text?: string | null): { building: string; street: string } {
  if (!text) return { building: '', street: '' };
  const parts = text.split(',').map(p => p.trim()).filter(Boolean);
  if (parts.length === 0) return { building: '', street: '' };

  const firstPart = parts[0];
  const lowerFirst = firstPart.toLowerCase();

  // If the first token matches known localities, layouts, suburbs, or cities, it is NOT a building number
  const isAreaKeyword = [
    'layout', 'phase', 'stage', 'sector', 'block', 'nagar', 'road', 'street', 'cross', 'main',
    'bengaluru', 'bangalore', 'delhi', 'mumbai', 'mylasandra', 'beml', 'kengeri', 'rr nagar',
    'koramangala', 'indiranagar', 'hsr', 'whitefield', 'jayanagar', 'jp nagar'
  ].some(kw => lowerFirst.includes(kw));

  // A valid building/flat usually contains digits or explicit keywords like Flat, House, Bldg, Stanza, Villa, Room
  const hasBuildingIndicator = /\d/.test(firstPart) || /^(flat|house|no|apt|building|bldg|tower|room|stanza|villa|plot|door)\b/i.test(firstPart);

  if (parts.length >= 2 && hasBuildingIndicator && !isAreaKeyword) {
    return {
      building: firstPart,
      street: parts.slice(1).join(', ')
    };
  }

  return {
    building: '',
    street: text
  };
}

/**
 * Builds the canonical full address string:
 * Strictly: [Building / Flat / House No.], [Street / Road / Landmark], [Postal Code].
 * Compulsory: Building/Flat/House No. must be entered by user.
 * Locality and Neighborhood are explicitly excluded from the address.
 * De-duplicates overlapping tokens cleanly.
 */
export function buildAddressString(
  building?: string | null,
  street?: string | null,
  pincode?: string | null,
  localityToOmit?: string | null
): string {
  const trimmedBuilding = (building || '').trim();
  const trimmedStreet = (street || '').trim();
  const trimmedPincode = (pincode || '').trim();

  const localityTokens = new Set(
    (localityToOmit || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  );

  const seen = new Set<string>();
  const cleanTokens: string[] = [];

  for (const part of [trimmedBuilding, trimmedStreet, trimmedPincode]) {
    if (!part) continue;
    const tokens = part.split(',').map(t => t.trim()).filter(Boolean);
    for (const token of tokens) {
      const lower = token.toLowerCase();
      // Omit locality or neighborhood from address string (unless it is part of building)
      if (localityTokens.has(lower) && part !== trimmedBuilding) {
        continue;
      }
      if (!seen.has(lower)) {
        seen.add(lower);
        cleanTokens.push(token);
      }
    }
  }

  return cleanTokens.join(', ');
}

/**
 * Formats the full address of a user or item:
 * Strictly: [Building / Flat / House No.], [Street / Road / Landmark], [Postal Code].
 * Per requirement: Locality and Neighborhood are NOT included in the address string.
 * De-duplicates overlapping tokens cleanly.
 */
export function formatFullAddress(entity?: {
  address_text?: string | null;
  locality?: string | null;
  pincode?: string | null;
  owner_locality?: string | null;
} | null): string {
  if (!entity) return '';

  const address = (entity.address_text || '').trim();
  const pincode = (entity.pincode || '').trim();

  if (!address || address.toLowerCase() === 'bengaluru' || address.toLowerCase() === 'bengaluru, india') {
    return '';
  }

  const localityStr = (entity.locality || entity.owner_locality || '').trim();
  const localityTokens = new Set(
    localityStr.split(',').map(s => s.trim().toLowerCase()).filter(Boolean)
  );

  const seen = new Set<string>();
  const parts: string[] = [];

  for (const part of [address, pincode]) {
    if (!part) continue;
    const subTokens = part.split(',').map(p => p.trim()).filter(Boolean);
    for (const token of subTokens) {
      const lower = token.toLowerCase();
      if (localityTokens.has(lower)) {
        continue;
      }
      if (!seen.has(lower)) {
        seen.add(lower);
        parts.push(token);
      }
    }
  }

  return parts.join(', ');
}

/**
 * Returns all saved locations for a user, ensuring their Primary Profile Address
 * is included as the default first entry ONLY if the user has actually set a location in their profile.
 */
export function getEffectiveSavedLocations(user?: User | null): SavedLocation[] {
  if (!user) return [];

  const fullAddress = formatFullAddress(user);
  let primaryLoc: SavedLocation | null = null;

  if (fullAddress) {
    const { building, street } = parseAddressText(user.address_text);
    const cleanLocality = (user.locality?.toLowerCase() === 'bengaluru' && !user.address_text) ? '' : (user.locality || '');

    primaryLoc = {
      id: 'primary',
      label: 'Primary Profile Address',
      building_flat_house: building,
      street_road_landmark: street,
      locality: cleanLocality || 'Neighborhood',
      pincode: user.pincode || '',
      latitude: user.latitude,
      longitude: user.longitude,
      is_default: true,
    };
  }

  const otherLocations = Array.isArray(user.saved_locations) ? user.saved_locations : [];
  return primaryLoc ? [primaryLoc, ...otherLocations] : otherLocations;
}

/**
 * Formats a single SavedLocation object into its clean address line:
 * Strictly: [Building / Flat / House No.], [Street / Road / Landmark], [Postal Code].
 * Per requirement: Locality and Neighborhood are NOT included in the address string.
 * De-duplicates overlapping tokens cleanly.
 */
export function formatSavedLocationFull(loc: SavedLocation): string {
  return buildAddressString(
    loc.building_flat_house,
    loc.street_road_landmark,
    loc.pincode,
    loc.locality
  );
}
