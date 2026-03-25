console.log("🚀 DETAIL CONTROLLER STARTED");

const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";

/* ===============================
   PAGE PARAMETERS
================================ */
const params = new URLSearchParams(window.location.search);
const houseId = params.get("id");
const university = params.get("university");

/* ===============================
   STATE
================================ */
let galleryData = [];
let currentIndex = 0;

/* ===============================
   HELPERS
================================ */
function setButtonLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.style.opacity = loading ? "0.6" : "1";
}

/* ===============================
   FETCH DATA + PREMIUM CHECK
================================ */
async function loadBoardingHouse() {
  try {
    const res = await fetch(`${BASE_URL}/boardinghouse/${houseId}?university=${university}`);
    const data = await res.json();

    console.log("🏠 DATA:", data);

    // ✅ PREMIUM CHECK
    if (data.premium === false) {
      console.warn("🚫 Not premium → redirecting");

      localStorage.setItem("redirect_after_payment", window.location.href);
      window.location.href = "/static/payment.html";
      return;
    }

    // ✅ Continue normally
    renderGallery(data.gallery || []);
    attachActions(data);

  } catch (err) {
    console.error("❌ Failed to load:", err);
  }
}

/* ===============================
   GALLERY (MODERN FIXED)
================================ */
function renderGallery(gallery) {
  const container = document.getElementById("imageSlider");
  if (!container) return;

  container.innerHTML = "";
  galleryData = gallery;

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
   FULLSCREEN VIEW (REELS STYLE)
================================ */
function openFullscreen(startIndex) {
  currentIndex = startIndex;

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "black";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";

  const img = document.createElement("img");
  img.src = galleryData[currentIndex].url;
  img.style.width = "100%";
  img.style.height = "100%";
  img.style.objectFit = "contain";

  overlay.appendChild(img);
  document.body.appendChild(overlay);

  // Close on tap
  overlay.onclick = () => overlay.remove();

  // Swipe support
  let startX = 0;

  overlay.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  overlay.addEventListener("touchend", (e) => {
    let endX = e.changedTouches[0].clientX;

    if (endX < startX - 50) {
      currentIndex = (currentIndex + 1) % galleryData.length;
    } else if (endX > startX + 50) {
      currentIndex = (currentIndex - 1 + galleryData.length) % galleryData.length;
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
      if (!data.yango_coordinates) return alert("No Yango location");
      window.open(`https://yango.com/en/zm/?destination=${data.yango_coordinates}`);
    };
  }

  if (googleBtn) {
    googleBtn.onclick = () => {
      if (!data.GPS_coordinates) return alert("No GPS location");
      window.open(`https://www.google.com/maps?q=${data.GPS_coordinates}`);
    };
  }

  if (arrivalBtn) {
    arrivalBtn.onclick = (e) => {
      e.preventDefault();
      const studentId = localStorage.getItem("user_id") || "";
      notifyArrival(houseId, university, studentId, arrivalBtn);
    };
  }
}

/* ===============================
   NOTIFY ARRIVAL
================================ */
async function notifyArrival(id, university, studentId, btn) {
  console.log("📍 Notify arrival...");

  setButtonLoading(btn, true);

  try {
    const url = `${BASE_URL}/${university}/boardinghouse/${id}/notify_arrival`;

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        student_id: studentId
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Failed to notify");
      return;
    }

    alert("✅ Landlord notified of your arrival");

  } catch (err) {
    console.error("❌ Arrival error:", err);
    alert("Error sending notification");
  } finally {
    setButtonLoading(btn, false);
  }
}

/* ===============================
   INIT
================================ */
loadBoardingHouse();
