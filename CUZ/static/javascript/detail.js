import { authorizedGet } from "./tokenManager.js";
console.log("DETAIL JS LOADED");

const baseUrl = "https://klenoboardinghouse-production.up.railway.app";

const params = new URLSearchParams(window.location.search);
const houseId = params.get("id");
const university = params.get("university");
const studentId = params.get("student_id");

// ----------------------------
// Utility Helpers
// ----------------------------

function showError(message) {
  alert(message || "Something went wrong");
}

function validateParams() {
  if (!houseId || !university || !studentId) {
    showError("Missing required parameters.");
    return false;
  }
  return true;
}

function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject("Geolocation not supported");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
        });
      },
      (err) => {
        reject("Location permission denied");
      }
    );
  });
}

async function handleResponse(res) {
  if (!res.ok) {
    try {
      const err = await res.json();
      throw new Error(err.detail || "Access denied (Premium required)");
    } catch {
      throw new Error("Access denied (Premium required)");
    }
  }
  return res.json();
}

// ----------------------------
// Phone
// ----------------------------

async function callLandlordPhone() {
  if (!validateParams()) return;

  try {
    const url = `${baseUrl}/home/boardinghouse/${encodeURIComponent(
      houseId
    )}/landlord-phone?university=${encodeURIComponent(
      university
    )}&student_id=${encodeURIComponent(studentId)}`;

    const res = await authorizedGet(url);
    const data = await handleResponse(res);

    if (data.phone_number?.trim()) {
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
// Google Maps (Premium)
// ----------------------------

async function openGoogleMaps() {
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

    const res = await authorizedGet(url);
    const data = await handleResponse(res);

    if (data.link?.trim()) {
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
// Yango (Premium - Flutter Mirror)
// ----------------------------

async function openYango() {
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

    const res = await authorizedGet(url);
    const data = await handleResponse(res);

    const deepLink = data.deep_link?.trim();
    const browserLink = data.browser_link?.trim();

    let launched = false;

    // Try deep link first (mobile behavior)
    if (deepLink) {
      try {
        window.location.href = deepLink;
        launched = true;
      } catch {
        launched = false;
      }
    }

    // Fallback to browser link
    if (!launched && browserLink) {
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
  const phoneBtn = document.querySelector(".action-icon.phone");
  const googleBtn = document.querySelector(".action-icon.google");
  const yangoBtn = document.querySelector(".action-icon.yango");

  if (phoneBtn) phoneBtn.addEventListener("click", callLandlordPhone);
  if (googleBtn) googleBtn.addEventListener("click", openGoogleMaps);
  if (yangoBtn) yangoBtn.addEventListener("click", openYango);
});
