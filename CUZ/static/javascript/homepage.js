// /static/javascript/homepage.js
import { authorizedGet } from "./tokenManager.js";

/*
  Homepage controller (fixed)
  - Ensures student_id and token are passed to detail page
  - Uses authorizedGet when available
  - Falls back to fetch with Authorization header
  - Shows sign-in hint in guest mode
*/

const baseUrl = "https://klenoboardinghouse-production.up.railway.app";
const studentId = localStorage.getItem("user_id") || "";
const currentUserUniversity = localStorage.getItem("user_university") || "";
const token = localStorage.getItem("access_token") || "";

let page = 1;
const limit = 10;
let hasMore = true;
let isLoading = false;
let selectedFilter = "all";
let selectedUniversity = "";
let scopedMode = false;

// DOM refs
const houseListEl = document.getElementById("houseList");
const loaderEl = document.getElementById("loader");
const uniSelect = document.getElementById("universitySelect");
const searchBtn = document.getElementById("searchBtn");
const signinHintEl = document.getElementById("signinHint");

function log(...args) { console.debug("[HOMEPAGE]", ...args); }

// Helpers
function getGenderIcon(gender) {
  const g = (gender || "").toLowerCase();
  if (g === "male") return "/static/assets/icons/male.png";
  if (g === "female") return "/static/assets/icons/female.png";
  if (g === "mixed") return "/static/assets/icons/mixed.png";
  return "/static/assets/icons/both.png";
}

function normalizeImageUrl(url) {
  if (!url) return "https://via.placeholder.com/400x200";
  if (url.startsWith("http")) return url;
  if (!url.startsWith("/media/")) {
    return `${baseUrl}/media/${url.replace(/^\/+/, "")}`;
  }
  return `${baseUrl}${url}`;
}

function showLoader(show) {
  if (!loaderEl) return;
  loaderEl.style.display = show ? "block" : "none";
}

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
    const uniParam = selectedUniversity || house.university || currentUserUniversity || "";
    if (!uniParam) {
      alert("University not available. Please select your university.");
      return;
    }
    const uniQuery = `&university=${encodeURIComponent(uniParam)}`;
    const studentQuery = studentId ? `&student_id=${encodeURIComponent(studentId)}` : "";
    window.location.href = `/detail.html?id=${encodeURIComponent(house.id)}${uniQuery}${studentQuery}`;
  });

  houseListEl.appendChild(card);
  log("Card appended for:", name);
}

// Build list URL
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

// Fetch wrapper
async function fetchWithAuthFallback(url, opts = {}) {
  if (typeof authorizedGet === "function") {
    try {
      log("Using authorizedGet for", url);
      const res = await authorizedGet(url);
      if (res && typeof res.status === "number") return res;
      return { ok: true, status: 200, json: async () => res, text: async () => JSON.stringify(res) };
    } catch (err) {
      log("authorizedGet failed:", err);
    }
  }

  try {
    const headers = { "Accept": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    log("Fallback fetch for", url, "with token:", !!token);
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
    if (res.status === 401 || res.status === 403) {
      log("Auth required or invalid token:", res.status);
      showSignInHint(true, "You are not signed in. Sign in to see full details and contact landlords.");
      let data = null;
      try { data = await res.json(); } catch (e) { data = null; }
      if (!data || !data.data) {
        if (page === 1 && houseListEl) houseListEl.innerHTML = `<div class="loader">Sign in to view listings.</div>`;
        return;
      }
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

    if (!studentId || !token) {
      showSignInHint(true, "You are browsing in guest mode. Sign in to contact landlords and see full details.");
    } else {
      showSignInHint(false);
    }

    houses.forEach(h => renderHouse(h, !studentId || !token));
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

// Wire up filters
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

// University select
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
    if (scopedMode && selectedUniversity) {
      fetchScopedHouses();
    } else {
      fetchHouses();
    }
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

  // If no studentId or token, show sign-in hint but still load limited listings
  if (!studentId || !token) {
    showSignInHint(true, "You are browsing as a guest. Sign in to access full features.");
  } else {
    showSignInHint(false);
  }

  fetchHouses(true);
})();
