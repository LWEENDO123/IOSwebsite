// /static/javascript/homepage.js
import { authorizedGet } from "./tokenManager.js";

/*
  Full homepage controller
  - Keeps original image URL behavior (no normalization that prepends https)
  - Adds Search button to trigger scoped endpoint (/home/scoped)
  - Supports filters, pagination, infinite scroll
  - Minimal DOM assumptions: #houseList, #loader, #universitySelect, #searchBtn, .filter
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

// Helper: pick correct gender icon (keeps your original paths)
function getGenderIcon(gender) {
  const g = (gender || "").toLowerCase();
  if (g === "male") return "/static/assets/icons/male.png";
  if (g === "female") return "/static/assets/icons/female.png";
  if (g === "mixed") return "/static/assets/icons/mixed.png";
  return "/static/assets/icons/both.png";
}

// Show/hide loader
function showLoader(show) {
  if (!loaderEl) return;
  loaderEl.style.display = show ? "block" : "none";
}

// Render a single house card (keeps image URL exactly as returned by backend)
function renderHouse(house) {
  const card = document.createElement("div");
  card.className = "house-card";

  // Keep original image usage: do not alter or prepend protocol
  const coverImage = house.cover_image || house.image || "https://via.placeholder.com/400x200";
  const genderIcon = getGenderIcon(house.gender);

  card.innerHTML = `
    <img src="${coverImage}" alt="${(house.name_boardinghouse || house.name || '').replace(/"/g,'')}" loading="lazy">
    <div class="info">
      <div class="details">
        <p class="house-name">${house.name_boardinghouse || house.name || ''}</p>
        <p class="location">📍 ${house.location || ''}</p>
      </div>
      <div class="gender-badge">
        <img src="${genderIcon}" alt="${house.gender || 'both'}">
      </div>
    </div>
  `;

  card.addEventListener("click", () => {
    console.log("[DEBUG] Card clicked:", house.id);
    const uniParam = selectedUniversity || house.university || currentUserUniversity || "";
    if (!uniParam) {
      alert("University not available. Please select your university.");
      return;
    }
    const uniQuery = `&university=${encodeURIComponent(uniParam)}`;
    window.location.href = `/detail.html?id=${encodeURIComponent(house.id)}${uniQuery}&student_id=${encodeURIComponent(studentId)}`;
  });

  houseListEl.appendChild(card);
  console.log("[DEBUG] Card appended for:", house.name_boardinghouse || house.name);
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

// Fetch houses (respects scopedMode)
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
  console.log("[DEBUG] Fetching houses from:", url);

  try {
    const res = await authorizedGet(url);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("[DEBUG] Failed response:", res.status, data);
      if (page === 1 && houseListEl) houseListEl.innerHTML = `<div class="loader">No listings found.</div>`;
      return;
    }

    const houses = (data && data.data) ? data.data : [];
    if (!houses.length && page === 1) {
      if (houseListEl) houseListEl.innerHTML = `<div class="loader">No listings found.</div>`;
      hasMore = false;
      return;
    }

    houses.forEach(renderHouse);
    page++;
    hasMore = houses.length === limit;
    console.log("[DEBUG] hasMore:", hasMore, "next page:", page);
  } catch (err) {
    console.error("[DEBUG] Error fetching houses:", err);
    if (page === 1 && houseListEl) houseListEl.innerHTML = `<div class="loader">Error loading listings.</div>`;
  } finally {
    isLoading = false;
    showLoader(false);
  }
}

// Fetch scoped houses explicitly (wrapper that sets scopedMode true)
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
    console.log("[DEBUG] Filter selected:", selectedFilter);
    // Reset pagination and fetch
    page = 1;
    hasMore = true;
    if (houseListEl) houseListEl.innerHTML = "";
    fetchHouses(true);
  });
});

// University select change (updates selection but does not auto-search)
if (uniSelect) {
  uniSelect.addEventListener("change", (e) => {
    selectedUniversity = e.target.value || "";
    console.log("[DEBUG] University selected:", selectedUniversity);
    // Do not auto-trigger fetch here; wait for Search click
  });
}

// Search button triggers scoped search when a university is selected
if (searchBtn) {
  searchBtn.addEventListener("click", () => {
    if (!selectedUniversity) {
      alert("Please select a university first.");
      return;
    }
    console.log("[DEBUG] Search clicked, using scoped endpoint for:", selectedUniversity);
    page = 1;
    hasMore = true;
    if (houseListEl) houseListEl.innerHTML = "";
    fetchScopedHouses(true);
  });
}

// Infinite scroll: respects scopedMode
window.addEventListener("scroll", () => {
  if (isLoading || !hasMore) return;
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 220;
  if (nearBottom) {
    if (scopedMode && selectedUniversity) fetchScopedHouses();
    else fetchHouses();
  }
});

// Initial load: preselect saved university if present, then fetch
(function init() {
  if (currentUserUniversity && uniSelect) {
    const opt = Array.from(uniSelect.options).find(o => o.value === currentUserUniversity);
    if (opt) {
      uniSelect.value = currentUserUniversity;
      selectedUniversity = currentUserUniversity;
    }
  }
  // Start with global/home endpoint by default
  fetchHouses(true);
})();
