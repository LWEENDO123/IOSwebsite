import { authorizedGet, authorizedPost } from "./tokenManager.js";

console.log("🚀 DETAIL CONTROLLER STARTED");

/* ===============================
   BASE URL
================================ */
const BASE_URL = "https://klenoboardinghouse-production.up.railway.app/home";

/* ===============================
   PAGE PARAMETERS
================================ */
const params = new URLSearchParams(window.location.search);

const houseId = params.get("id");
const university = params.get("university");
const studentId =
  params.get("student_id") ||
  localStorage.getItem("user_id");

/* ===============================
   DEBUG
================================ */
console.log("📦 PARAM DEBUG");
console.log("Full URL:", window.location.href);
console.log("houseId:", houseId);
console.log("university:", university);
console.log("studentId:", studentId);

/* ===============================
   STATE
================================ */
let galleryData = [];
let currentIndex = 0;

/* ===============================
   LOAD BOARDING HOUSE (FIXED)
================================ */
async function loadBoardingHouse() {
  console.log("📡 LOAD BOARDING HOUSE");

  try {
    if (!studentId) {
      console.warn("❌ Missing student_id");
      alert("Session expired. Please login again.");
      return;
    }

    const url = `${BASE_URL}/boardinghouse/${houseId}?university=${university}&student_id=${studentId}`;

    console.log("🌍 REQUEST URL:", url);

    // ✅ USE AUTHORIZED GET (THIS FIXES YOUR 401)
    const res = await authorizedGet(url);

    console.log("📡 STATUS:", res.status);

    if (res.status === 401) {
      console.warn("🔐 Unauthorized AFTER retry");
      alert("Session expired. Please login again.");
      return;
    }

    const data = await res.json();

    console.log("🏠 DATA:", data);

    populateDetail(data);

  } catch (err) {
    console.error("❌ LOAD ERROR:", err);
  }
}

/* ===============================
   POPULATE PAGE
================================ */
function populateDetail(data) {
  renderGallery(data.gallery || []);
  attachActions(data);
}

/* ===============================
   GALLERY
================================ */
function renderGallery(gallery) {
  const container = document.getElementById("imageSlider");
  if (!container) return;

  container.innerHTML = "";
  galleryData = gallery;

  if (!gallery.length) return;

  gallery.forEach((item, index) => {
    const img = document.createElement("img");

    img.src = item.url;

    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "12px";

    img.onclick = () => openFullscreen(index);

    container.appendChild(img);
  });
}

/* ===============================
   FULLSCREEN (SWIPE)
================================ */
function openFullscreen(startIndex) {
  currentIndex = startIndex;

  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position:fixed;
    top:0;left:0;
    width:100%;height:100%;
    background:black;
    z-index:9999;
    display:flex;
    align-items:center;
    justify-content:center;
  `;

  const img = document.createElement("img");
  img.src = galleryData[currentIndex].url;
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";

  overlay.appendChild(img);
  document.body.appendChild(overlay);

  overlay.onclick = () => overlay.remove();

  let startX = 0;

  overlay.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  overlay.addEventListener("touchend", (e) => {
    let endX = e.changedTouches[0].clientX;

    if (endX < startX - 50) {
      currentIndex = (currentIndex + 1) % galleryData.length;
    } else if (endX > startX + 50) {
      currentIndex =
        (currentIndex - 1 + galleryData.length) % galleryData.length;
    }

    img.src = galleryData[currentIndex].url;
  });
}

/* ===============================
   ACTION BUTTONS
================================ */
function attachActions(data) {
  const phoneBtn = document.getElementById("phoneBtn");
  const yangoBtn = document.getElementById("yangoBtn");
  const googleBtn = document.getElementById("googleBtn");
  const arrivalBtn = document.getElementById("arrivalBtn");

  if (phoneBtn) {
    phoneBtn.onclick = () => {
      window.location.href = `tel:${data.phone_number}`;
    };
  }

  if (yangoBtn) {
    yangoBtn.onclick = () => {
      window.open(
        `${BASE_URL}/yango/${houseId}?university=${university}&student_id=${studentId}`,
        "_blank"
      );
    };
  }

  if (googleBtn) {
    googleBtn.onclick = () => {
      window.open(
        `${BASE_URL}/google/${houseId}?university=${university}&student_id=${studentId}`,
        "_blank"
      );
    };
  }

  if (arrivalBtn) {
    arrivalBtn.onclick = (e) => {
      e.preventDefault();
      notifyArrival(arrivalBtn);
    };
  }
}

/* ===============================
   NOTIFY ARRIVAL (FIXED)
================================ */
async function notifyArrival(btn) {
  console.log("📍 NOTIFY ARRIVAL");

  try {
    const url = `${BASE_URL}/${university}/boardinghouse/${houseId}/notify_arrival`;

    console.log("🌍 POST URL:", url);

    // ✅ USE AUTHORIZED POST
    const res = await authorizedPost(url, {
      student_id: studentId,
    });

    console.log("📡 STATUS:", res.status);

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Failed");
      return;
    }

    alert("✅ Arrival sent");

  } catch (err) {
    console.error("❌ ARRIVAL ERROR:", err);
  }
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  console.log("⚙️ INIT DETAIL PAGE");
  loadBoardingHouse();
});
