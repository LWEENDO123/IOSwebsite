// /static/javascript/detail_controller.js
// Rewritten and hardened detail page controller
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

function safeOpen(url) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.warn("Could not open URL:", url, e);
  }
}

/* ===============================
   FETCH DATA + PREMIUM CHECK
================================ */
async function loadBoardingHouse() {
  if (!houseId) {
    console.error("Missing house id in query params");
    return;
  }

  try {
    const url = `${BASE_URL}/boardinghouse/${encodeURIComponent(houseId)}?university=${encodeURIComponent(university || "")}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.error("Failed to fetch boarding house:", res.status, await res.text().catch(() => ""));
      return;
    }

    const data = await res.json().catch(() => null);
    console.log("🏠 DATA:", data);

    if (!data) {
      console.error("No data returned for boarding house");
      return;
    }

    // PREMIUM CHECK: if not premium redirect to payment page
    // Use the correct path for your payment page
    if (data.premium === false || data.premium === "false") {
      console.warn("🚫 Not premium → redirecting to payment page");
      try {
        localStorage.setItem("redirect_after_payment", window.location.href);
      } catch (e) {
        console.warn("Could not set redirect_after_payment in localStorage", e);
      }
      // Redirect to the CUZ payment page (adjust if your path differs)
      window.location.href = "/CUZ/payment_page.html";
      return;
    }

    // Render UI
    renderGallery(Array.isArray(data.gallery) ? data.gallery : []);
    attachActions(data);

  } catch (err) {
    console.error("❌ Failed to load boarding house:", err);
  }
}

/* ===============================
   GALLERY (MODERN FIXED)
================================ */
function renderGallery(gallery = []) {
  const container = document.getElementById("imageSlider");
  if (!container) return;

  container.innerHTML = "";
  galleryData = Array.isArray(gallery) ? gallery : [];

  if (galleryData.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.textContent = "No images available";
    placeholder.style.padding = "12px";
    placeholder.style.color = "#666";
    container.appendChild(placeholder);
    return;
  }

  galleryData.forEach((item, index) => {
    const img = document.createElement("img");
    img.src = item?.url || "";
    img.alt = item?.alt || `Image ${index + 1}`;
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "cover";
    img.style.borderRadius = "12px";
    img.style.cursor = "pointer";

    img.addEventListener("click", () => openFullscreen(index));
    container.appendChild(img);
  });
}

/* ===============================
   FULLSCREEN VIEW (REELS STYLE)
================================ */
function openFullscreen(startIndex = 0) {
  if (!Array.isArray(galleryData) || galleryData.length === 0) return;
  currentIndex = Math.max(0, Math.min(startIndex, galleryData.length - 1));

  const overlay = document.createElement("div");
  overlay.style.position = "fixed";
  overlay.style.top = "0";
  overlay.style.left = "0";
  overlay.style.width = "100%";
  overlay.style.height = "100%";
  overlay.style.background = "rgba(0,0,0,0.95)";
  overlay.style.zIndex = "9999";
  overlay.style.display = "flex";
  overlay.style.alignItems = "center";
  overlay.style.justifyContent = "center";
  overlay.style.padding = "20px";
  overlay.style.boxSizing = "border-box";

  const img = document.createElement("img");
  img.src = galleryData[currentIndex]?.url || "";
  img.alt = galleryData[currentIndex]?.alt || "Image";
  img.style.maxWidth = "100%";
  img.style.maxHeight = "100%";
  img.style.objectFit = "contain";
  img.style.borderRadius = "8px";

  // Navigation controls
  const leftBtn = document.createElement("button");
  leftBtn.textContent = "‹";
  leftBtn.style.position = "absolute";
  leftBtn.style.left = "12px";
  leftBtn.style.top = "50%";
  leftBtn.style.transform = "translateY(-50%)";
  leftBtn.style.fontSize = "28px";
  leftBtn.style.background = "transparent";
  leftBtn.style.color = "#fff";
  leftBtn.style.border = "none";
  leftBtn.style.cursor = "pointer";

  const rightBtn = document.createElement("button");
  rightBtn.textContent = "›";
  rightBtn.style.position = "absolute";
  rightBtn.style.right = "12px";
  rightBtn.style.top = "50%";
  rightBtn.style.transform = "translateY(-50%)";
  rightBtn.style.fontSize = "28px";
  rightBtn.style.background = "transparent";
  rightBtn.style.color = "#fff";
  rightBtn.style.border = "none";
  rightBtn.style.cursor = "pointer";

  function updateImage() {
    img.src = galleryData[currentIndex]?.url || "";
    img.alt = galleryData[currentIndex]?.alt || `Image ${currentIndex + 1}`;
  }

  leftBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    currentIndex = (currentIndex - 1 + galleryData.length) % galleryData.length;
    updateImage();
  });

  rightBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    currentIndex = (currentIndex + 1) % galleryData.length;
    updateImage();
  });

  overlay.appendChild(img);
  overlay.appendChild(leftBtn);
  overlay.appendChild(rightBtn);
  document.body.appendChild(overlay);

  // Close on background click
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });

  // Touch swipe support
  let startX = 0;
  overlay.addEventListener("touchstart", (e) => {
    startX = e.touches?.[0]?.clientX || 0;
  }, { passive: true });

  overlay.addEventListener("touchend", (e) => {
    const endX = e.changedTouches?.[0]?.clientX || 0;
    if (endX < startX - 50) {
      currentIndex = (currentIndex + 1) % galleryData.length;
      updateImage();
    } else if (endX > startX + 50) {
      currentIndex = (currentIndex - 1 + galleryData.length) % galleryData.length;
      updateImage();
    }
  }, { passive: true });
}

/* ===============================
   ACTION BUTTONS
================================ */
function attachActions(data = {}) {
  const phoneBtn = document.getElementById("phoneBtn");
  const yangoBtn = document.getElementById("yangoBtn");
  const googleBtn = document.getElementById("googleBtn");
  const arrivalBtn = document.getElementById("arrivalBtn");

  // Phone
  if (phoneBtn) {
    if (data.phone_number) {
      phoneBtn.onclick = () => {
        // sanitize phone number
        const tel = String(data.phone_number).trim();
        window.location.href = `tel:${tel}`;
      };
    } else {
      phoneBtn.onclick = () => alert("Phone number not available");
    }
  }

  // Yango
  if (yangoBtn) {
    yangoBtn.onclick = () => {
      const coords = data.yango_coordinates || data.yango || null;
      if (!coords) return alert("No Yango location available");
      safeOpen(`https://yango.com/en/zm/?destination=${encodeURIComponent(coords)}`);
    };
  }

  // Google Maps
  if (googleBtn) {
    googleBtn.onclick = () => {
      const coords = data.GPS_coordinates || data.gps_coordinates || data.coordinates || null;
      if (!coords) return alert("No GPS location available");
      safeOpen(`https://www.google.com/maps?q=${encodeURIComponent(coords)}`);
    };
  }

  // Notify arrival
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
   - Tries a couple of reasonable endpoint shapes
================================ */
async function notifyArrival(id, universityParam, studentId, btn) {
  console.log("📍 Notify arrival...");

  setButtonLoading(btn, true);

  try {
    if (!id) throw new Error("Missing house id");
    if (!studentId) {
      alert("Please login to notify arrival");
      return;
    }

    // Try multiple endpoint shapes to be resilient
    const candidates = [
      `${BASE_URL}/boardinghouse/${encodeURIComponent(id)}/notify_arrival?university=${encodeURIComponent(universityParam || "")}`,
      `${BASE_URL}/${encodeURIComponent(universityParam || "")}/boardinghouse/${encodeURIComponent(id)}/notify_arrival`,
      `${BASE_URL}/boardinghouse/${encodeURIComponent(id)}/notify_arrival`
    ];

    let res = null;
    let lastErr = null;

    for (const url of candidates) {
      try {
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId })
        });
        // If we got a response (even 4xx/5xx), break and handle it
        if (res) break;
      } catch (err) {
        lastErr = err;
        console.warn("notifyArrival attempt failed for", url, err);
      }
    }

    if (!res) {
      throw lastErr || new Error("No response from notify endpoints");
    }

    const payload = await res.json().catch(() => null);

    if (!res.ok) {
      const msg = (payload && (payload.detail || payload.message)) || `Failed to notify (status ${res.status})`;
      alert(msg);
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
document.addEventListener("DOMContentLoaded", () => {
  // Defensive: ensure DOM elements exist before trying to use them
  try {
    loadBoardingHouse();
  } catch (e) {
    console.error("Initialization error:", e);
  }
});
