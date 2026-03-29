// /static/javascript/detail_controller.js
// Fully instrumented, defensive, and debug-friendly detail page controller.
// Paste this file to replace your existing detail.js. Open DevTools Console and Network -> Sources to inspect logs and trace failures.

(function __detail_debug_bootstrap__() {
  const RUN_ID = Date.now().toString(36);
  function now() { return new Date().toISOString(); }

  window.__detail_trace = window.__detail_trace || function trace(point, meta) {
    try {
      const payload = { run: RUN_ID, time: now(), point, meta };
      console.groupCollapsed(`TRACE ${point}`);
      console.log(payload);
      console.trace();
      console.groupEnd();
    } catch (e) {
      console.error("trace() failed", e);
    }
  };

  window.__detail_wrap = window.__detail_wrap || function wrap(fn, name) {
    if (typeof fn !== "function") return fn;
    return function wrapped(...args) {
      window.__detail_trace(`${name} - enter`, { argsLength: args.length });
      try {
        const result = fn.apply(this, args);
        if (result && typeof result.then === "function") {
          result.then(
            (v) => window.__detail_trace(`${name} - promise resolved`, { resultType: typeof v }),
            (err) => window.__detail_trace(`${name} - promise rejected`, { error: String(err) })
          );
        } else {
          window.__detail_trace(`${name} - exit`, { resultType: typeof result });
        }
        return result;
      } catch (err) {
        window.__detail_trace(`${name} - thrown`, { error: String(err) });
        throw err;
      }
    };
  };

  window.addEventListener("error", (ev) => {
    try {
      console.error("GLOBAL ERROR:", {
        message: ev.message,
        filename: ev.filename,
        lineno: ev.lineno,
        colno: ev.colno,
        error: ev.error && (ev.error.stack || String(ev.error))
      });
    } catch (e) {
      console.error("global error handler failed", e);
    }
  });

  window.addEventListener("unhandledrejection", (ev) => {
    try {
      console.error("UNHANDLED PROMISE REJECTION:", {
        reason: ev.reason && (ev.reason.stack || String(ev.reason))
      });
    } catch (e) {
      console.error("unhandledrejection handler failed", e);
    }
  });

  console.info("detail_controller debug bootstrap loaded — use __detail_trace('point') and __detail_wrap(fn,'name')");
})();

// ----------------------
// Config & params
// ----------------------
const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";
const params = new URLSearchParams(window.location.search);
const houseId = params.get("id");
const university = params.get("university");

__detail_trace("init.params", { houseId, university });

// ----------------------
// State
// ----------------------
let galleryData = [];
let currentIndex = 0;

// ----------------------
// Helpers
// ----------------------
function setButtonLoading(btn, loading) {
  try {
    if (!btn) return;
    btn.disabled = loading;
    btn.style.opacity = loading ? "0.6" : "1";
  } catch (err) {
    console.error("setButtonLoading error:", err);
  }
}

function safeOpen(url) {
  try {
    window.open(url, "_blank", "noopener,noreferrer");
  } catch (e) {
    console.warn("Could not open URL:", url, e);
  }
}

// ----------------------
// loadBoardingHouse
// ----------------------
const loadBoardingHouse = __detail_wrap(async function loadBoardingHouse() {
  __detail_trace("loadBoardingHouse:start");
  if (!houseId) {
    console.error("Missing house id in query params");
    return;
  }

  const url = `${BASE_URL}/boardinghouse/${encodeURIComponent(houseId)}?university=${encodeURIComponent(university || "")}`;
  __detail_trace("loadBoardingHouse:fetch-url", { url });

  try {
    const res = await fetch(url);
    __detail_trace("loadBoardingHouse:fetch-response", { status: res.status });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error("Failed to fetch boarding house:", res.status, text);
      return;
    }

    const data = await res.json().catch((e) => {
      console.error("JSON parse error:", e);
      return null;
    });

    __detail_trace("loadBoardingHouse:data", { keys: data ? Object.keys(data) : null });

    if (!data || typeof data !== "object") {
      console.error("Invalid data shape:", data);
      return;
    }

    // Interpret premium flag robustly
    const isPremium = data.premium === true || String(data.premium).toLowerCase() === "true";
    __detail_trace("loadBoardingHouse:premium-check", { raw: data.premium, interpreted: isPremium });

    if (!isPremium) {
      console.warn("Not premium → redirecting to payment page");
      try {
        localStorage.setItem("redirect_after_payment", window.location.href);
      } catch (e) {
        console.warn("Could not set redirect_after_payment in localStorage", e);
      }
      // Adjust path if your payment page is elsewhere
      window.location.href = "/CUZ/payment_page.html";
      return;
    }

    // Render and attach actions
    renderGallery(Array.isArray(data.gallery) ? data.gallery : []);
    attachActions(data);

  } catch (err) {
    console.error("loadBoardingHouse error:", err, err?.stack);
  } finally {
    __detail_trace("loadBoardingHouse:end");
  }
}, "loadBoardingHouse");

// ----------------------
// Gallery rendering
// ----------------------
function renderGallery(gallery = []) {
  __detail_trace("renderGallery:start", { length: Array.isArray(gallery) ? gallery.length : 0 });
  const container = document.getElementById("imageSlider");
  if (!container) {
    console.warn("No imageSlider container found in DOM");
    return;
  }

  container.innerHTML = "";
  galleryData = Array.isArray(gallery) ? gallery : [];

  if (galleryData.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.textContent = "No images available";
    placeholder.style.padding = "12px";
    placeholder.style.color = "#666";
    container.appendChild(placeholder);
    __detail_trace("renderGallery:empty");
    return;
  }

  galleryData.forEach((item, index) => {
    try {
      const img = document.createElement("img");
      img.src = item?.url || "";
      img.alt = item?.alt || `Image ${index + 1}`;
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "12px";
      img.style.cursor = "pointer";

      img.addEventListener("click", () => {
        try {
          openFullscreen(index);
        } catch (e) {
          console.error("openFullscreen error on click:", e);
        }
      });

      container.appendChild(img);
    } catch (err) {
      console.error("Error rendering gallery item", index, err);
    }
  });

  __detail_trace("renderGallery:done", { rendered: galleryData.length });
}

// ----------------------
// Fullscreen viewer
// ----------------------
function openFullscreen(startIndex = 0) {
  __detail_trace("openFullscreen:start", { startIndex, galleryLength: galleryData.length });
  try {
    if (!Array.isArray(galleryData) || galleryData.length === 0) {
      console.warn("openFullscreen: no gallery data");
      return;
    }

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
      try {
        img.src = galleryData[currentIndex]?.url || "";
        img.alt = galleryData[currentIndex]?.alt || `Image ${currentIndex + 1}`;
        __detail_trace("updateImage", { currentIndex, src: img.src });
      } catch (e) {
        console.error("updateImage error:", e);
      }
    }

    leftBtn.addEventListener("click", (e) => {
      try {
        e.stopPropagation();
        currentIndex = (currentIndex - 1 + galleryData.length) % galleryData.length;
        updateImage();
      } catch (err) {
        console.error("leftBtn click error:", err);
      }
    });

    rightBtn.addEventListener("click", (e) => {
      try {
        e.stopPropagation();
        currentIndex = (currentIndex + 1) % galleryData.length;
        updateImage();
      } catch (err) {
        console.error("rightBtn click error:", err);
      }
    });

    overlay.appendChild(img);
    overlay.appendChild(leftBtn);
    overlay.appendChild(rightBtn);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", (e) => {
      try {
        if (e.target === overlay) overlay.remove();
      } catch (err) {
        console.error("overlay click handler error:", err);
      }
    });

    // Touch swipe support
    let startX = 0;
    overlay.addEventListener("touchstart", (e) => {
      try {
        startX = e.touches?.[0]?.clientX || 0;
      } catch (err) {
        console.error("touchstart error:", err);
      }
    }, { passive: true });

    overlay.addEventListener("touchend", (e) => {
      try {
        const endX = e.changedTouches?.[0]?.clientX || 0;
        if (endX < startX - 50) {
          currentIndex = (currentIndex + 1) % galleryData.length;
          updateImage();
        } else if (endX > startX + 50) {
          currentIndex = (currentIndex - 1 + galleryData.length) % galleryData.length;
          updateImage();
        }
      } catch (err) {
        console.error("touchend error:", err);
      }
    }, { passive: true });

    __detail_trace("openFullscreen:overlayAppended", { currentIndex });
  } catch (err) {
    console.error("openFullscreen error:", err, err?.stack);
  } finally {
    __detail_trace("openFullscreen:end");
  }
}

// ----------------------
// Actions
// ----------------------
function attachActions(data = {}) {
  __detail_trace("attachActions:start", { keys: Object.keys(data || {}) });
  const phoneBtn = document.getElementById("phoneBtn");
  const yangoBtn = document.getElementById("yangoBtn");
  const googleBtn = document.getElementById("googleBtn");
  const arrivalBtn = document.getElementById("arrivalBtn");

  // Phone
  if (phoneBtn) {
    if (data.phone_number) {
      phoneBtn.onclick = () => {
        try {
          const tel = String(data.phone_number).trim();
          __detail_trace("phoneBtn:click", { tel });
          window.location.href = `tel:${tel}`;
        } catch (err) {
          console.error("phoneBtn onclick error:", err);
        }
      };
    } else {
      phoneBtn.onclick = () => alert("Phone number not available");
    }
  }

  // Yango
  if (yangoBtn) {
    yangoBtn.onclick = () => {
      try {
        const coords = data.yango_coordinates || data.yango || null;
        if (!coords) return alert("No Yango location available");
        safeOpen(`https://yango.com/en/zm/?destination=${encodeURIComponent(coords)}`);
      } catch (err) {
        console.error("yangoBtn onclick error:", err);
      }
    };
  }

  // Google Maps
  if (googleBtn) {
    googleBtn.onclick = () => {
      try {
        const coords = data.GPS_coordinates || data.gps_coordinates || data.coordinates || null;
        if (!coords) return alert("No GPS location available");
        safeOpen(`https://www.google.com/maps?q=${encodeURIComponent(coords)}`);
      } catch (err) {
        console.error("googleBtn onclick error:", err);
      }
    };
  }

  // Notify arrival
  if (arrivalBtn) {
    arrivalBtn.onclick = (e) => {
      try {
        e.preventDefault();
        const studentId = localStorage.getItem("user_id") || "";
        notifyArrival(houseId, university, studentId, arrivalBtn);
      } catch (err) {
        console.error("arrivalBtn onclick error:", err);
      }
    };
  }

  __detail_trace("attachActions:end");
}

// ----------------------
// Notify arrival
// ----------------------
const notifyArrival = __detail_wrap(async function notifyArrival(id, universityParam, studentId, btn) {
  __detail_trace("notifyArrival:start", { id, universityParam, studentId });
  setButtonLoading(btn, true);

  try {
    if (!id) throw new Error("Missing house id");
    if (!studentId) {
      alert("Please login to notify arrival");
      return;
    }

    const candidates = [
      `${BASE_URL}/boardinghouse/${encodeURIComponent(id)}/notify_arrival?university=${encodeURIComponent(universityParam || "")}`,
      `${BASE_URL}/${encodeURIComponent(universityParam || "")}/boardinghouse/${encodeURIComponent(id)}/notify_arrival`,
      `${BASE_URL}/boardinghouse/${encodeURIComponent(id)}/notify_arrival`
    ];

    __detail_trace("notifyArrival:candidates", { candidates });

    let res = null;
    let lastErr = null;

    for (const url of candidates) {
      try {
        __detail_trace("notifyArrival:trying", { url });
        res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ student_id: studentId })
        });
        // break on first response object (even if not ok)
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
    __detail_trace("notifyArrival:response", { status: res.status, payload });

    if (!res.ok) {
      const msg = (payload && (payload.detail || payload.message)) || `Failed to notify (status ${res.status})`;
      alert(msg);
      return;
    }

    alert("✅ Landlord notified of your arrival");
  } catch (err) {
    console.error("notifyArrival error:", err, err?.stack);
    alert("Error sending notification");
  } finally {
    setButtonLoading(btn, false);
    __detail_trace("notifyArrival:end");
  }
}, "notifyArrival");

// ----------------------
// Init
// ----------------------
document.addEventListener("DOMContentLoaded", __detail_wrap(() => {
  __detail_trace("DOMContentLoaded");
  try {
    loadBoardingHouse();
  } catch (e) {
    console.error("Initialization error:", e, e?.stack);
  }
}, "DOMContentLoaded-handler"));

// End marker
__detail_trace("detail_controller:loaded");
console.debug("detail_controller.js loaded");
