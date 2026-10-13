/**
 * Rentu⁺ Geolocation & Reverse Geocoding Utility
 * High-accuracy GPS detection with OpenStreetMap Nominatim + BigDataCloud fallback
 */

export interface ResolvedLocation {
  locality: string;
  city: string;
  address_text: string;
  pincode: string;
  latitude: number;
  longitude: number;
  full_address: string;
  state?: string;
}

/**
 * Request GPS coordinates from browser Geolocation API
 */
export const getCoordinates = (
  options: PositionOptions = { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
): Promise<{ latitude: number; longitude: number }> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      return reject(new Error('Geolocation is not supported by your browser.'));
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
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

/**
 * Reverse geocode latitude and longitude into street address, locality, city, and pincode.
 * Tries OpenStreetMap Nominatim first, with BigDataCloud as a reliable instant fallback.
 */
export const reverseGeocode = async (
  latitude: number,
  longitude: number
): Promise<ResolvedLocation> => {
  // Strategy 1: OpenStreetMap Nominatim
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&addressdetails=1`,
      {
        headers: { 'Accept-Language': 'en' },
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;
        const road = addr.road || addr.pedestrian || addr.suburb || '';
        const neighbourhood = addr.neighbourhood || addr.suburb || addr.residential || '';
        const city = addr.city || addr.town || addr.village || addr.city_district || addr.state_district || 'Delhi';
        const state = addr.state || '';
        const pincode = addr.postcode || '';

        // Build human-friendly locality
        const primaryLocality = neighbourhood || road || city;
        const locality = primaryLocality && !primaryLocality.toLowerCase().includes(city.toLowerCase())
          ? `${primaryLocality}, ${city}`
          : primaryLocality || city;

        // Build address text
        const addressParts = [
          road,
          neighbourhood,
          addr.suburb && addr.suburb !== neighbourhood ? addr.suburb : '',
          city,
          state,
          pincode
        ].filter(Boolean);

        const address_text = addressParts.slice(0, 3).join(', ') || data.display_name || locality;

        return {
          locality,
          city,
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

  // Strategy 2: BigDataCloud Reverse Geocode Fallback
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      const city = data.city || data.principalSubdivision || 'Delhi';
      const rawLocality = data.locality || city;
      const locality = rawLocality && !rawLocality.toLowerCase().includes(city.toLowerCase())
        ? `${rawLocality}, ${city}`
        : rawLocality;
      const pincode = data.postcode || '';
      const state = data.principalSubdivision || '';
      const address_text = [rawLocality, city, state, pincode].filter(Boolean).join(', ');

      return {
        locality,
        city,
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
    locality: `Near (${latitude.toFixed(3)}, ${longitude.toFixed(3)})`,
    city: 'Delhi',
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
export const detectCurrentLocation = async (): Promise<ResolvedLocation> => {
  const coords = await getCoordinates();
  return await reverseGeocode(coords.latitude, coords.longitude);
};
