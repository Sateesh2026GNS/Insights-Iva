import api from "./axiosConfig";
import { getPlatformToken } from "./platformApi";

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? null;
}

/**
 * Shared PIN → address lookup (tenant settings or platform admin).
 * Uses the same backend Address Lookup Service.
 */
export async function lookupIndianPincode(pincode, { platform = false } = {}) {
  const pin = String(pincode || "").replace(/\D/g, "");
  const headers = {};
  if (platform) {
    const token = getPlatformToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const path = platform
    ? `/platform/address/pincode/${pin}`
    : `/settings/address/pincode/${pin}`;
  const res = await api.get(path, { headers, skipGlobalError: true });
  return unwrap(res);
}

/**
 * Retrieves user's current GPS coordinates via the Browser Geolocation API.
 */
export function getCurrentCoordinates(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined" || !navigator?.geolocation) {
      reject(new Error("Geolocation is not supported by your browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
      },
      (err) => {
        let msg = "Failed to retrieve location.";
        if (err.code === 1) {
          msg = "Location permission denied. Please allow location access in your browser.";
        } else if (err.code === 2) {
          msg = "Location position unavailable. Please check your network or GPS.";
        } else if (err.code === 3) {
          msg = "Location request timed out. Please try again.";
        }
        reject(new Error(msg));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
        ...options,
      }
    );
  });
}

/**
 * Reverse geocode latitude and longitude to structured address fields.
 */
export async function reverseGeocodeCoordinates(lat, lon) {
  // 1. Primary: OpenStreetMap Nominatim
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`,
      {
        headers: {
          "Accept-Language": "en",
        },
      }
    );
    if (res.ok) {
      const data = await res.json();
      if (data && data.address) {
        const addr = data.address;

        const line1Parts = [
          addr.house_number || addr.street_number,
          addr.building || addr.office || addr.apartment || addr.commercial,
          addr.road || addr.street || addr.footway || addr.path,
        ].filter(Boolean);

        let address_line1 = line1Parts.join(", ");
        if (!address_line1) {
          address_line1 = addr.suburb || addr.neighbourhood || addr.residential || "";
        }

        const line2Parts = [
          addr.neighbourhood,
          addr.suburb,
          addr.residential,
          addr.subdistrict || addr.landmark,
        ].filter(Boolean);

        const uniqueLine2 = line2Parts.filter((p) => p && !address_line1.includes(p));
        const address_line2 = [...new Set(uniqueLine2)].join(", ");

        const city =
          addr.city ||
          addr.town ||
          addr.village ||
          addr.municipality ||
          addr.city_district ||
          addr.state_district ||
          addr.county ||
          "";

        const state = addr.state || addr.region || "";
        const pincode = String(addr.postcode || "").replace(/\D/g, "").slice(0, 6);
        const country = addr.country || "India";

        return {
          address_line1,
          address_line2,
          city,
          state,
          pincode,
          country,
          display_name: data.display_name || "",
        };
      }
    }
  } catch (err) {
    console.warn("Nominatim reverse geocode failed, trying fallback:", err);
  }

  // 2. Fallback: BigDataCloud reverse geocode client
  try {
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (res.ok) {
      const data = await res.json();
      if (data) {
        return {
          address_line1: data.locality || data.localityInfo?.administrative?.[3]?.name || "",
          address_line2: data.localityInfo?.administrative?.[2]?.name || "",
          city: data.city || data.locality || "",
          state: data.principalSubdivision || "",
          pincode: String(data.postcode || "").replace(/\D/g, "").slice(0, 6),
          country: data.countryName || "India",
          display_name: "",
        };
      }
    }
  } catch (err) {
    console.warn("BigDataCloud fallback reverse geocode failed:", err);
  }

  throw new Error("Could not determine address from current location.");
}

/**
 * High-level helper: get coordinates + reverse geocode + auto-fill data.
 */
export async function fetchCurrentLocationAddress(options = {}) {
  const coords = await getCurrentCoordinates(options);
  const result = await reverseGeocodeCoordinates(coords.latitude, coords.longitude);
  if (result.pincode && result.pincode.length === 6) {
    try {
      const pinData = await lookupIndianPincode(result.pincode);
      if (pinData) {
        if (pinData.state) result.state = pinData.state;
        if (pinData.city && !result.city) result.city = pinData.city;
      }
    } catch {
      // pinData lookup is optional enhancement
    }
  }
  return result;
}
