// /static/javascript/detail_controller.js
// Detail page controller that tolerates unauthenticated users
import { authorizedGet } from "./tokenManager.js";

console.log("🚀 DETAIL CONTROLLER STARTED (resilient mode)");

const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";
const params = new URLSearchParams(window.location.search);
const houseId = params.get("id");
const university = params.get("university");
const studentIdParam = params.get("student_id") || ""; // passed from homepage if available
const storedStudentId = localStorage.getItem("user_id") || "";
const effectiveStudentId = studentIdParam || storedStudentId || ""; // prefer query param if present

// DOM refs
const phoneBtn = document.getElementById("phoneBtn");
const yangoBtn = document.getElementById("yangoBtn");
const googleBtn = document.getElementById("googleBtn");
const arrivalBtn = document.getElementById("arrivalBtn");
const imageSlider = document.getElementById("imageSlider");
const statusMessage = document.getElementById("statusMessage");
const signinHintEl = document.getElementById("signinHint"); // optional

function log(...args) { console.debug("[DETAIL]", ...args); }
function showStatus(msg, isError = false) {
  if (!statusMessage) return;
  statusMessage.textContent = msg;
  statusMessage.style.color = isError ? "#a00" : "#080";
}

// Show sign-in hint
function showSignInHint(show, message) {
  if (!signinHintEl) return;
  signinHintEl.style.display = show ? "block" : "none";
  signinHintEl.textContent = message || "Sign in to contact landlords and see full details.";
}

// Normalize media path (same logic as homepage)
function normalizeMediaUrl(url) {
  if (!url) return null;
  if (url.startsWith("http")) return url;
  if (!url.startsWith("/media/")) return `${BASE_URL}/media/${url.replace(/^\/+/, "")}`;
  return `${BASE_URL}${url}`;
}

// Render gallery
function renderGallery(gallery = []) {
  if (!imageSlider) return;
  imageSlider.innerHTML = "";
  if (!Array.isArray(gallery) || gallery.length === 0) {
    const p = document.createElement("div");
    p.textContent = "No images available";
    imageSlider.appendChild(p);
    return;
  }
  gallery.forEach(item => {
    const img = document.createElement("img");
    img.src = normalizeMediaUrl(item.url || item);
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "12px";
    imageSlider.appendChild(img);
  });
}

// Fetch wrapper that prefers authorizedGet but tolerates unauthenticated access
async function fetchWithAuthFallback(url, opts = {}) {
  if (typeof authorizedGet === "function") {
    try {
      log("Trying authorizedGet for", url);
      const res = await authorizedGet(url);
      if (res && typeof res.status === "number") return res;
      return { ok: true, status: 200, json: async () => res, text: async () => JSON.stringify(res) };
    } catch (err) {
      log("authorizedGet failed:", err);
    }
  }

  // fallback to unauthenticated fetch (may be limited)
  try {
    const token = localStorage.getItem("access_token") || "";
    const headers = { "Accept": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    log("Falling back to fetch for", url);
    const res = await fetch(url, { method: "GET", headers, credentials: "same-origin", ...opts });
    return res;
  } catch (err) {
    log("Network fetch failed:", err);
    throw err;
  }
}

// Load boarding house details
async function loadBoardingHouse() {
  if (!houseId) {
    showStatus("Missing listing id", true);
    return;
  }

  // Build URL with required query params (backend expects student_id and university)
  const studentToSend = effectiveStudentId || ""; // may be empty
  const url = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(houseId)}?university=${encodeURIComponent(university || "")}&student_id=${encodeURIComponent(studentToSend)}`;
  log("Fetching detail from:", url);

  try {
    const res = await fetchWithAuthFallback(url);
    // If auth required and we don't have it, backend may return 401/403
    if (res.status === 401 || res.status === 403) {
      log("Not signed in or token invalid:", res.status);
      showSignInHint(true, "You are not signed in. Sign in to view full details and contact landlords.");
      // Try to parse any public payload
      let body = null;
      try { body = await res.json(); } catch (e) { body = null; }
      if (!body) {
        showStatus("Sign in to view this listing", true);
        return;
      }
      // If backend returned some public data, continue with limited view
      populateDetail(body, true);
      return;
    }

    if (res.status === 404) {
      const text = await res.text().catch(() => "");
      showStatus("Listing not found", true);
      log("Detail 404 body:", text);
      return;
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      showStatus("Error loading listing", true);
      log("Unexpected response:", res.status, text);
      return;
    }

    const data = await res.json().catch(() => null);
    if (!data) {
      showStatus("Invalid listing data", true);
      return;
    }

    // Backend returns BoardingHouseSummary model; it may be an object with fields
    populateDetail(data, false);
  } catch (err) {
    console.error("[DETAIL] Error loading boarding house:", err);
    showStatus("Network error loading listing", true);
  }
}

// Populate UI with data; limited flag hides contact actions if true
function populateDetail(data, limited = false) {
  log("populateDetail limited=", limited, data);
  // Gallery
  const gallery = Array.isArray(data.gallery) ? data.gallery : (data.data && Array.isArray(data.data.gallery) ? data.data.gallery : []);
  renderGallery(gallery);

  // Attach actions only if not limited
  attachActions(data, limited);

  // Show some basic info if present
  const titleEl = document.getElementById("listingTitle");
  if (titleEl) titleEl.textContent = data.name || data.name_boardinghouse || "Listing";

  if (limited) {
    showStatus("Limited view: sign in to see full details and contact landlord", true);
  } else {
    showStatus("Listing loaded");
    showSignInHint(false);
  }
}

// Attach actions; if limited=true, disable phone/arrival actions
function attachActions(data = {}, limited = false) {
  // Phone
  if (phoneBtn) {
    if (!limited && data.phone_number) {
      phoneBtn.onclick = () => {
        const tel = String(data.phone_number).trim();
        window.location.href = `tel:${tel}`;
      };
      phoneBtn.disabled = false;
    } else {
      phoneBtn.onclick = () => alert("Phone number not available. Sign in to view landlord contact.");
      phoneBtn.disabled = true;
    }
  }

  // Yango
  if (yangoBtn) {
    yangoBtn.onclick = () => {
      const coords = data.yango_coordinates || data.yango || null;
      if (!coords) return alert("No Yango location available");
      window.open(`https://yango.com/en/zm/?destination=${encodeURIComponent(coords)}`, "_blank", "noopener,noreferrer");
    };
  }

  // Google Maps
  if (googleBtn) {
    googleBtn.onclick = () => {
      const coords = data.GPS_coordinates || data.gps_coordinates || data.coordinates || null;
      if (!coords) return alert("No GPS location available");
      window.open(`https://www.google.com/maps?q=${encodeURIComponent(coords)}`, "_blank", "noopener,noreferrer");
    };
  }

  // Notify arrival
  if (arrivalBtn) {
    arrivalBtn.onclick = (e) => {
      e.preventDefault();
      if (limited || !effectiveStudentId) {
        alert("Please sign in to notify arrival.");
        return;
      }
      // call notify endpoint (we attempt authorizedPost if available)
      notifyArrival(houseId, university, effectiveStudentId, arrivalBtn);
    };
  }
}

// notifyArrival uses authorizedPost if available, otherwise falls back to fetch with token
async function notifyArrival(id, universityParam, studentIdToSend, btn) {
  if (!id || !studentIdToSend) {
    alert("Missing information to notify arrival.");
    return;
  }
  btn.disabled = true;
  try {
    const url = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(id)}/notify_arrival?university=${encodeURIComponent(universityParam || "")}`;
    log("notifyArrival url:", url);

    // Try authorizedPost if available
    if (typeof authorizedPost === "function") {
      try {
        const resp = await authorizedPost(url, { student_id: studentIdToSend });
        if (resp && resp.status && resp.status >= 200 && resp.status < 300) {
          alert("✅ Landlord notified of your arrival");
          return;
        }
        // If authorizedPost returned parsed JSON, check for success
        if (resp && !resp.status) {
          alert("✅ Landlord notified (response received)");
          return;
        }
      } catch (err) {
        log("authorizedPost failed:", err);
      }
    }

    // Fallback fetch
    const token = localStorage.getItem("access_token") || "";
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ student_id: studentIdToSend }),
      credentials: "same-origin"
    });

    if (res.ok) {
      alert("✅ Landlord notified of your arrival");
    } else {
      const text = await res.text().catch(() => "");
      alert(`Failed to notify: ${res.status} ${text}`);
    }
  } catch (err) {
    console.error("notifyArrival error:", err);
    alert("Error sending notification");
  } finally {
    btn.disabled = false;
  }
}

// Init
(function init() {
  // If no effectiveStudentId, show sign-in hint but still attempt to load public/limited data
  if (!effectiveStudentId) {
    showSignInHint(true, "You are viewing as a guest. Sign in to contact landlords and see full details.");
  } else {
    showSignInHint(false);
  }
  loadBoardingHouse();
})();
