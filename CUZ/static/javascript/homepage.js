// /static/javascript/homepage.js
import { authorizedGet } from "./tokenManager.js";

const baseUrl = "https://klenoboardinghouse-production.up.railway.app";
const studentId = localStorage.getItem("user_id") || "";
const currentUserUniversity = localStorage.getItem("user_university") || "";

let page = 1;
const limit = 10;
let hasMore = true;
let isLoading = false;
let selectedFilter = "all";
let selectedUniversity = "";
let scopedMode = false; // when true use /home/scoped

// DOM
const houseListEl = document.getElementById("houseList");
const loaderEl = document.getElementById("loader");
const emptyEl = document.getElementById("empty");
const uniSelect = document.getElementById("universitySelect");
const searchBtn = document.getElementById("searchBtn");

// Helpers
function showLoader(show = true) {
  loaderEl.style.display = show ? "block" : "none";
}
function showEmpty(show = true) {
  emptyEl.style.display = show ? "block" : "none";
}
function normalizeImageUrl(url) {
  if (!url) return "https://via.placeholder.com/400x200";
  const s = String(url).trim();
  if (s.startsWith("http://") || s.startsWith("https://")) return s;
  if (s.startsWith("/")) return s;
  return s;
}
function getGenderIcon(gender) {
  const g = (gender || "").toLowerCase();
  if (g === "male") return "/static/assets/icons/male.png";
  if (g === "female") return "/static/assets/icons/female.png";
  if (g === "mixed") return "/static/assets/icons/mixed.png";
  return "/static/assets/icons/both.png";
}

// Render single house card
function renderHouse(house) {
  const card = document.createElement("div");
  card.className = "house-card";

  const coverImage = normalizeImageUrl(house.cover_image || house.image || house.coverImage);
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
    const uniParam = selectedUniversity || house.university || currentUserUniversity || "";
    if (!uniParam) {
      alert("University not available. Please select your university.");
      return;
    }
    const uniQuery = `&university=${encodeURIComponent(uniParam)}`;
    window.location.href = `/detail.html?id=${encodeURIComponent(house.id)}${uniQuery}&student_id=${encodeURIComponent(studentId)}`;
  });

  houseListEl.appendChild(card);
}

// Build URL for list endpoints
function buildListUrl(pageNum = 1) {
  const filterParam = `&filter=${encodeURIComponent(selectedFilter)}`;
  const pageParam = `&page=${pageNum}&limit=${limit}`;
  if (scopedMode && selectedUniversity) {
    // scoped endpoint
    return `${baseUrl}/home/scoped?student_id=${encodeURIComponent(studentId)}&university=${encodeURIComponent(selectedUniversity)}${pageParam}${filterParam}`;
  } else {
    // default /home endpoint (global or scoped via query)
    const uniParam = selectedUniversity ? `&university=${encodeURIComponent(selectedUniversity)}` : "";
    const scopeParam = selectedUniversity ? `&scope=scoped` : `&scope=default`;
    return `${baseUrl}/home?student_id=${encodeURIComponent(studentId)}${uniParam}${scopeParam}${pageParam}${filterParam}`;
  }
}

// Fetch houses (generic)
async function fetchHouses(refresh = false) {
  if (isLoading) return;
  if (refresh) {
    page = 1;
    hasMore = true;
    houseListEl.innerHTML = "";
    showEmpty(false);
  }
  if (!hasMore) return;

  isLoading = true;
  showLoader(true);

  const url = buildListUrl(page);
  console.log("[homepage] fetching:", url);

  try {
    const res = await authorizedGet(url);
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      console.error("[homepage] fetch failed", res.status, data);
      if (page === 1) showEmpty(true);
      return;
    }

    const houses = (data && data.data) ? data.data : [];
    if (!houses.length && page === 1) {
      showEmpty(true);
    } else {
      houses.forEach(renderHouse);
      page++;
      hasMore = houses.length === limit;
    }
  } catch (err) {
    console.error("[homepage] error", err);
    if (page === 1) showEmpty(true);
  } finally {
    isLoading = false;
    showLoader(false);
  }
}

// Event wiring
document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    selectedFilter = btn.dataset.filter || "all";
    page = 1;
    hasMore = true;
    houseListEl.innerHTML = "";
    fetchHouses(true);
  });
});

// University select change (updates selection but does not auto-search)
if (uniSelect) {
  uniSelect.addEventListener("change", (e) => {
    selectedUniversity = e.target.value || "";
    // do not trigger fetch automatically — wait for Search click
    console.log("[homepage] university selected:", selectedUniversity);
  });
}

// Search button triggers scoped search when a university is selected
if (searchBtn) {
  searchBtn.addEventListener("click", () => {
    if (!selectedUniversity) {
      alert("Please select a university first.");
      return;
    }
    scopedMode = true;
    page = 1;
    hasMore = true;
    houseListEl.innerHTML = "";
    fetchHouses(true);
  });
}

// Infinite scroll: respects scopedMode and pagination
window.addEventListener("scroll", () => {
  if (isLoading || !hasMore) return;
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 220;
  if (nearBottom) fetchHouses();
});

// Initial load: if user has a saved university, preselect it but do not auto-scope
(function init() {
  if (currentUserUniversity && uniSelect) {
    // try to set select to saved value if present in options
    const opt = Array.from(uniSelect.options).find(o => o.value === currentUserUniversity);
    if (opt) {
      uniSelect.value = currentUserUniversity;
      selectedUniversity = currentUserUniversity;
    }
  }
  fetchHouses(true);
})();
