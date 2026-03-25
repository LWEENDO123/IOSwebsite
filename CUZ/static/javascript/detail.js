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
   FETCH DATA
================================ */
async function loadBoardingHouse() {
  try {
    const res = await fetch(`${BASE_URL}/boardinghouse/${houseId}?university=${university}`);
    const data = await res.json();

    console.log("🏠 DATA:", data);

    renderGallery(data.gallery || []);
    attachActions(data);

  } catch (err) {
    console.error("❌ Failed to load:", err);
  }
}

/* ===============================
   GALLERY (MODERN + NO STRETCH)
================================ */
function renderGallery(gallery) {
  const container = document.getElementById("imageSlider");
  container.innerHTML = "";

  galleryData = gallery;

  gallery.forEach((item, index) => {
    const img = document.createElement("img");
    img.src = item.url;

    // ✅ FIX STRETCHING
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "12px";

    img.onclick = () => openFullscreen(index);

    container.appendChild(img);
  });
}

/* ===============================
   FULLSCREEN (REELS STYLE)
================================ */
function openFullscreen(startIndex) {
  currentIndex = startIndex;

  const overlay = document.createElement("div");
  overlay.id = "fullscreenGallery";

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

  // CLOSE
  overlay.onclick = () => overlay.remove();

  // SWIPE
  let startX = 0;

  overlay.addEventListener("touchstart", (e) => {
    startX = e.touches[0].clientX;
  });

  overlay.addEventListener("touchend", (e) => {
    let endX = e.changedTouches[0].clientX;

    if (endX < startX - 50) {
      // NEXT
      currentIndex = (currentIndex + 1) % galleryData.length;
    } else if (endX > startX + 50) {
      // PREV
      currentIndex = (currentIndex - 1 + galleryData.length) % galleryData.length;
    }

    img.src = galleryData[currentIndex].url;
  });
}

/* ===============================
   ACTIONS
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
      window.open(`https://yango.com/en/zm/?destination=${data.yango_coordinates}`);
    };
  }

  if (googleBtn) {
    googleBtn.onclick = () => {
      window.open(`https://www.google.com/maps?q=${data.GPS_coordinates}`);
    };
  }

  if (arrivalBtn) {
    arrivalBtn.onclick = (e) => {
      e.preventDefault();
      notifyArrival(houseId, university, "student123", arrivalBtn);
    };
  }
}

/* ===============================
   NOTIFY ARRIVAL
================================ */
async function notifyArrival(id, university, studentId, btn) {
  console.log("📍 Sending arrival...");

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
      alert(data.detail || "Failed");
      return;
    }

    alert("✅ Landlord notified");

  } catch (err) {
    console.error(err);
    alert("Error notifying");
  } finally {
    setButtonLoading(btn, false);
  }
}

/* ===============================
   INIT
================================ */
loadBoardingHouse();
