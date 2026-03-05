import { authorizedGet } from "./tokenManager.js";

console.log("🚀 DETAIL CONTROLLER STARTED");

const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";

/* ===============================
   PAGE PARAMETERS
================================ */

const params = new URLSearchParams(window.location.search);

const houseId = params.get("id");
const university = params.get("university");
const studentId = params.get("student_id");

console.group("📌 PAGE PARAMETERS");
console.log("houseId:", houseId);
console.log("university:", university);
console.log("studentId:", studentId);
console.groupEnd();

/* ===============================
   PARAM VALIDATION
================================ */

function validateParams() {
  console.group("🔎 PARAM VALIDATION");

  if (!houseId) {
    console.error("❌ Missing houseId");
    console.groupEnd();
    return false;
  }

  if (!university) {
    console.error("❌ Missing university");
    console.groupEnd();
    return false;
  }

  if (!studentId) {
    console.error("❌ Missing studentId");
    console.groupEnd();
    return false;
  }

  console.log("✅ Params valid");
  console.groupEnd();
  return true;
}

/* ===============================
   ERROR HANDLER
================================ */

function showError(message) {
  console.group("❌ APPLICATION ERROR");
  console.error(message);
  alert(message || "Something went wrong");
  console.groupEnd();
}

/* ===============================
   GEOLOCATION SERVICE
================================ */

function getCurrentLocation() {
  console.group("📍 LOCATION REQUEST");

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      console.error("❌ Geolocation not supported");
      console.groupEnd();
      return reject("Geolocation not supported");
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        console.log("📍 Location received:", location);
        console.groupEnd();
        resolve(location);
      },
      (err) => {
        console.error("❌ Location error:", err.message || err);
        console.groupEnd();
        reject(err.message || err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/* ===============================
   NETWORK DEBUGGER
   - returns parsed JSON object or null
================================ */

async function debugRequest(url) {
  console.group("🌍 NETWORK REQUEST");
  const start = performance.now();
  console.log("➡️ Request URL:", url);

  try {
    const res = await authorizedGet(url);
    const end = performance.now();

    console.log("⏱ Request Time:", (end - start).toFixed(2) + " ms");
    console.log("📡 Status:", res.status);
    console.log("📡 Status Text:", res.statusText);

    console.group("📥 Response Headers");
    for (const [key, value] of res.headers.entries()) {
      console.log(`${key}: ${value}`);
    }
    console.groupEnd();

    const raw = await res.text();
    console.log("📦 Response Length:", raw ? raw.length : 0);

    if (!raw || raw.trim() === "") {
      console.error("❌ EMPTY RESPONSE BODY");
      console.groupEnd();
      return null;
    }

    console.log("📦 Raw Response:", raw);

    let data = null;
    try {
      data = JSON.parse(raw);
      console.log("✅ JSON Parsed Successfully");
      console.log("📄 JSON Object:", data);
    } catch (parseError) {
      console.error("❌ JSON Parsing Failed", parseError);
      // keep data as null so callers can handle gracefully
    }

    console.groupEnd();
    return data;
  } catch (err) {
    console.error("❌ Network Request Failed", err);
    console.groupEnd();
    throw err;
  }
}

/* ===============================
   PHONE ACTION
   - try to open tel: on mobile
   - fallback: show phone number in alert
================================ */

async function callLandlordPhone() {
  console.group("📞 PHONE BUTTON CLICKED");

  if (!validateParams()) {
    console.groupEnd();
    return;
  }

  try {
    const url =
      `${BASE_URL}/home/boardinghouse/${encodeURIComponent(houseId)}/landlord-phone` +
      `?university=${encodeURIComponent(university)}` +
      `&student_id=${encodeURIComponent(studentId)}`;

    const data = await debugRequest(url);

    if (!data) {
      showError("Empty response from server");
      console.groupEnd();
      return;
    }

    const phone = data.phone_number ?? data.phone ?? null;
    const message = data.message ?? null;

    if (phone) {
      console.log("📞 Phone number received:", phone);

      // Attempt to open dialer
      try {
        // On many mobile browsers setting location.href to tel: will open dialer
        window.location.href = `tel:${phone}`;
        // Also attempt window.open as a fallback (some browsers block)
        // Note: window.open may be blocked by popup blockers; we still attempt it.
        try { window.open(`tel:${phone}`); } catch (e) { /* ignore */ }
      } catch (err) {
        console.warn("⚠ Could not open tel: link directly", err);
        alert(`Landlord phone: ${phone}`);
      }
    } else if (message) {
      showError(message);
    } else {
      showError("Phone number unavailable");
    }
  } catch (err) {
    console.error("📞 Error fetching phone:", err);
    showError("Failed to fetch phone number");
  }

  console.groupEnd();
}

/* ===============================
   GOOGLE MAPS ACTION
   - always open returned link in new tab if available
   - handle different response shapes
================================ */

async function openGoogleMaps() {
  console.group("🗺 GOOGLE MAPS BUTTON");

  if (!validateParams()) {
    console.groupEnd();
    return;
  }

  try {
    const { lat, lon } = await getCurrentLocation();

    const url =
      `${BASE_URL}/home/google/${encodeURIComponent(houseId)}` +
      `?university=${encodeURIComponent(university)}` +
      `&student_id=${encodeURIComponent(studentId)}` +
      `&current_lat=${encodeURIComponent(lat)}` +
      `&current_lon=${encodeURIComponent(lon)}`;

    const data = await debugRequest(url);

    if (!data) {
      showError("Empty response from server");
      console.groupEnd();
      return;
    }

    // Accept multiple possible keys: link, url, maps_link
    const link = data.link ?? data.url ?? data.maps_link ?? null;

    if (link) {
      console.log("🗺 Opening Google Maps:", link);
      try {
        window.open(link, "_blank");
      } catch (err) {
        console.warn("⚠ window.open blocked, trying location.href", err);
        try { window.location.href = link; } catch (e) { showError("Could not open Google Maps link"); }
      }
    } else {
      showError("Google Maps link unavailable");
    }
  } catch (err) {
    console.error("🗺 Error opening Google Maps:", err);
    showError("Failed to open Google Maps");
  }

  console.groupEnd();
}

/* ===============================
   YANGO ACTION
   - prefer deep_link, then browser_link, then url
   - open in new tab where appropriate
================================ */

async function openYango() {
  console.group("🚗 YANGO BUTTON");

  if (!validateParams()) {
    console.groupEnd();
    return;
  }

  try {
    const { lat, lon } = await getCurrentLocation();

    const url =
      `${BASE_URL}/home/yango/${encodeURIComponent(houseId)}` +
      `?university=${encodeURIComponent(university)}` +
      `&student_id=${encodeURIComponent(studentId)}` +
      `&current_lat=${encodeURIComponent(lat)}` +
      `&current_lon=${encodeURIComponent(lon)}`;

    const data = await debugRequest(url);

    if (!data) {
      showError("Empty response from server");
      console.groupEnd();
      return;
    }

    // Accept multiple possible keys
    const deep = data.deep_link ?? data.deepLink ?? data.deep;
    const browser = data.browser_link ?? data.browserLink ?? data.browser ?? data.url;
    const fallback = data.url ?? null;

    if (deep) {
      console.log("🚗 Opening Yango deep link:", deep);
      try {
        // deep links often need to be opened in same tab to trigger app
        window.location.href = deep;
      } catch (err) {
        console.warn("⚠ Could not open deep link directly", err);
        // fallback to browser link if available
        if (browser) {
          try { window.open(browser, "_blank"); } catch (e) { showError("Could not open Yango link"); }
        } else {
          alert(`Yango link: ${deep}`);
        }
      }
    } else if (browser) {
      console.log("🚗 Opening Yango browser link:", browser);
      try {
        window.open(browser, "_blank");
      } catch (err) {
        console.warn("⚠ window.open blocked, trying location.href", err);
        try { window.location.href = browser; } catch (e) { showError("Could not open Yango link"); }
      }
    } else if (fallback) {
      console.log("🚗 Opening Yango fallback url:", fallback);
      try { window.open(fallback, "_blank"); } catch (err) { showError("Could not open Yango link"); }
    } else {
      showError("Yango ride unavailable");
    }
  } catch (err) {
    console.error("🚗 Error launching Yango:", err);
    showError("Failed to launch Yango");
  }

  console.groupEnd();
}

/* ===============================
   BUS ACTION (placeholder)
   - If backend provides bus coordinates or link, open Google Maps with query
================================ */

async function openBus() {
  console.group("🚌 BUS BUTTON CLICKED");

  if (!validateParams()) {
    console.groupEnd();
    return;
  }

  try {
    // If you have an endpoint for bus stops, call it here.
    // For now, attempt to fetch boardinghouse summary to extract coordinates if available.
    const summaryUrl =
      `${BASE_URL}/home/boardinghouse/${encodeURIComponent(houseId)}` +
      `?university=${encodeURIComponent(university)}` +
      `&student_id=${encodeURIComponent(studentId)}`;

    const data = await debugRequest(summaryUrl);

    if (!data) {
      showError("Empty response from server");
      console.groupEnd();
      return;
    }

    // Try to find coordinates in response (common keys: lat, lon, latitude, longitude)
    const lat = data.lat ?? data.latitude ?? data.location_lat ?? null;
    const lon = data.lon ?? data.longitude ?? data.location_lon ?? null;

    if (lat && lon) {
      const mapsQuery = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;
      console.log("🚌 Opening Google Maps for bus area:", mapsQuery);
      window.open(mapsQuery, "_blank");
    } else {
      // fallback: show message or open the house location string if available
      const locationText = data.location ?? data.address ?? null;
      if (locationText) {
        const mapsQuery = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(locationText)}`;
        console.log("🚌 Opening Google Maps for location text:", mapsQuery);
        window.open(mapsQuery, "_blank");
      } else {
        showError("Bus stop or location not available");
      }
    }
  } catch (err) {
    console.error("🚌 Error opening bus location:", err);
    showError("Failed to open bus location");
  }

  console.groupEnd();
}

/* ===============================
   PAGE INITIALIZATION
================================ */

document.addEventListener("DOMContentLoaded", () => {
  console.group("🚀 PAGE INITIALIZATION");

  if (!validateParams()) {
    console.warn("⚠ Page initialization stopped due to invalid parameters");
    console.groupEnd();
    return;
  }

  const phoneBtn = document.getElementById("phoneBtn");
  const googleBtn = document.getElementById("googleBtn");
  const yangoBtn = document.getElementById("yangoBtn");
  const busBtn = document.getElementById("busBtn");

  console.log("🔘 Buttons detected:", { phoneBtn, googleBtn, yangoBtn, busBtn });

  // Attach listeners with small debug wrappers
  if (phoneBtn) {
    phoneBtn.addEventListener("click", () => {
      console.log("🔔 phoneBtn clicked");
      callLandlordPhone();
    });
  } else {
    console.warn("phoneBtn not found in DOM");
  }

  if (googleBtn) {
    googleBtn.addEventListener("click", () => {
      console.log("🔔 googleBtn clicked");
      openGoogleMaps();
    });
  } else {
    console.warn("googleBtn not found in DOM");
  }

  if (yangoBtn) {
    yangoBtn.addEventListener("click", () => {
      console.log("🔔 yangoBtn clicked");
      openYango();
    });
  } else {
    console.warn("yangoBtn not found in DOM");
  }

  if (busBtn) {
    busBtn.addEventListener("click", () => {
      console.log("🔔 busBtn clicked");
      openBus();
    });
  } else {
    console.warn("busBtn not found in DOM");
  }

  console.groupEnd();
});
