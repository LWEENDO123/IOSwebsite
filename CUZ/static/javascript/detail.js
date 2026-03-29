// /static/javascript/detail_controller.js
// Fully instrumented detail controller with verbose tracing and optional debugger breakpoints.
// Purpose: pinpoint why images are not loading and why "must be signed in" behavior occurs.
// Install by replacing your current detail.js. Open DevTools Console and Network -> Sources to inspect traces.
// Toggle DEBUG_PAUSE to true to cause the debugger to break at key checkpoints.

(function __detail_debug_bootstrap__() {
  const RUN_ID = Date.now().toString(36);
  function now() { return new Date().toISOString(); }

  window.__detail_debug = {
    runId: RUN_ID,
    now,
    enabled: true,
    pauseOnTrace: false, // set to true in console to pause on each trace
    trace(point, meta) {
      if (!window.__detail_debug.enabled) return;
      try {
        const payload = { run: RUN_ID, time: now(), point, meta };
        console.groupCollapsed(`TRACE ${point}`);
        console.log(payload);
        console.trace();
        console.groupEnd();
        if (window.__detail_debug.pauseOnTrace) debugger;
      } catch (e) {
        console.error("trace() failed", e);
      }
    },
    wrap(fn, name) {
      if (typeof fn !== "function") return fn;
      return function wrapped(...args) {
        window.__detail_debug.trace(`${name} - enter`, { argsLength: args.length });
        try {
          const result = fn.apply(this, args);
          if (result && typeof result.then === "function") {
            result.then(
              (v) => window.__detail_debug.trace(`${name} - promise resolved`, { resultType: typeof v }),
              (err) => window.__detail_debug.trace(`${name} - promise rejected`, { error: String(err) })
            );
          } else {
            window.__detail_debug.trace(`${name} - exit`, { resultType: typeof result });
          }
          return result;
        } catch (err) {
          window.__detail_debug.trace(`${name} - thrown`, { error: String(err) });
          throw err;
        }
      };
    }
  };

  // Global handlers
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

  console.info("detail_controller debug bootstrap loaded — use __detail_debug.trace('point', meta) and __detail_debug.wrap(fn,'name')");
})();

// ----------------------
// Config & params
// ----------------------
const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";
const params = new URLSearchParams(window.location.search);
const houseId = params.get("id");
const university = params.get("university");
const studentIdParam = params.get("student_id") || "";
const storedStudentId = localStorage.getItem("user_id") || "";
const effectiveStudentId = studentIdParam || storedStudentId || "";

__detail_debug.trace("init.params", { houseId, university, studentIdParam, storedStudentId, effectiveStudentId });

// ----------------------
// DOM refs
// ----------------------
const imageSlider = document.getElementById("imageSlider");
const phoneBtn = document.getElementById("phoneBtn");
const yangoBtn = document.getElementById("yangoBtn");
const googleBtn = document.getElementById("googleBtn");
const arrivalBtn = document.getElementById("arrivalBtn");
const statusMessage = document.getElementById("statusMessage");
const signinHintEl = document.getElementById("signinHint");
const titleEl = document.getElementById("listingTitle");

// ----------------------
// State
// ----------------------
let galleryData = [];
let currentIndex = 0;
let DEBUG_PAUSE = false; // set to true in console to trigger debugger at key points

function dbgPause() { if (DEBUG_PAUSE) debugger; }

// ----------------------
// Helpers
// ----------------------
function log(...args) { console.debug("[DETAIL]", ...args); }
function showStatus(msg, isError = false) {
  if (!statusMessage) {
    console.warn("statusMessage element missing:", msg);
    return;
  }
  statusMessage.textContent = msg;
  statusMessage.style.color = isError ? "#a00" : "#080";
}
function showSignInHint(show, message) {
  if (!signinHintEl) return;
  signinHintEl.style.display = show ? "block" : "none";
  signinHintEl.textContent = message || "Sign in to view full details and contact landlords.";
}
function normalizeMediaUrl(url) {
  if (!url) return null;
  if (typeof url !== "string") return null;
  if (url.startsWith("http")) return url;
  if (!url.startsWith("/media/")) return `${BASE_URL}/media/${url.replace(/^\/+/, "")}`;
  return `${BASE_URL}${url}`;
}

// Small utility to inspect the served JS file end in console if needed
function inspectLoadedScript() {
  try {
    const scripts = Array.from(document.scripts).map(s => ({ src: s.src, inline: s.innerText ? s.innerText.slice(0, 120) : null }));
    console.debug("Loaded scripts snapshot:", scripts.slice(-6));
  } catch (e) {
    console.warn("inspectLoadedScript failed", e);
  }
}

// ----------------------
// Fetch wrapper (prefer authorizedGet if present)
// ----------------------
async function fetchWithAuthFallback(url, opts = {}) {
  __detail_debug.trace("fetchWithAuthFallback:start", { url });
  dbgPause();

  // Try authorizedGet if available (tokenManager.js)
  if (typeof window.authorizedGet === "function") {
    try {
      __detail_debug.trace("fetchWithAuthFallback:using-authorizedGet", { url });
      const res = await window.authorizedGet(url);
      // If authorizedGet returns a Response-like object, return it
      if (res && typeof res.status === "number") {
        __detail_debug.trace("fetchWithAuthFallback:authorizedGet-returned-response", { status: res.status });
        return res;
      }
      // If it returned parsed JSON, wrap it
      __detail_debug.trace("fetchWithAuthFallback:authorizedGet-returned-json", { type: typeof res });
      return { ok: true, status: 200, json: async () => res, text: async () => JSON.stringify(res) };
    } catch (err) {
      console.warn("authorizedGet failed:", err);
      __detail_debug.trace("fetchWithAuthFallback:authorizedGet-failed", { error: String(err) });
    }
  }

  // Fallback to fetch with token from localStorage
  try {
    const token = localStorage.getItem("access_token") || "";
    const headers = { "Accept": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    __detail_debug.trace("fetchWithAuthFallback:fallback-fetch", { url, hasToken: !!token });
    const res = await fetch(url, { method: "GET", headers, credentials: "same-origin", ...opts });
    __detail_debug.trace("fetchWithAuthFallback:fetch-response", { status: res.status });
    return res;
  } catch (err) {
    __detail_debug.trace("fetchWithAuthFallback:fetch-error", { error: String(err) });
    throw err;
  } finally {
    dbgPause();
  }
}

// ----------------------
// Load boarding house details
// ----------------------
const loadBoardingHouse = __detail_debug.wrap(async function loadBoardingHouse() {
  __detail_debug.trace("loadBoardingHouse:start", { houseId, university, effectiveStudentId });
  dbgPause();

  if (!houseId) {
    showStatus("Missing listing id", true);
    __detail_debug.trace("loadBoardingHouse:missing-houseId");
    return;
  }

  // Build URL expected by backend: /home/boardinghouse/{id}?university=...&student_id=...
  const url = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(houseId)}?university=${encodeURIComponent(university || "")}&student_id=${encodeURIComponent(effectiveStudentId || "")}`;
  __detail_debug.trace("loadBoardingHouse:fetch-url", { url });
  dbgPause();

  try {
    const res = await fetchWithAuthFallback(url);
    __detail_debug.trace("loadBoardingHouse:response-status", { status: res.status });
    dbgPause();

    // Read body for debugging
    let bodyRaw = null;
    try {
      bodyRaw = await res.text();
      __detail_debug.trace("loadBoardingHouse:body-raw", { length: String(bodyRaw).length });
    } catch (e) {
      __detail_debug.trace("loadBoardingHouse:body-read-error", { error: String(e) });
    }

    // Try to parse JSON
    let body = null;
    try {
      body = bodyRaw ? JSON.parse(bodyRaw) : null;
      __detail_debug.trace("loadBoardingHouse:body-parsed", { keys: body ? Object.keys(body) : null });
    } catch (e) {
      __detail_debug.trace("loadBoardingHouse:body-parse-failed", { error: String(e), rawPreview: String(bodyRaw).slice(0, 200) });
      body = null;
    }

    // Handle common statuses
    if (res.status === 401 || res.status === 403) {
      __detail_debug.trace("loadBoardingHouse:auth-required", { status: res.status, body });
      showSignInHint(true, "You are not signed in. Sign in to view full details and contact landlords.");
      // If backend returned some public payload, continue with limited view
      if (body) {
        populateDetail(body, true);
      } else {
        showStatus("Sign in to view this listing", true);
      }
      return;
    }

    if (res.status === 404) {
      __detail_debug.trace("loadBoardingHouse:not-found", { status: res.status, body });
      showStatus("Listing not found", true);
      return;
    }

    if (!res.ok) {
      __detail_debug.trace("loadBoardingHouse:unexpected-status", { status: res.status, body });
      showStatus(`Server error: ${res.status}`, true);
      return;
    }

    // Success path
    const data = body || (await res.json().catch(() => null));
    __detail_debug.trace("loadBoardingHouse:success-data", { keys: data ? Object.keys(data) : null, sampleGalleryLength: Array.isArray(data?.gallery) ? data.gallery.length : null });
    dbgPause();

    if (!data) {
      showStatus("Invalid listing data", true);
      return;
    }

    populateDetail(data, false);
  } catch (err) {
    __detail_debug.trace("loadBoardingHouse:exception", { error: String(err) });
    console.error("Error loading boarding house:", err);
    showStatus("Network error loading listing", true);
  } finally {
    __detail_debug.trace("loadBoardingHouse:end");
  }
}, "loadBoardingHouse");

// ----------------------
// Populate UI
// ----------------------
function populateDetail(data, limited = false) {
  __detail_debug.trace("populateDetail:start", { limited, keys: data ? Object.keys(data) : null });
  dbgPause();

  // Title
  try {
    if (titleEl) titleEl.textContent = data.name || data.name_boardinghouse || "Listing";
  } catch (e) {
    console.warn("populateDetail: title set failed", e);
  }

  // Gallery normalization: backend returns gallery array of {type, url, thumbnail_url, caption}
  let gallery = [];
  if (Array.isArray(data.gallery)) {
    gallery = data.gallery.map((it, idx) => {
      try {
        const url = it && (it.url || it.image || it.src) ? normalizeMediaUrl(it.url || it.image || it.src) : null;
        return { ...it, url, index: idx };
      } catch (e) {
        __detail_debug.trace("populateDetail:gallery-item-error", { idx, error: String(e) });
        return null;
      }
    }).filter(Boolean);
  } else if (Array.isArray(data.data?.gallery)) {
    gallery = data.data.gallery.map((it, idx) => ({ ...it, url: normalizeMediaUrl(it.url || it.image || it.src), index: idx }));
  } else {
    __detail_debug.trace("populateDetail:no-gallery-array", { galleryFieldType: typeof data.gallery });
  }

  __detail_debug.trace("populateDetail:gallery-ready", { length: gallery.length });
  dbgPause();

  renderGallery(gallery);

  // Attach actions (phone, maps, arrival)
  attachActions(data, limited);

  if (limited) {
    showStatus("Limited view: sign in to see full details and contact landlord", true);
    showSignInHint(true, "Sign in to view full details and contact landlord.");
  } else {
    showStatus("Listing loaded");
    showSignInHint(false);
  }

  __detail_debug.trace("populateDetail:end");
}

// ----------------------
// Gallery rendering + fullscreen
// ----------------------
function renderGallery(gallery = []) {
  __detail_debug.trace("renderGallery:start", { galleryLength: Array.isArray(gallery) ? gallery.length : 0 });
  dbgPause();

  galleryData = Array.isArray(gallery) ? gallery : [];
  if (!imageSlider) {
    __detail_debug.trace("renderGallery:no-imageSlider");
    return;
  }

  imageSlider.innerHTML = "";

  if (galleryData.length === 0) {
    const placeholder = document.createElement("div");
    placeholder.textContent = "No images available";
    placeholder.style.padding = "12px";
    placeholder.style.color = "#666";
    imageSlider.appendChild(placeholder);
    __detail_debug.trace("renderGallery:empty");
    return;
  }

  galleryData.forEach((item, index) => {
    try {
      const img = document.createElement("img");
      img.dataset.index = index;
      img.src = item.url || "";
      img.alt = item.caption || `Image ${index + 1}`;
      img.loading = "lazy";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.borderRadius = "12px";
      img.style.cursor = "pointer";

      // Image load/error tracing
      img.addEventListener("load", (e) => {
        __detail_debug.trace("image:loaded", { index, src: img.src });
      });
      img.addEventListener("error", (e) => {
        __detail_debug.trace("image:error", { index, src: img.src, error: String(e) });
        // show placeholder on error
        img.src = "https://via.placeholder.com/800x450?text=Image+not+available";
      });

      img.addEventListener("click", () => openFullscreen(index));
      imageSlider.appendChild(img);
    } catch (err) {
      __detail_debug.trace("renderGallery:item-exception", { index, error: String(err) });
    }
  });

  __detail_debug.trace("renderGallery:done", { rendered: galleryData.length });
  dbgPause();
}

function openFullscreen(startIndex = 0) {
  __detail_debug.trace("openFullscreen:start", { startIndex, galleryLength: galleryData.length });
  dbgPause();

  if (!Array.isArray(galleryData) || galleryData.length === 0) {
    __detail_debug.trace("openFullscreen:no-gallery");
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
  img.alt = galleryData[currentIndex]?.caption || "Image";
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
      img.alt = galleryData[currentIndex]?.caption || `Image ${currentIndex + 1}`;
      __detail_debug.trace("openFullscreen:updateImage", { currentIndex, src: img.src });
    } catch (e) {
      __detail_debug.trace("openFullscreen:updateImage-error", { error: String(e) });
    }
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

  __detail_debug.trace("openFullscreen:overlayAppended", { currentIndex });
  dbgPause();
}

// ----------------------
// Actions (phone, maps, arrival)
// ----------------------
function attachActions(data = {}, limited = false) {
  __detail_debug.trace("attachActions:start", { limited, keys: Object.keys(data || {}) });
  dbgPause();

  // Phone
  if (phoneBtn) {
    if (!limited && data.phone_number) {
      phoneBtn.onclick = () => {
        try {
          const tel = String(data.phone_number).trim();
          __detail_debug.trace("phoneBtn:click", { tel });
          window.location.href = `tel:${tel}`;
        } catch (err) {
          console.error("phoneBtn onclick error:", err);
        }
      };
      phoneBtn.disabled = false;
    } else {
      phoneBtn.onclick = () => alert("Phone number not available. Sign in to view landlord contact.");
      phoneBtn.disabled = true;
    }
  }

  // Yango
  if (yangoBtn) {
    yangoBtn.onclick = () => {
      try {
        const coords = data.yango_coordinates || data.yango || null;
        if (!coords) return alert("No Yango location available");
        window.open(`https://yango.com/en/zm/?destination=${encodeURIComponent(coords)}`, "_blank", "noopener,noreferrer");
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
        window.open(`https://www.google.com/maps?q=${encodeURIComponent(coords)}`, "_blank", "noopener,noreferrer");
      } catch (err) {
        console.error("googleBtn onclick error:", err);
      }
    };
  }

  // Notify arrival
  if (arrivalBtn) {
    arrivalBtn.onclick = (e) => {
      e.preventDefault();
      if (!effectiveStudentId) {
        alert("Please sign in to notify arrival.");
        return;
      }
      notifyArrival(houseId, university, effectiveStudentId, arrivalBtn);
    };
  }

  __detail_debug.trace("attachActions:end");
  dbgPause();
}

// ----------------------
// notifyArrival (uses authorizedPost if available)
// ----------------------
async function notifyArrival(id, universityParam, studentIdToSend, btn) {
  __detail_debug.trace("notifyArrival:start", { id, universityParam, studentIdToSend });
  dbgPause();

  if (!id || !studentIdToSend) {
    alert("Missing information to notify arrival.");
    return;
  }

  btn.disabled = true;
  try {
    const url = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(id)}/notify_arrival?university=${encodeURIComponent(universityParam || "")}`;
    __detail_debug.trace("notifyArrival:url", { url });

    // Try authorizedPost if available
    if (typeof window.authorizedPost === "function") {
      try {
        __detail_debug.trace("notifyArrival:using-authorizedPost");
        const resp = await window.authorizedPost(url, { student_id: studentIdToSend });
        if (resp && typeof resp.status === "number") {
          __detail_debug.trace("notifyArrival:authorizedPost-response", { status: resp.status });
          if (resp.ok || (resp.status >= 200 && resp.status < 300)) {
            alert("✅ Landlord notified of your arrival");
            return;
          }
        } else {
          // parsed JSON returned
          __detail_debug.trace("notifyArrival:authorizedPost-returned-json", { resp });
          alert("✅ Landlord notified (response received)");
          return;
        }
      } catch (err) {
        __detail_debug.trace("notifyArrival:authorizedPost-failed", { error: String(err) });
      }
    }

    // Fallback fetch
    const token = localStorage.getItem("access_token") || "";
    const headers = { "Content-Type": "application/json" };
    if (token) headers["Authorization"] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ student_id: studentIdToSend }),
      credentials: "same-origin"
    });

    __detail_debug.trace("notifyArrival:fetch-response", { status: res.status });
    const text = await res.text().catch(() => "");
    __detail_debug.trace("notifyArrival:fetch-body", { preview: String(text).slice(0, 300) });

    if (res.ok) {
      alert("✅ Landlord notified of your arrival");
    } else {
      alert(`Failed to notify: ${res.status} ${text}`);
    }
  } catch (err) {
    __detail_debug.trace("notifyArrival:error", { error: String(err) });
    console.error("notifyArrival error:", err);
    alert("Error sending notification");
  } finally {
    btn.disabled = false;
    dbgPause();
    __detail_debug.trace("notifyArrival:end");
  }
}

// ----------------------
// Init
// ----------------------
document.addEventListener("DOMContentLoaded", () => {
  __detail_debug.trace("DOMContentLoaded");
  dbgPause();
  try {
    // Quick sanity checks
    inspectLoadedScript();
    __detail_debug.trace("sanity", { imageSliderExists: !!imageSlider, phoneBtnExists: !!phoneBtn });

    // If no effectiveStudentId, show sign-in hint but still attempt to load limited data
    if (!effectiveStudentId) {
      showSignInHint(true, "You are viewing as a guest. Sign in to contact landlords and see full details.");
    } else {
      showSignInHint(false);
    }

    // Kick off load
    loadBoardingHouse();
  } catch (e) {
    console.error("Initialization error:", e);
    __detail_debug.trace("init:error", { error: String(e) });
  }
});

// End marker
__detail_debug.trace("detail_controller:loaded");
console.debug("detail_controller.js loaded");
