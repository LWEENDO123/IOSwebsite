// detail.js
import { authorizedGet } from "./tokenManager.js";

console.log("🚀 DETAIL CONTROLLER STARTED");

/* ===============================
   CONFIG
================================ */
const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";
const currentUserUniversity = localStorage.getItem("user_university") || "";

/* ===============================
   STATE
================================ */
let currentSlide = 0;
let slides = [];

/* ===============================
   HELPERS
================================ */

function isMobile() {
  return /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

function safeLog(...args) { try { console.log(...args); } catch (e) {} }

function normalizeMediaUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) {
    if (s.includes("/media/")) {
      const parts = s.split("/media/");
      return `/media/${parts[1]}`;
    }
    return s;
  }
  if (s.startsWith("/media/")) return s;
  if (s.includes("/media/")) {
    const parts = s.split("/media/");
    return `/media/${parts[1]}`;
  }
  return s.startsWith("/") ? s : `/${s}`;
}

/* ===============================
   SPINNER / BUTTON LOADING HELPERS
================================ */

function createSpinnerEl() {
  const spinner = document.createElement("span");
  spinner.className = "btn-spinner";
  spinner.style.position = "absolute";
  spinner.style.top = "50%";
  spinner.style.left = "50%";
  spinner.style.transform = "translate(-50%, -50%)";
  spinner.style.width = "18px";
  spinner.style.height = "18px";
  spinner.style.border = "2px solid rgba(255,255,255,0.9)";
  spinner.style.borderTop = "2px solid rgba(0,0,0,0.2)";
  spinner.style.borderRadius = "50%";
  spinner.style.animation = "btn-spin 0.9s linear infinite";
  spinner.style.pointerEvents = "none";
  return spinner;
}

function setButtonLoading(btn, isLoading) {
  if (!btn) return;
  btn.style.position = btn.style.position || "relative";
  const existing = btn.querySelector(".btn-spinner");
  if (isLoading) {
    btn.disabled = true;
    btn.classList.add("loading");
    if (!existing) btn.appendChild(createSpinnerEl());
    const img = btn.querySelector("img");
    if (img) img.style.opacity = "0.45";
  } else {
    btn.disabled = false;
    btn.classList.remove("loading");
    if (existing) existing.remove();
    const img = btn.querySelector("img");
    if (img) img.style.opacity = "1";
  }
}

/* inject spinner keyframes once */
(function ensureSpinnerKeyframes() {
  if (document.getElementById("detail-js-spinner-style")) return;
  const style = document.createElement("style");
  style.id = "detail-js-spinner-style";
  style.textContent = `
    @keyframes btn-spin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
    .action-icon.loading { opacity: 0.9; }
    .shimmer { background: linear-gradient(90deg, #f0f0f0 0%, #e8e8e8 50%, #f0f0f0 100%); background-size: 200% 100%; animation: shimmer 1.2s linear infinite; }
    @keyframes shimmer { from { background-position: 200% 0 } to { background-position: -200% 0 } }
    .room-card.status-available { border-color: #1e9b3a !important; box-shadow: 0 6px 18px rgba(30,155,58,0.12) !important; }
    .room-card.status-unavailable { border-color: #d32f2f !important; box-shadow: 0 6px 18px rgba(211,47,47,0.12) !important; opacity: 0.95; }
    .badge-small.available { background: #1e9b3a; }
    .badge-small.unavailable { background: #d32f2f; }
    .badge-small.not-supported { background: #666; }
  `;
  document.head.appendChild(style);
})();

/* ===============================
   PARAM VALIDATION
================================ */

function validateParams(houseId, university, studentId) {
  console.group("🔎 PARAM VALIDATION");
  if (!houseId) { console.error("❌ Missing houseId"); console.groupEnd(); return false; }
  if (!studentId) { console.error("❌ Missing studentId"); console.groupEnd(); return false; }
  if (!university && !currentUserUniversity) { console.error("❌ Missing university"); console.groupEnd(); return false; }
  console.log("✅ Params valid");
  console.groupEnd();
  return true;
}

/* ===============================
   NETWORK DEBUGGER
================================ */

async function debugRequest(url) {
  console.group("🌍 NETWORK REQUEST");
  const start = performance.now();
  console.log("➡️ Request URL:", url);

  try {
    const res = await authorizedGet(url);
    const end = performance.now();

    console.log("⏱ Request Time:", (end - start).toFixed(2) + " ms");
    console.log("📡 Status:", res.status);
    console.log("📡 Status Text:", res.statusText);

    console.group("📥 Response Headers");
    for (const [key, value] of res.headers.entries()) {
      console.log(`${key}: ${value}`);
    }
    console.groupEnd();

    const raw = await res.text();
    console.log("📦 Response Length:", raw ? raw.length : 0);

    if (!raw || raw.trim() === "") {
      console.error("❌ EMPTY RESPONSE BODY");
      console.groupEnd();
      return null;
    }

    console.log("📦 Raw Response:", raw);

    let data = null;
    try {
      data = JSON.parse(raw);
      console.log("✅ JSON Parsed Successfully");
      console.log("📄 JSON Object:", data);
    } catch (parseError) {
      console.error("❌ JSON Parsing Failed", parseError);
    }

    console.groupEnd();
    return data;
  } catch (err) {
    console.error("❌ Network Request Failed", err);
    console.groupEnd();
    throw err;
  }
}

/* ===============================
   GEOLOCATION
================================ */

function getCurrentLocation() {
  console.group("📍 LOCATION REQUEST");
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      console.error("❌ Geolocation not supported");
      console.groupEnd();
      return reject("Geolocation not supported");
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lon: pos.coords.longitude };
        console.log("📍 Location received:", location);
        console.groupEnd();
        resolve(location);
      },
      (err) => {
        console.error("❌ Location error:", err.message || err);
        console.groupEnd();
        reject(err.message || err);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

/* ===============================
   GALLERY HELPERS
================================ */

function renderDots() {
  const dotsContainer = document.querySelector(".dots");
  if (!dotsContainer) return;
  dotsContainer.innerHTML = "";
  slides.forEach((_, i) => {
    const dot = document.createElement("span");
    dot.className = "dot" + (i === currentSlide ? " active" : "");
    dot.addEventListener("click", () => showSlide(i));
    dotsContainer.appendChild(dot);
  });
}

function showSlide(index) {
  const slider = document.querySelector(".gallery-slider");
  if (!slider) return;
  if (slides.length === 0) return;
  if (index < 0) index = slides.length - 1;
  if (index >= slides.length) index = 0;
  slider.style.transform = `translateX(-${index * 100}%)`;
  const indicator = document.querySelector(".page-indicator");
  if (indicator) indicator.textContent = `${index + 1}/${slides.length}`;
  currentSlide = index;
  renderDots();
}

function createSlide(item) {
  const slide = document.createElement("div");
  slide.className = "slide shimmer";
  const mediaUrl = normalizeMediaUrl(item.url) || item.url || "";

  if ((item.type || "").toLowerCase() === "video" || /\.(mp4|m3u8|webm)$/i.test(mediaUrl)) {
    const video = document.createElement("video");
    video.controls = true;
    video.src = mediaUrl;
    video.preload = "metadata";
    video.onloadeddata = () => slide.classList.remove("shimmer");
    video.onerror = () => slide.classList.remove("shimmer");
    slide.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.src = mediaUrl;
    img.alt = item.caption || "Gallery";
    img.onload = () => slide.classList.remove("shimmer");
    img.onerror = () => slide.classList.remove("shimmer");
    slide.appendChild(img);
  }
  return slide;
}

/* ===============================
   ROOM STATUS HELPERS
================================ */

function normalizeStatus(raw) {
  if (raw === null || raw === undefined) return null;
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return null;
  if (["available", "vacant", "open"].includes(s)) return "available";
  if (["unavailable", "full", "occupied"].includes(s)) return "unavailable";
  if (["not supported", "not_supported", "n/a", "na"].includes(s)) return "not-supported";
  return s;
}

function applyRoomCardVisual(cardEl, statusToken) {
  cardEl.classList.remove("status-available", "status-unavailable", "status-not-supported");
  if (statusToken === "available") cardEl.classList.add("status-available");
  else if (statusToken === "unavailable") cardEl.classList.add("status-unavailable");
  else cardEl.classList.add("status-not-supported");
}

/* ===============================
   ACTIONS
================================ */

async function callLandlordPhone(id, uniToSend, studentId, btn) {
  console.group("📞 PHONE BUTTON CLICKED");
  setButtonLoading(btn, true);
  try {
    const phoneUrl = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(id)}/landlord-phone?university=${encodeURIComponent(uniToSend)}&student_id=${encodeURIComponent(studentId)}`;
    const phoneData = await debugRequest(phoneUrl);
    if (!phoneData) { alert("Phone information unavailable"); return; }

    const phone = phoneData.phone_number ?? phoneData.phone ?? phoneData.phoneNumber ?? null;
    const message = phoneData.message ?? null;

    if (phone) {
      if (isMobile()) {
        // Mobile: use location.href to ensure dialer opens
        window.location.href = `tel:${phone}`;
      } else {
        // Desktop: open in new tab/window
        try { window.open(`tel:${phone}`); } catch (e) { window.location.href = `tel:${phone}`; }
      }
    } else if (message) {
      alert(message);
    } else {
      alert("Phone number unavailable");
    }
  } catch (err) {
    console.error("Phone action error:", err);
    alert("Failed to fetch phone number");
  } finally {
    setButtonLoading(btn, false);
    console.groupEnd();
  }
}

async function openGoogleMaps(id, uniToSend, studentId, btn, fallbackLocation) {
  console.group("🗺 GOOGLE MAPS BUTTON");
  setButtonLoading(btn, true);
  try {
    // get current location for origin
    let current = null;
    try { current = await getCurrentLocation(); } catch (err) { console.warn("No current location:", err); current = null; }

    const googleUrl = `${BASE_URL}/home/google/${encodeURIComponent(id)}?university=${encodeURIComponent(uniToSend)}&student_id=${encodeURIComponent(studentId)}${current ? `&current_lat=${encodeURIComponent(current.lat)}&current_lon=${encodeURIComponent(current.lon)}` : ''}`;
    const gdata = await debugRequest(googleUrl);
    if (!gdata) { alert("Google Maps link unavailable"); return; }

    const link = gdata.link ?? gdata.url ?? gdata.maps_link ?? null;
    if (link) {
      if (isMobile()) {
        // mobile: set location.href to ensure navigation is treated as user gesture
        window.location.href = link;
      } else {
        try { window.open(link, "_blank"); } catch (err) { window.location.href = link; }
      }
      return;
    }

    // fallback: construct directions using current and destination coords
    function extractCoords(obj) {
      if (!obj) return null;
      if (Array.isArray(obj) && obj.length >= 2) return { lat: Number(obj[0]), lon: Number(obj[1]) };
      if (typeof obj === "object") {
        if (obj.lat != null && obj.lon != null) return { lat: Number(obj.lat), lon: Number(obj.lon) };
        if (obj.latitude != null && obj.longitude != null) return { lat: Number(obj.latitude), lon: Number(obj.longitude) };
      }
      return null;
    }

    const dest = extractCoords(gdata.GPS_coordinates ?? gdata.gps ?? fallbackLocation ?? null);

    if (current && dest) {
      const origin = `${Number(current.lat)},${Number(current.lon)}`;
      const destination = `${Number(dest.lat)},${Number(dest.lon)}`;
      const constructed = `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}&travelmode=driving`;
      if (isMobile()) window.location.href = constructed; else window.open(constructed, "_blank");
      return;
    }

    if (dest) {
      const constructed = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${dest.lat},${dest.lon}`)}`;
      if (isMobile()) window.location.href = constructed; else window.open(constructed, "_blank");
      return;
    }

    alert("Google Maps directions unavailable");
  } catch (err) {
    console.error("Google action error:", err);
    alert("Failed to open Google Maps");
  } finally {
    setButtonLoading(btn, false);
    console.groupEnd();
  }
}

async function openYango(id, uniToSend, studentId, btn, fallbackLocation) {
  console.group("🚗 YANGO BUTTON");
  setButtonLoading(btn, true);
  try {
    // 1) current location for gfrom
    let current = null;
    try { current = await getCurrentLocation(); } catch (err) { console.warn("No current location:", err); current = null; }

    // 2) request backend
    const yangoUrl = `${BASE_URL}/home/yango/${encodeURIComponent(id)}?university=${encodeURIComponent(uniToSend)}&student_id=${encodeURIComponent(studentId)}${current ? `&current_lat=${encodeURIComponent(current.lat)}&current_lon=${encodeURIComponent(current.lon)}` : ''}`;
    const ydata = await debugRequest(yangoUrl);
    if (!ydata) { alert("Yango link unavailable"); return; }

    function extractCoords(obj) {
      if (!obj) return null;
      if (Array.isArray(obj) && obj.length >= 2) return { lat: Number(obj[0]), lon: Number(obj[1]) };
      if (typeof obj === "object") {
        if (obj.lat != null && obj.lon != null) return { lat: Number(obj.lat), lon: Number(obj.lon) };
        if (obj.latitude != null && obj.longitude != null) return { lat: Number(obj.latitude), lon: Number(obj.longitude) };
      }
      return null;
    }

    const destFromYangoCoords = extractCoords(ydata.yango_coordinates ?? ydata.yango_coords ?? null);
    const destFromGPS = extractCoords(ydata.GPS_coordinates ?? ydata.gps ?? null);
    const destFromPayload = extractCoords(fallbackLocation ?? null);
    const dest = destFromYangoCoords || destFromGPS || destFromPayload || null;

    const browserLink = ydata.browser_link ?? ydata.browserLink ?? ydata.browser ?? ydata.url ?? null;
    const deep = ydata.deep_link ?? ydata.deepLink ?? ydata.deep ?? null;
    const tariff = encodeURIComponent(ydata.tariff ?? "econom");
    const lang = encodeURIComponent(ydata.lang ?? "en_int");

    // If backend provided a browser link that already contains both gfrom & gto, prefer it
    if (browserLink && current && dest) {
      const hasFrom = browserLink.includes("gfrom=");
      const hasTo = browserLink.includes("gto=");
      if (hasFrom && hasTo) {
        if (isMobile()) window.location.href = browserLink; else window.open(browserLink, "_blank");
        return;
      }
    }

    // Constructed link using current and dest
    if (current && dest) {
      const gfrom = `${Number(current.lat)},${Number(current.lon)}`;
      const gto = `${Number(dest.lat)},${Number(dest.lon)}`;
      const constructed = `https://yango.com/${lang}/order/?gfrom=${encodeURIComponent(gfrom)}&gto=${encodeURIComponent(gto)}&tariff=${tariff}&lang=${lang}`;
      if (isMobile()) window.location.href = constructed; else window.open(constructed, "_blank");
      return;
    }

    // If only destination available
    if (!current && dest) {
      const gto = `${Number(dest.lat)},${Number(dest.lon)}`;
      const constructed = `https://yango.com/${lang}/order/?gto=${encodeURIComponent(gto)}&tariff=${tariff}&lang=${lang}`;
      if (isMobile()) window.location.href = constructed; else window.open(constructed, "_blank");
      return;
    }

    // Fallback to deep link (mobile may handle)
    if (deep) {
      if (isMobile()) window.location.href = deep; else {
        try { window.open(deep, "_blank"); } catch (err) { alert(`Yango link: ${deep}`); }
      }
      return;
    }

    // Last resort: open browserLink or show message
    if (browserLink) {
      if (isMobile()) window.location.href = browserLink; else window.open(browserLink, "_blank");
      return;
    }

    alert("Yango ride unavailable");
  } catch (err) {
    console.error("Yango action error:", err);
    alert("Failed to launch Yango");
  } finally {
    setButtonLoading(btn, false);
    console.groupEnd();
  }
}

async function openBus(id, uniToSend, studentId, btn) {
  console.group("🚌 BUS BUTTON CLICKED");
  setButtonLoading(btn, true);
  try {
    const summaryUrl = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(id)}?student_id=${encodeURIComponent(studentId)}&university=${encodeURIComponent(uniToSend)}`;
    const sdata = await debugRequest(summaryUrl);
    if (!sdata) { alert("Location not available"); return; }

    const lat = (Array.isArray(sdata.GPS_coordinates) && sdata.GPS_coordinates.length >= 2) ? sdata.GPS_coordinates[0] : (sdata.GPS_coordinates?.lat ?? null);
    const lon = (Array.isArray(sdata.GPS_coordinates) && sdata.GPS_coordinates.length >= 2) ? sdata.GPS_coordinates[1] : (sdata.GPS_coordinates?.lon ?? null);

    if (lat && lon) {
      const mapsQuery = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;
      if (isMobile()) window.location.href = mapsQuery; else window.open(mapsQuery, "_blank");
    } else if (sdata.location) {
      const mapsQuery = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sdata.location)}`;
      if (isMobile()) window.location.href = mapsQuery; else window.open(mapsQuery, "_blank");
    } else {
      alert("Bus stop or location not available");
    }
  } catch (err) {
    console.error("Bus action error:", err);
    alert("Failed to open bus location");
  } finally {
    setButtonLoading(btn, false);
    console.groupEnd();
  }
}

/* ===============================
   LOAD BOARDING HOUSE
================================ */

async function loadBoardingHouse(id, university, studentId) {
  console.group("🚀 LOAD BOARDING HOUSE");
  safeLog("params:", { id, university, studentId });

  if (!validateParams(id, university, studentId)) {
    alert("Missing required parameters");
    console.groupEnd();
    return;
  }

  const uniToSend = (university && university !== "default") ? university : (currentUserUniversity || "");
  if (!uniToSend) {
    alert("Missing university parameter");
    console.groupEnd();
    return;
  }

  const url = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(id)}?student_id=${encodeURIComponent(studentId)}&university=${encodeURIComponent(uniToSend)}`;

  try {
    const resData = await debugRequest(url);
    if (!resData) {
      alert("No data returned from server for this boarding house");
      console.groupEnd();
      return;
    }

    // Normalize backend shapes
    const data = {
      name_boardinghouse: resData.name_boardinghouse ?? resData.name ?? "",
      location: resData.location ?? resData.address ?? "",
      phone_number: resData.phone_number ?? resData.phone ?? resData.phoneNumber ?? null,
      GPS_coordinates: Array.isArray(resData.GPS_coordinates) ? { lat: resData.GPS_coordinates[0], lon: resData.GPS_coordinates[1] } : (resData.GPS_coordinates ?? null),
      yango_coordinates: Array.isArray(resData.yango_coordinates) ? { lat: resData.yango_coordinates[0], lon: resData.yango_coordinates[1] } : (resData.yango_coordinates ?? null),
      gallery: Array.isArray(resData.gallery) ? resData.gallery : (Array.isArray(resData.images) ? resData.images.map(u => ({ type: "image", url: u })) : []),
      space_description: resData.space_description ?? resData.spaceDescription ?? "",
      conditions: resData.conditions ?? "",
      amenities: Array.isArray(resData.amenities) ? resData.amenities : (Array.isArray(resData.amenities_list) ? resData.amenities_list : []),
      price_1: resData.price_1 ?? resData.price1 ?? null,
      price_2: resData.price_2 ?? resData.price2 ?? null,
      price_3: resData.price_3 ?? resData.price3 ?? null,
      price_4: resData.price_4 ?? resData.price4 ?? null,
      price_5: resData.price_5 ?? resData.price5 ?? null,
      price_6: resData.price_6 ?? resData.price6 ?? null,
      price_12: resData.price_12 ?? resData.price12 ?? null,
      image_1: resData.image_1 ?? resData.image1 ?? null,
      image_2: resData.image_2 ?? resData.image2 ?? null,
      image_3: resData.image_3 ?? resData.image3 ?? null,
      image_4: resData.image_4 ?? resData.image4 ?? null,
      image_5: resData.image_5 ?? resData.image5 ?? null,
      image_6: resData.image_6 ?? resData.image6 ?? null,
      image_12: resData.image_12 ?? resData.image12 ?? null,
      singleroom: resData.singleroom ?? resData.single_room ?? null,
      sharedroom_2: resData.sharedroom_2 ?? resData.sharedroom2 ?? null,
      sharedroom_3: resData.sharedroom_3 ?? resData.sharedroom3 ?? null,
      sharedroom_4: resData.sharedroom_4 ?? resData.sharedroom4 ?? null,
      sharedroom_5: resData.sharedroom_5 ?? resData.sharedroom5 ?? null,
      sharedroom_6: resData.sharedroom_6 ?? resData.sharedroom6 ?? null,
      sharedroom_12: resData.sharedroom_12 ?? resData.sharedroom12 ?? null,
      amenities_raw: resData.amenities ?? resData.amenities_list ?? [],
    };

    // Populate UI elements
    const houseNameEl = document.querySelector(".house-name");
    if (houseNameEl) houseNameEl.textContent = (data.name_boardinghouse || "").toUpperCase();

    const locationEl = document.querySelector(".location");
    if (locationEl) locationEl.textContent = "📍 " + (data.location || "");

    // Buttons
    const phoneBtn = document.getElementById("phoneBtn") || document.querySelector(".action-icon.phone");
    const googleBtn = document.getElementById("googleBtn") || document.querySelector(".action-icon.google");
    const yangoBtn = document.getElementById("yangoBtn") || document.querySelector(".action-icon.yango");
    const busBtn = document.getElementById("busBtn") || document.querySelector(".action-icon.bus");

    // Attach handlers (idempotent)
    if (phoneBtn) {
      phoneBtn.onclick = (e) => { e.preventDefault(); callLandlordPhone(id, uniToSend, studentId, phoneBtn); };
    }
    if (googleBtn) {
      googleBtn.onclick = (e) => { e.preventDefault(); openGoogleMaps(id, uniToSend, studentId, googleBtn, data.GPS_coordinates || { text: data.location }); };
    }
    if (yangoBtn) {
      yangoBtn.onclick = (e) => { e.preventDefault(); openYango(id, uniToSend, studentId, yangoBtn, data.yango_coordinates || data.GPS_coordinates); };
    }
    if (busBtn) {
      busBtn.onclick = (e) => { e.preventDefault(); openBus(id, uniToSend, studentId, busBtn); };
    }

    // Gallery
    const gallerySlider = document.querySelector(".gallery-slider");
    if (gallerySlider) {
      gallerySlider.innerHTML = "";
      slides = [];
      const galleryItems = Array.isArray(resData.gallery) ? resData.gallery : (Array.isArray(resData.images) ? resData.images.map(u => ({ type: "image", url: u })) : []);
      galleryItems.forEach(item => {
        const normalizedItem = (typeof item === "string") ? { type: "image", url: item } : item;
        const slide = createSlide(normalizedItem);
        gallerySlider.appendChild(slide);
        slides.push(slide);
      });
      if (slides.length > 0) showSlide(0);
      renderDots();

      const prevBtn = document.querySelector(".gallery-nav .prev");
      const nextBtn = document.querySelector(".gallery-nav .next");
      if (prevBtn) prevBtn.onclick = () => showSlide(currentSlide - 1);
      if (nextBtn) nextBtn.onclick = () => showSlide(currentSlide + 1);
    }

    // Auto cycle
    if (window._detailAutoCycleInterval) clearInterval(window._detailAutoCycleInterval);
    window._detailAutoCycleInterval = setInterval(() => {
      if (slides.length === 0) return;
      showSlide(currentSlide + 1);
    }, 30000);

    // Descriptions, conditions, amenities
    const descEl = document.querySelector(".space-description");
    if (descEl) descEl.textContent = data.space_description || "";

    const condEl = document.querySelector(".conditions");
    if (condEl) condEl.textContent = data.conditions || "";

    const amenitiesList = document.querySelector(".amenities-list");
    if (amenitiesList) {
      amenitiesList.innerHTML = "";
      (data.amenities || data.amenities_raw || []).forEach(a => {
        const li = document.createElement("li");
        li.textContent = a;
        amenitiesList.appendChild(li);
      });
    }

    // Legend descriptor (mirrors Dart)
    const legendContainer = document.querySelector(".legend");
    if (legendContainer) {
      let descBlock = document.querySelector(".legend-descriptions");
      if (!descBlock) {
        descBlock = document.createElement("div");
        descBlock.className = "legend-descriptions";
        descBlock.style.marginTop = "8px";
        descBlock.style.fontSize = "13px";
        descBlock.style.color = "#444";
        legendContainer.parentNode.insertBefore(descBlock, legendContainer.nextSibling);
      }
      descBlock.innerHTML = `
        <div><strong>Available</strong> — This room type currently has one or more spaces open. You can request or reserve a space for this room type.</div>
        <div style="margin-top:6px"><strong>Unavailable</strong> — This room type currently has no spaces available.</div>
        <div style="margin-top:6px"><strong>Not Supported</strong> — This room type is not supported or not listed for this boarding house.</div>
      `;
    }

    // Rooms grid
    const grid = document.querySelector(".rooms .grid");
    if (grid) {
      grid.innerHTML = "";
      const roomDefs = [
        {type:"12 Shared Room", price:data.price_12, status:data.sharedroom_12, image:data.image_12},
        {type:"6 Shared Room", price:data.price_6, status:data.sharedroom_6, image:data.image_6},
        {type:"5 Shared Room", price:data.price_5, status:data.sharedroom_5, image:data.image_5},
        {type:"4 Shared Room", price:data.price_4, status:data.sharedroom_4, image:data.image_4},
        {type:"3 Shared Room", price:data.price_3, status:data.sharedroom_3, image:data.image_3},
        {type:"2 Shared Room", price:data.price_2, status:data.sharedroom_2, image:data.image_2},
        {type:"Single Room", price:data.price_1, status:data.singleroom, image:data.image_1},
      ];

      roomDefs.forEach(r => {
        const card = document.createElement("div");
        card.className = "room-card shimmer";

        const imgUrl = normalizeMediaUrl(r.image) || '/static/assets/icons/placeholder.jpg';
        const thumb = document.createElement("div");
        thumb.className = "thumb";
        const img = document.createElement("img");
        img.src = imgUrl;
        img.alt = r.type;
        img.onload = () => card.classList.remove("shimmer");
        img.onerror = () => card.classList.remove("shimmer");
        thumb.appendChild(img);

        const info = document.createElement("div");
        info.className = "room-info";
        const header = document.createElement("div");
        header.className = "room-header";
        const typeP = document.createElement("p");
        typeP.className = "room-type";
        typeP.textContent = r.type;

        const rawStatus = r.status ?? "";
        const statusToken = normalizeStatus(rawStatus);
        const badge = document.createElement("span");
        badge.className = `badge-small ${statusToken === "available" ? "available" : statusToken === "unavailable" ? "unavailable" : "not-supported"}`;
        badge.textContent = (rawStatus && String(rawStatus).trim() !== "") ? String(rawStatus).toUpperCase() : 'NOT SUPPORTED';

        header.appendChild(typeP);
        header.appendChild(badge);

        const priceP = document.createElement("p");
        priceP.className = "room-price";
        priceP.textContent = `Price: ${r.price || 'N/A'}`;

        info.appendChild(header);
        info.appendChild(priceP);

        card.appendChild(thumb);
        card.appendChild(info);
        grid.appendChild(card);

        // apply card visual highlight based on status
        if (statusToken === "available") applyRoomCardVisual(card, "available");
        else if (statusToken === "unavailable") applyRoomCardVisual(card, "unavailable");
        else applyRoomCardVisual(card, "not-supported");
      });
    }

  } catch (err) {
    console.error("Error loading boarding house details:", err);
    alert("Error loading boarding house details");
  } finally {
    console.groupEnd();
  }
}

/* ===============================
   BOOTSTRAP
================================ */

(function init() {
  const params = new URLSearchParams(window.location.search);
  const houseId = params.get("id");
  const university = params.get("university");
  const studentId = params.get("student_id");

  console.group("📌 PAGE PARAMETERS");
  console.log("houseId:", houseId);
  console.log("university:", university);
  console.log("studentId:", studentId);
  console.groupEnd();

  if (houseId && studentId) {
    loadBoardingHouse(houseId, university, studentId);
  } else {
    alert("Missing boarding house parameters in URL");
  }
})();
