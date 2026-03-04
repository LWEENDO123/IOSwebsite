import { authorizedGet } from "./tokenManager.js";

console.log("✅ DETAIL JS LOADED");

const baseUrl = "https://klenoboardinghouse-production.up.railway.app";

const params = new URLSearchParams(window.location.search);
const houseId = params.get("id");
const university = params.get("university");
const studentId = params.get("student_id");

console.log("📌 Params:", { houseId, university, studentId });

// ----------------------------
// Utility Helpers
// ----------------------------

function showError(message) {
  console.error("❌ ERROR:", message);
  alert(message || "Something went wrong");
}

function validateParams() {
  console.log("🔎 Validating params...");
  debugger;

  if (!houseId || !university || !studentId) {
    showError("Missing required parameters.");
    return false;
  }

  console.log("✅ Params valid");
  return true;
}

function getCurrentLocation() {
  console.log("📍 Requesting location...");
  debugger;

  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        console.log("📍 Location received:", pos.coords);
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      (err) => {
        console.error("❌ Location error:", err);
        reject("Location permission denied");
      }
    );
  });
}

async function handleResponse(res) {
  console.log("🌍 Response status:", res.status);
  debugger;

  if (!res.ok) {
    try {
      const err = await res.json();
      throw new Error(err.detail || "Access denied (Premium required)");
    } catch {
      throw new Error("Access denied (Premium required)");
    }
  }

  const data = await res.json();
  console.log("📦 Response data:", data);
  return data;
}

// ----------------------------
// Phone
// ----------------------------

async function callLandlordPhone() {
  console.log("📞 PHONE CLICKED");
  debugger;

  if (!validateParams()) return;

  try {
    const url = `${baseUrl}/home/boardinghouse/${encodeURIComponent(
      houseId
    )}/landlord-phone?university=${encodeURIComponent(
      university
    )}&student_id=${encodeURIComponent(studentId)}`;

    console.log("🌍 Sending request:", url);

    const res = await authorizedGet(url);
    const data = await handleResponse(res);

    if (data.phone_number?.trim()) {
      console.log("📞 Opening dialer...");
      window.location.href = `tel:${data.phone_number}`;
    } else {
      showError(data.message || "Phone number not available");
    }
  } catch (err) {
    console.error("Phone error:", err);
    showError(err.message);
  }
}

// ----------------------------
// Google Maps
// ----------------------------

async function openGoogleMaps() {
  console.log("🗺 GOOGLE CLICKED");
  debugger;

  if (!validateParams()) return;

  try {
    const { lat, lon } = await getCurrentLocation();

    const url = `${baseUrl}/home/google/${encodeURIComponent(
      houseId
    )}?university=${encodeURIComponent(
      university
    )}&student_id=${encodeURIComponent(
      studentId
    )}&current_lat=${lat}&current_lon=${lon}`;

    console.log("🌍 Sending request:", url);

    const res = await authorizedGet(url);
    const data = await handleResponse(res);

    if (data.link?.trim()) {
      console.log("🗺 Opening Google Maps...");
      window.open(data.link, "_blank");
    } else {
      showError("Google Maps link not available");
    }
  } catch (err) {
    console.error("Google Maps error:", err);
    showError(err.message);
  }
}

// ----------------------------
// Yango
// ----------------------------

async function openYango() {
  console.log("🚗 YANGO CLICKED");
  debugger;

  if (!validateParams()) return;

  try {
    const { lat, lon } = await getCurrentLocation();

    const url = `${baseUrl}/home/yango/${encodeURIComponent(
      houseId
    )}?university=${encodeURIComponent(
      university
    )}&student_id=${encodeURIComponent(
      studentId
    )}&current_lat=${lat}&current_lon=${lon}&tariff=econom&lang=en&secure=false`;

    console.log("🌍 Sending request:", url);

    const res = await authorizedGet(url);
    const data = await handleResponse(res);

    const deepLink = data.deep_link?.trim();
    const browserLink = data.browser_link?.trim();

    console.log("🚗 Yango links:", { deepLink, browserLink });

    let launched = false;

    if (deepLink) {
      console.log("🚗 Trying deep link...");
      window.location.href = deepLink;
      launched = true;
    }

    if (!launched && browserLink) {
      console.log("🚗 Fallback to browser link...");
      window.open(browserLink, "_blank");
    }

    if (!deepLink && !browserLink) {
      showError("Yango directions unavailable");
    }
  } catch (err) {
    console.error("Yango error:", err);
    showError(err.message);
  }
}

// ----------------------------
// Bind Actions
// ----------------------------

document.addEventListener("DOMContentLoaded", () => {
  console.log("🚀 DOM READY");
  debugger;

  const phoneBtn = document.querySelector(".action-icon.phone");
  const googleBtn = document.querySelector(".action-icon.google");
  const yangoBtn = document.querySelector(".action-icon.yango");

  console.log("🔘 Buttons found:", { phoneBtn, googleBtn, yangoBtn });

  if (phoneBtn) {
    phoneBtn.addEventListener("click", callLandlordPhone);
  } else {
    console.warn("❌ Phone button not found");
  }

  if (googleBtn) {
    googleBtn.addEventListener("click", openGoogleMaps);
  } else {
    console.warn("❌ Google button not found");
  }

  if (yangoBtn) {
    yangoBtn.addEventListener("click", openYango);
  } else {
    console.warn("❌ Yango button not found");
  }
});
