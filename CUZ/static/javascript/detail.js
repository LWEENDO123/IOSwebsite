// /static/javascript/detail_controller.js
// Fully rewritten, defensive, and debug-friendly detail page controller.
// Includes global instrumentation, robust fetch logic (uses authorizedGet), and clear console traces.
// Replace your existing detail.js with this file. Open DevTools Console and Network -> Sources to inspect logs.

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

function showUserError(msg) {
  try {
    console.warn("User error:", msg);
    let el = document.getElementById("detailError");
    if (!el) {
      el = document.createElement("div");
      el.id = "detailError";
      el.style.background = "#fff3f3";
      el.style.color = "#a00";
      el.style.padding = "12px";
      el.style.margin = "12px";
      el.style.borderRadius = "8px";
      el.style.fontWeight = "600";
      const container = document.querySelector("main") || document.body;
      container.insertBefore(el, container.firstChild);
    }
    el.textContent = msg;
  } catch (e) {
    console.error("showUserError failed:", e);
  }
}

function renderRetryUI(retryFn) {
  try {
    let wrapper = document.getElementById("detailRetry");
    if (!wrapper) {
      wrapper = document.createElement("div");
      wrapper.id = "detailRetry";
      wrapper.style.margin = "12px";
      const container = document.querySelector("main") || document.body;
      container.insertBefore(wrapper, container.firstChild ? container.firstChild.nextSibling : container.firstChild);
    }
    wrapper.innerHTML = "";
    const btn = document.createElement("button");
    btn.textContent = "Retry loading listing";
    btn.style.padding = "8px 12px";
    btn.style.borderRadius = "8px";
    btn.onclick = () => {
      wrapper.innerHTML = "Retrying…";
      retryFn();
    };
    wrapper.appendChild(btn);
  } catch (e) {
    console.error("renderRetryUI failed:", e);
  }
}

// ----------------------
// loadBoardingHouse (uses authorizedGet)
// ----------------------
const loadBoardingHouse = __detail_wrap(async function loadBoardingHouse() {
  __detail_trace("loadBoardingHouse:start");
  if (!houseId) {
    console.error("Missing house id in query params");
    showUserError("Missing listing id. Please open the listing link again.");
    return;
  }

  // Ensure we have a student id (frontend stores it in localStorage)
  const studentId = localStorage.getItem("user_id") || "";
  if (!studentId) {
    console.warn("No student_id in localStorage; user may not be logged in");
    showUserError("Please sign in to view this listing.");
    return;
  }

  const url = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(houseId)}?university=${encodeURIComponent(university || "")}&student_id=${encodeURIComponent(studentId)}`;
  __detail_trace("loadBoardingHouse:fetch-url", { url });

  try {
    // Use authorizedGet if available; otherwise fallback to fetch with token
    let res;
    if (typeof authorizedGet === "function") {
      try {
        res = await authorizedGet(url);
      } catch (err) {
        console.warn("authorizedGet failed, falling back to fetch:", err);
        res = null;
      }
    }

    if (!res) {
      // fallback: include token from localStorage if present
      const token = localStorage.getItem("access_token") || "";
      const headers = { "Accept": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      res = await fetch(url, { method: "GET", headers, credentials: "same-origin" });
    }

    __detail_trace("loadBoardingHouse:fetch-response", { status: res.status });

    // Read body for debugging
    let bodyText = "";
    try {
      bodyText = await res.text();
      try { bodyText = JSON.parse(bodyText); } catch (e) { /* keep raw text */ }
    } catch (e) {
      console.warn("Could not read response body", e);
    }

    if (res.status === 200) {
      const data = (typeof bodyText === "object") ? bodyText : (() => {
        try { return JSON.parse(String(bodyText)); } catch (e) { return bodyText; }
      })();

      __detail_trace("loadBoardingHouse:success", { keys: data ? Object.keys(data) : null });
      // Backend returns BoardingHouseSummary with "gallery" field (array)
      renderGallery(Array.isArray(data.gallery) ? data.gallery : []);
      attachActions(data);
      return;
    }

    if (res.status === 401 || res.status === 403) {
      console.error("Auth error fetching boarding house:", res.status, bodyText);
      showUserError("You must be signed in to view this listing. Please login and try again.");
      return;
    }

    if (res.status === 404) {
      console.warn("Listing not found:", res.status, bodyText);
      showUserError("Listing not found. It may have been removed or the university is incorrect.");
      renderRetryUI(loadBoardingHouse);
      return;
    }

    console.error("Unexpected response fetching boarding house:", res.status, bodyText);
    showUserError(`Server returned ${res.status}: ${JSON.stringify(bodyText)}`);
    renderRetryUI(loadBoardingHouse);
  } catch (err) {
    console.error("Network or unexpected error fetching boarding house:", err);
    showUserError("Network error. Please check your connection and try again.");
    renderRetryUI(loadBoardingHouse);
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
      `${BASE_URL}/home/boardinghouse/${encodeURIComponent(id)}/notify_arrival?university=${encodeURIComponent(universityParam || "")}`,
      `${BASE_URL}/${encodeURIComponent(universityParam || "")}/boardinghouse/${encodeURIComponent(id)}/notify_arrival`,
      `${BASE_URL}/boardinghouse/${encodeURIComponent(id)}/notify_arrival`
    ];

    __detail_trace("notifyArrival:candidates", { candidates });

    let res = null;
    let lastErr = null;

    for (const url of candidates) {
      try {
        __detail_trace("notifyArrival:trying", { url });
        // Use authorizedGet if available for POST; otherwise fallback to fetch with token
        if (typeof authorizedPost === "function") {
          try {
            res = await authorizedPost(url, { student_id: studentId });
          } catch (err) {
            console.warn("authorizedPost failed, falling back to fetch:", err);
            res = null;
          }
        }

        if (!res) {
          const token = localStorage.getItem("access_token") || "";
          const headers = { "Content-Type": "application/json" };
          if (token) headers["Authorization"] = `Bearer ${token}`;
          res = await fetch(url, {
            method: "POST",
            headers,
            body: JSON.stringify({ student_id: studentId }),
            credentials: "same-origin"
          });
        }

        if (res) break;
      } catch (err) {
        lastErr = err;
        console.warn("notifyArrival attempt failed for", url, err);
      }
    }

    if (!res) {
      throw lastErr || new Error("No response from notify endpoints");
    }

    let payload = null;
    try {
      const text = await res.text();
      try { payload = JSON.parse(text); } catch (e) { payload = text; }
    } catch (e) {
      console.warn("Could not parse notify response body", e);
    }

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
