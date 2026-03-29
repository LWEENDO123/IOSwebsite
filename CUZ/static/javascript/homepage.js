// /static/javascript/homepage.js
import { authorizedGet } from "./tokenManager.js";

/*
  Homepage controller (resilient when user is not signed in)
  - Uses authorizedGet when available
  - Falls back to unauthenticated fetch for public listing if allowed
  - If unauthenticated, shows limited view and a sign-in prompt
  - Passes student_id to detail page only when present
*/

const baseUrl = "https://klenoboardinghouse-production.up.railway.app";
const studentId = localStorage.getItem("user_id") || "";
const currentUserUniversity = localStorage.getItem("user_university") || "";

let page = 1;
const limit = 10;
let hasMore = true;
let isLoading = false;
let selectedFilter = "all";
let selectedUniversity = "";
let scopedMode = false; // when true, use /home/scoped endpoint

// DOM refs
const houseListEl = document.getElementById("houseList");
const loaderEl = document.getElementById("loader");
const uniSelect = document.getElementById("universitySelect");
const searchBtn = document.getElementById("searchBtn");
const signinHintEl = document.getElementById("signinHint"); // optional element to show sign-in prompt

function log(...args) { console.debug("[HOMEPAGE]", ...args); }

// Helper: pick correct gender icon
function getGenderIcon(gender) {
  const g = (gender || "").toLowerCase();
  if (g === "male") return "/static/assets/icons/male.png";
  if (g === "female") return "/static/assets/icons/female.png";
  if (g === "mixed") return "/static/assets/icons/mixed.png";
  return "/static/assets/icons/both.png";
}

// Helper: normalize image URLs
function normalizeImageUrl(url) {
  if (!url) return "https://via.placeholder.com/400x200";
  if (url.startsWith("http")) return url;
  if (!url.startsWith("/media/")) {
    return `${baseUrl}/media/${url.replace(/^\/+/, "")}`;
  }
  return `${baseUrl}${url}`;
}

// Show/hide loader
function showLoader(show) {
  if (!loaderEl) return;
  loaderEl.style.display = show ? "block" : "none";
}

// Show sign-in hint
function showSignInHint(show, message) {
  if (!signinHintEl) return;
  signinHintEl.style.display = show ? "block" : "none";
  signinHintEl.textContent = message || "Sign in to see full details and contact landlords.";
}

// Render a single house card
function renderHouse(house, limited = false) {
  const card = document.createElement("div");
  card.className = "house-card";

  const coverImage = normalizeImageUrl(house.cover_image || house.image);
  const genderIcon = getGenderIcon(house.gender);

  // If limited view, hide sensitive fields like price or contact
  const name = (house.name_boardinghouse || house.name || '').replace(/"/g,'');
  const location = house.location || '';

  card.innerHTML = `
    <img src="${coverImage}" alt="${name}" loading="lazy">
    <div class="info">
      <div class="details">
        <p class="house-name">${name}</p>
        <p class="location">📍 ${location}</p>
      </div>
      <div class="gender-badge">
        <img src="${genderIcon}" alt="${house.gender || 'both'}">
      </div>
    </div>
  `;

  card.addEventListener("click", () => {
    log("Card clicked:", house.id);
    // Pass student_id only if present
    const uniParam = selectedUniversity || house.university || currentUserUniversity || "";
    if (!uniParam) {
      alert("University not available. Please select your university.");
      return;
    }
    const uniQuery = `&university=${encodeURIComponent(uniParam)}`;
    const studentQuery = studentId ? `&student_id=${encodeURIComponent(studentId)}` : "";
    // Use the correct detail path (adjust if your detail page path differs)
    window.location.href = `/detail.html?id=${encodeURIComponent(house.id)}${uniQuery}${studentQuery}`;
  });

  houseListEl.appendChild(card);
  log("Card appended for:", name);
}

// Build list URL depending on scopedMode and selectedUniversity
function buildListUrl(pageNum = 1) {
  const pageParam = `&page=${pageNum}&limit=${limit}`;
  const filterParam = `&filter=${encodeURIComponent(selectedFilter)}`;

  if (scopedMode && selectedUniversity) {
    return `${baseUrl}/home/scoped?student_id=${encodeURIComponent(studentId)}&university=${encodeURIComponent(selectedUniversity)}${pageParam}${filterParam}`;
  }

  const uniParam = selectedUniversity ? `&university=${encodeURIComponent(selectedUniversity)}` : "";
  const scopeParam = selectedUniversity ? `&scope=scoped` : `&scope=default`;
  return `${baseUrl}/home?student_id=${encodeURIComponent(studentId)}${uniParam}${scopeParam}${pageParam}${filterParam}`;
}

// Generic fetch wrapper that prefers authorizedGet but handles unauthenticated gracefully
async function fetchWithAuthFallback(url, opts = {}) {
  // Try authorizedGet if available
  if (typeof authorizedGet === "function") {
    try {
      log("Using authorizedGet for", url);
      const res = await authorizedGet(url);
      // If authorizedGet returns parsed JSON instead of Response, normalize
      if (res && typeof res.status === "number") return res;
      // If it returned parsed data, wrap it in a fake Response-like object
      return { ok: true, status: 200, json: async () => res, text: async () => JSON.stringify(res) };
    } catch (err) {
      log("authorizedGet failed:", err);
      // fall through to unauthenticated fetch
    }
  }

  // Fallback: unauthenticated fetch (may be blocked by backend)
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

// Fetch houses
async function fetchHouses(refresh = false) {
  if (isLoading) return;
  if (refresh) {
    page = 1;
    hasMore = true;
    if (houseListEl) houseListEl.innerHTML = "";
  }
  if (!hasMore) return;

  isLoading = true;
  showLoader(true);

  const url = buildListUrl(page);
  log("Fetching houses from:", url);

  try {
    const res = await fetchWithAuthFallback(url);
    // If server returned 401/403, show sign-in hint and try to render limited data if any
    if (res.status === 401 || res.status === 403) {
      log("Auth required or invalid token:", res.status);
      showSignInHint(true, "You are not signed in. Sign in to see full details and contact landlords.");
      // Try to parse body for any public data
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      // If no data, show limited message and stop
      if (!data || !data.data) {
        if (page === 1 && houseListEl) houseListEl.innerHTML = `<div class="loader">Sign in to view listings.</div>`;
        return;
      }
      // Otherwise continue with limited data
    }

    const data = await (async () => {
      try { return await res.json(); } catch (e) { return null; }
    })();

    if (!res.ok && res.status !== 401 && res.status !== 403) {
      log("Failed response:", res.status, data);
      if (page === 1 && houseListEl) houseListEl.innerHTML = `<div class="loader">No listings found.</div>`;
      return;
    }

    const houses = (data && data.data) ? data.data : [];
    if (!houses.length && page === 1) {
      if (houseListEl) houseListEl.innerHTML = `<div class="loader">No listings found.</div>`;
      hasMore = false;
      return;
    }

    // If user is not signed in, show sign-in hint but still render cards (limited)
    if (!studentId) {
      showSignInHint(true, "You are browsing in guest mode. Sign in to contact landlords and see full details.");
    } else {
      showSignInHint(false);
    }

    houses.forEach(h => renderHouse(h, !studentId));
    page++;
    hasMore = houses.length === limit;
    log("hasMore:", hasMore, "next page:", page);
  } catch (err) {
    console.error("[HOMEPAGE] Error fetching houses:", err);
    if (page === 1 && houseListEl) houseListEl.innerHTML = `<div class="loader">Error loading listings.</div>`;
  } finally {
    isLoading = false;
    showLoader(false);
  }
}

// Fetch scoped houses
async function fetchScopedHouses(refresh = false) {
  scopedMode = true;
  await fetchHouses(refresh);
}

// Wire up filter buttons
document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedFilter = btn.dataset.filter || "all";
    log("Filter selected:", selectedFilter);
    page = 1;
    hasMore = true;
    if (houseListEl) houseListEl.innerHTML = "";
    fetchHouses(true);
  });
});

// University select change
if (uniSelect) {
  uniSelect.addEventListener("change", (e) => {
    selectedUniversity = e.target.value || "";
    log("University selected:", selectedUniversity);
  });
}

// Search button
if (searchBtn) {
  searchBtn.addEventListener("click", () => {
    if (!selectedUniversity) {
      alert("Please select a university first.");
      return;
    }
    log("Search clicked, using scoped endpoint for:", selectedUniversity);
    page = 1;
    hasMore = true;
    if (houseListEl) houseListEl.innerHTML = "";
    fetchScopedHouses(true);
  });
}

// Infinite scroll
window.addEventListener("scroll", () => {
  if (isLoading || !hasMore) return;
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 220;
  if (nearBottom) {
    if (scopedMode && selectedUniversity) fetchScopedHouses();
    else fetchHouses();
  }
});

// Initial load
(function init() {
  if (currentUserUniversity && uniSelect) {
    const opt = Array.from(uniSelect.options).find(o => o.value === currentUserUniversity);
    if (opt) {
      uniSelect.value = currentUserUniversity;
      selectedUniversity = currentUserUniversity;
    }
  }
  // If no studentId, show sign-in hint but still load public/limited listings
  if (!studentId) {
    showSignInHint(true, "You are browsing as a guest. Sign in to access full features.");
  } else {
    showSignInHint(false);
  }
  fetchHouses(true);
})();
