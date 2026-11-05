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
        const building_no = addr.house_number || addr.building || addr.flat || '';
        const road = addr.road || addr.pedestrian || addr.suburb || '';
        const neighbourhood = addr.neighbourhood || addr.suburb || addr.residential || '';
        const city = addr.city || addr.town || addr.village || addr.city_district || addr.state_district || addr.state || '';
        const state = addr.state || '';
        const pincode = addr.postcode || '';

        // Build human-friendly locality without duplicating identical city/neighbourhood tokens
        const primaryLocality = neighbourhood || road || city;
        const locality = primaryLocality && city && !primaryLocality.toLowerCase().includes(city.toLowerCase())
          ? `${primaryLocality}, ${city}`
          : primaryLocality || city;

        // Build address text with duplicate removal
        const addressParts = deduplicateAddressParts([
          building_no ? `No. ${building_no}` : '',
          road,
          neighbourhood,
          addr.suburb && addr.suburb !== neighbourhood ? addr.suburb : '',
          city,
          state,
          pincode
        ]);

        const address_text = addressParts.slice(0, 3).join(', ') || data.display_name || locality;

        return {
          locality,
          city,
          building_no,
          address_text,
          pincode,
          latitude,
          longitude,
          full_address: data.display_name || address_text,
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
      const addressParts = deduplicateAddressParts([rawLocality, city, state, pincode]);
      const address_text = addressParts.join(', ');

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
    address_text: `GPS: ${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
    pincode: '',
    latitude,
    longitude,
    full_address: `Coordinates: ${latitude}, ${longitude}`,
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
 * Formats the full complete location string of a user, owner, or item:
 * Includes Building/Flat/House, Street/Road, Locality/Neighborhood, and PIN code.
 * De-duplicates redundant sub-strings cleanly.
 */
export function formatFullAddress(entity?: {
  address_text?: string | null;
  locality?: string | null;
  pincode?: string | null;
  owner_locality?: string | null;
} | null): string {
  if (!entity) return '';

  const address = (entity.address_text || '').trim();
  let locality = (entity.locality || entity.owner_locality || '').trim();
  const pincode = (entity.pincode || '').trim();

  // Do NOT assume address: if user never set address_text and locality is Bengaluru, ignore it
  if ((locality.toLowerCase() === 'bengaluru' || locality.toLowerCase() === 'bengaluru, india' || locality.toLowerCase() === 'bangalore') && !address) {
    locality = '';
  }

  const rawParts = `${address}, ${locality}`
    .split(',')
    .map(p => p.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const parts: string[] = [];
  for (const part of rawParts) {
    const lower = part.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      parts.push(part);
    }
  }

  if (pincode && !seen.has(pincode.toLowerCase())) {
    parts.push(pincode);
  }

  const result = parts.join(', ') || locality || address || '';
  if (result.toLowerCase() === 'bengaluru' || result.toLowerCase() === 'bengaluru, india') {
    return '';
  }
  return result;
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
    // Parse building and street from user.address_text
    let building = '';
    let street = '';
    if (user.address_text) {
      const parts = user.address_text.split(',').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 2) {
        building = parts[0];
        street = parts.slice(1).join(', ');
      } else {
        building = parts[0] || '';
      }
    }

    const cleanLocality = (user.locality?.toLowerCase() === 'bengaluru' && !user.address_text) ? '' : (user.locality || '');

    primaryLoc = {
      id: 'primary',
      label: 'Primary Profile Address',
      building_flat_house: building,
      street_road_landmark: street,
      locality: cleanLocality || fullAddress,
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
 * Formats a single SavedLocation object into its full clean address line
 */
export function formatSavedLocationFull(loc: SavedLocation): string {
  const parts = [
    loc.building_flat_house,
    loc.street_road_landmark,
    loc.locality,
    loc.pincode
  ].map(s => (s || '').trim()).filter(Boolean);

  return parts.join(', ') || loc.locality || '';
}
