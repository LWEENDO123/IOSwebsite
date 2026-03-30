console.log("🚀 DETAIL CONTROLLER STARTED");

const BASE_URL = "https://klenoboardinghouse-production.up.railway.app/home";

/* ===============================
   PAGE PARAMETERS
================================ */
const params = new URLSearchParams(window.location.search);

const houseId = params.get("id");
const university = params.get("university");

// ✅ IMPORTANT
const studentId =
  params.get("student_id") ||
  localStorage.getItem("user_id");

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

  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` }),
  };
}

/* ===============================
   FETCH DATA (FIXED)
================================ */
async function loadBoardingHouse() {
  try {
    console.log("📡 Loading house...");

    if (!studentId) {
      console.warn("❌ Missing student_id");
      alert("Session expired. Please login again.");
      return;
    }

    const url = `${BASE_URL}/boardinghouse/${houseId}?university=${university}&student_id=${studentId}`;

    console.log("🌍 URL:", url);

    const res = await fetch(url, {
      headers: getAuthHeaders(),
    });

    if (res.status === 401) {
      console.warn("🔐 Unauthorized");
      alert("Session expired. Please login again.");
      return;
    }

    const data = await res.json();

    console.log("🏠 DATA:", data);

    populateDetail(data);

  } catch (err) {
    console.error("❌ Failed to load:", err);
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
      if (!data.yango_coordinates)
        return alert("No Yango location");

      window.open(
        `${BASE_URL}/yango/${houseId}?university=${university}&student_id=${studentId}`,
        "_blank"
      );
    };
  }

  if (googleBtn) {
    googleBtn.onclick = () => {
      if (!data.GPS_coordinates)
        return alert("No GPS location");

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
  try {
    const url = `${BASE_URL}/${university}/boardinghouse/${houseId}/notify_arrival`;

    const res = await fetch(url, {
      method: "POST",
      headers: getAuthHeaders(),
      body: JSON.stringify({
        student_id: studentId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Failed");
      return;
    }

    alert("✅ Arrival sent");

  } catch (err) {
    console.error("❌ Arrival error:", err);
  }
}

/* ===============================
   INIT
================================ */
document.addEventListener("DOMContentLoaded", () => {
  loadBoardingHouse();
});
