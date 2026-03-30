console.log("🚀 DETAIL CONTROLLER STARTED");

/* ===============================
   GLOBAL CONFIG (FIXED)
================================ */
const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";

/* ===============================
   PAGE PARAMETERS + DEBUG
================================ */
const params = new URLSearchParams(window.location.search);

const houseId = params.get("id");
const university = params.get("university");

const studentId =
  params.get("student_id") ||
  localStorage.getItem("user_id");

console.group("📦 PARAM DEBUG");
console.log("Full URL:", window.location.href);
console.log("houseId:", houseId);
console.log("university:", university);
console.log("studentId:", studentId);
console.groupEnd();

debugger;

/* ===============================
   VALIDATION (CRITICAL)
================================ */
if (!houseId || !university || !studentId) {
  console.error("❌ Missing required params", {
    houseId,
    university,
    studentId
  });

  alert("Missing required data. Please reopen from homepage.");
}

/* ===============================
   STATE
================================ */
let galleryData = [];
let currentIndex = 0;

/* ===============================
   AUTH HELPER
================================ */
function getAuthHeaders() {
  const token = localStorage.getItem("access_token");

  console.log("🔐 TOKEN EXISTS:", !!token);

  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/* ===============================
   FETCH DATA
================================ */
async function loadBoardingHouse() {
  console.group("📡 LOAD BOARDING HOUSE");

  try {
    if (!studentId) {
      console.warn("❌ Missing student_id");
      alert("Session expired. Please login again.");
      return;
    }

    const url =
      `${BASE_URL}/home/boardinghouse/${houseId}` +
      `?university=${university}&student_id=${studentId}`;

    console.log("🌍 REQUEST URL:", url);

    debugger;

    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });

    console.log("📡 STATUS:", res.status);

    if (res.status === 401) {
      console.warn("🔐 Unauthorized");
      alert("Session expired. Please login again.");
      return;
    }

    const data = await res.json();

    console.log("🏠 RESPONSE DATA:", data);

    if (!data) {
      console.warn("⚠️ Empty response");
      return;
    }

    populateDetail(data);

  } catch (err) {
    console.error("❌ LOAD ERROR:", err);
  }

  console.groupEnd();
}

/* ===============================
   POPULATE PAGE
================================ */
function populateDetail(data) {
  console.log("🧩 POPULATING PAGE");

  renderGallery(data.gallery || []);
  attachActions(data);
}

/* ===============================
   GALLERY
================================ */
function renderGallery(gallery) {
  const container = document.getElementById("imageSlider");

  console.log("🖼️ GALLERY INIT:", gallery);

  if (!container) {
    console.error("❌ imageSlider not found");
    return;
  }

  container.innerHTML = "";
  galleryData = gallery;

  if (!gallery.length) {
    console.warn("⚠️ No images available");
    return;
  }

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
   FULLSCREEN SWIPE VIEW
================================ */
function openFullscreen(startIndex) {
  console.log("🖼️ OPEN FULLSCREEN:", startIndex);

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
    const endX = e.changedTouches[0].clientX;

    if (endX < startX - 50) {
      currentIndex = (currentIndex + 1) % galleryData.length;
    } else if (endX > startX + 50) {
      currentIndex =
        (currentIndex - 1 + galleryData.length) % galleryData.length;
    }

    console.log("➡️ SWIPE INDEX:", currentIndex);

    img.src = galleryData[currentIndex].url;
  });
}

/* ===============================
   ACTION BUTTONS
================================ */
function attachActions(data) {
  console.group("🔘 BUTTON SETUP");

  const phoneBtn = document.getElementById("phoneBtn");
  const yangoBtn = document.getElementById("yangoBtn");
  const googleBtn = document.getElementById("googleBtn");
  const arrivalBtn = document.getElementById("arrivalBtn");

  console.log("BUTTON CHECK:", {
    phoneBtn,
    yangoBtn,
    googleBtn,
    arrivalBtn
  });

  debugger;

  if (phoneBtn) {
    phoneBtn.onclick = () => {
      console.log("📞 Calling:", data.phone_number);
      window.location.href = `tel:${data.phone_number}`;
    };
  }

  if (yangoBtn) {
    yangoBtn.onclick = () => {
      console.log("🚕 YANGO CLICKED");

      if (!data.yango_coordinates) {
        alert("No Yango location");
        return;
      }

      const url =
        `${BASE_URL}/yango/${houseId}` +
        `?university=${university}&student_id=${studentId}`;

      console.log("🌍 YANGO URL:", url);

      debugger;

      window.location.href = url; // ✅ MOBILE SAFE
    };
  }

  if (googleBtn) {
    googleBtn.onclick = () => {
      console.log("🗺️ GOOGLE CLICKED");

      if (!data.GPS_coordinates) {
        alert("No GPS location");
        return;
      }

      const url =
        `${BASE_URL}/google/${houseId}` +
        `?university=${university}&student_id=${studentId}`;

      console.log("🌍 GOOGLE URL:", url);

      debugger;

      window.location.href = url; // ✅ MOBILE SAFE
    };
  }

  if (arrivalBtn) {
    arrivalBtn.onclick = (e) => {
      e.preventDefault();
      console.log("📡 ARRIVAL CLICKED");
      notifyArrival();
    };
  }

  console.groupEnd();
}

/* ===============================
   NOTIFY ARRIVAL
================================ */
async function notifyArrival() {
  console.group("📡 NOTIFY ARRIVAL");

  try {
    const url =
      `${BASE_URL}/${university}/boardinghouse/${houseId}/notify_arrival`;

    console.log("POST URL:", url);

    const res = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        student_id: studentId,
      }),
    });

    const data = await res.json();

    console.log("📥 RESPONSE:", data);

    if (!res.ok) {
      alert(data.detail || "Failed");
      return;
    }

    alert("✅ Arrival sent");

  } catch (err) {
    console.error("❌ ARRIVAL ERROR:", err);
  }

  console.groupEnd();
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  console.log("⚙️ INIT DETAIL PAGE");
  loadBoardingHouse();
});
