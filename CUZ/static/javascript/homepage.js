// /static/javascript/homepage.js
import { authorizedGet } from "./tokenManager.js";

console.log("🚀 HOMEPAGE CONTROLLER STARTED");

/* ===============================
   GLOBAL CONFIG
================================ */
const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";

const studentId = localStorage.getItem("user_id") || "";
const currentUserUniversity = localStorage.getItem("user_university") || "";
const token = localStorage.getItem("access_token") || "";

console.group("📦 LOCAL STORAGE DEBUG");
console.log("studentId:", studentId);
console.log("currentUserUniversity:", currentUserUniversity);
console.log("token exists:", !!token);
console.groupEnd();

let page = 1;
const limit = 10;
let hasMore = true;
let isLoading = false;
let selectedFilter = "all";
let selectedUniversity = "";
let scopedMode = false;

/* ===============================
   DOM REFERENCES
================================ */
const houseListEl = document.getElementById("houseList");
const loaderEl = document.getElementById("loader");
const uniSelect = document.getElementById("universitySelect");
const searchBtn = document.getElementById("searchBtn");
const signinHintEl = document.getElementById("signinHint");

console.log("📍 DOM CHECK:", {
  houseListEl,
  loaderEl,
  uniSelect,
  searchBtn,
  signinHintEl
});

/* ===============================
   HELPERS
================================ */
function log(...args) {
  console.debug("[HOMEPAGE]", ...args);
}

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
    return `${BASE_URL}/media/${url.replace(/^\/+/, "")}`;
  }
  return `${BASE_URL}${url}`;
}

function showLoader(show) {
  if (!loaderEl) return;
  loaderEl.style.display = show ? "block" : "none";
}

function showSignInHint(show, message) {
  if (!signinHintEl) return;
  signinHintEl.style.display = show ? "block" : "none";
  signinHintEl.textContent =
    message || "Sign in to see full details and contact landlords.";
}

/* ===============================
   NAVIGATION (CRITICAL FIX AREA)
================================ */
function goToDetail(house) {
  const uniParam =
    selectedUniversity ||
    house.university ||
    currentUserUniversity ||
    "";

  console.group("➡️ NAVIGATION DEBUG");
  console.log("House:", house.id);
  console.log("University chosen:", uniParam);
  console.log("Student ID:", studentId);

  if (!uniParam) {
    alert("University missing. Please select.");
    console.warn("❌ No university found");
    console.groupEnd();
    return;
  }

  if (!house.id) {
    console.error("❌ Missing house ID");
    console.groupEnd();
    return;
  }

  const finalUrl =
    `/detail.html?id=${encodeURIComponent(house.id)}` +
    `&university=${encodeURIComponent(uniParam)}` +
    (studentId ? `&student_id=${encodeURIComponent(studentId)}` : "");

  console.log("🌍 FINAL URL:", finalUrl);
  console.groupEnd();

  debugger; // 🔥 STOP HERE TO VERIFY PARAMS

  window.location.href = finalUrl;
}

/* ===============================
   RENDER HOUSE
================================ */
function renderHouse(house) {
  const card = document.createElement("div");
  card.className = "house-card";

  const coverImage = normalizeImageUrl(
    house.cover_image || house.image
  );

  const genderIcon = getGenderIcon(house.gender);

  const name = (house.name_boardinghouse || house.name || "").replace(/"/g, "");
  const location = house.location || "";

  card.innerHTML = `
    <img src="${coverImage}" alt="${name}" loading="lazy">
    <div class="info">
      <div class="details">
        <p class="house-name">${name}</p>
        <p class="location">📍 ${location}</p>
      </div>
      <div class="gender-badge">
        <img src="${genderIcon}">
      </div>
    </div>
  `;

  card.addEventListener("click", () => goToDetail(house));

  houseListEl.appendChild(card);
}

/* ===============================
   URL BUILDER
================================ */
function buildListUrl(pageNum = 1) {
  const pageParam = `&page=${pageNum}&limit=${limit}`;
  const filterParam = `&filter=${encodeURIComponent(selectedFilter)}`;

  if (scopedMode && selectedUniversity) {
    return `${BASE_URL}/home/scoped?student_id=${studentId}&university=${selectedUniversity}${pageParam}${filterParam}`;
  }

  const uniParam = selectedUniversity
    ? `&university=${selectedUniversity}`
    : "";

  const scopeParam = selectedUniversity ? "&scope=scoped" : "&scope=default";

  return `${BASE_URL}/home?student_id=${studentId}${uniParam}${scopeParam}${pageParam}${filterParam}`;
}

/* ===============================
   FETCH WRAPPER
================================ */
async function fetchWithAuthFallback(url) {
  console.log("📡 FETCH:", url);

  try {
    if (typeof authorizedGet === "function") {
      const res = await authorizedGet(url);
      if (res && typeof res.status === "number") return res;

      return {
        ok: true,
        status: 200,
        json: async () => res
      };
    }
  } catch (err) {
    console.warn("authorizedGet failed:", err);
  }

  return fetch(url, {
    headers: {
      "Accept": "application/json",
      ...(token && { Authorization: `Bearer ${token}` })
    }
  });
}

/* ===============================
   FETCH HOUSES
================================ */
async function fetchHouses(refresh = false) {
  if (isLoading) return;

  if (refresh) {
    page = 1;
    hasMore = true;
    houseListEl.innerHTML = "";
  }

  if (!hasMore) return;

  isLoading = true;
  showLoader(true);

  const url = buildListUrl(page);

  console.group("📡 FETCH HOUSES");
  console.log("URL:", url);
  debugger;

  try {
    const res = await fetchWithAuthFallback(url);

    const data = await res.json();

    console.log("📥 RESPONSE:", data);

    const houses = data?.data || [];

    if (!houses.length) {
      console.warn("⚠️ No houses found");
      hasMore = false;
      return;
    }

    houses.forEach(renderHouse);

    page++;
    hasMore = houses.length === limit;

  } catch (err) {
    console.error("❌ FETCH ERROR:", err);
  }

  console.groupEnd();
  isLoading = false;
  showLoader(false);
}

/* ===============================
   FILTERS
================================ */
document.querySelectorAll(".filter").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    selectedFilter = btn.dataset.filter || "all";

    console.log("🎯 Filter:", selectedFilter);

    fetchHouses(true);
  });
});

/* ===============================
   UNIVERSITY SELECT
================================ */
if (uniSelect) {
  uniSelect.addEventListener("change", (e) => {
    selectedUniversity = e.target.value;
    console.log("🎓 Selected university:", selectedUniversity);
  });
}

/* ===============================
   SEARCH
================================ */
if (searchBtn) {
  searchBtn.addEventListener("click", () => {
    if (!selectedUniversity) {
      alert("Select a university first");
      return;
    }

    scopedMode = true;

    console.log("🔍 Scoped search:", selectedUniversity);

    fetchHouses(true);
  });
}

/* ===============================
   SCROLL
================================ */
window.addEventListener("scroll", () => {
  if (isLoading || !hasMore) return;

  const nearBottom =
    window.innerHeight + window.scrollY >=
    document.body.offsetHeight - 200;

  if (nearBottom) {
    fetchHouses();
  }
});

/* ===============================
   INIT
================================ */
(function init() {
  console.log("⚙️ INIT");

  if (currentUserUniversity && uniSelect) {
    uniSelect.value = currentUserUniversity;
    selectedUniversity = currentUserUniversity;
  }

  if (!studentId || !token) {
    showSignInHint(true, "Guest mode");
  }

  fetchHouses(true);
})();
