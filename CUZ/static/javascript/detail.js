import { authorizedGet } from "./tokenManager.js";

console.log("🚀 DETAIL CONTROLLER STARTED");

let currentSlide = 0;
let slides = [];
const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";
const currentUserUniversity = localStorage.getItem("user_university") || "";

/* ===============================
   UTILITIES
================================ */

function safeLog(...args) { try { console.log(...args); } catch (e) {} }

function normalizeMediaUrl(url) {
  if (!url) return null;
  const s = String(url).trim();
  if (!s) return null;
  if (s.startsWith("http://") || s.startsWith("https://")) {
    // If backend returns full URL that already contains /media/, convert to root /media/ path
    if (s.includes("/media/")) {
      const parts = s.split("/media/");
      return `/media/${parts[1]}`;
    }
    return s;
  }
  if (s.startsWith("/media/")) return s;
  // Some backends return hostless paths like "bucket/key" or "media/key"
  if (s.includes("/media/")) {
    const parts = s.split("/media/");
    return `/media/${parts[1]}`;
  }
  return s.startsWith("/") ? s : `/${s}`;
}

/* ===============================
   BUTTON LOADING UI HELPERS
   - Adds a small spinner overlay inside the button while request runs
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
    // dim icon
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

/* small keyframe injection for spinner (if not present) */
(function ensureSpinnerKeyframes() {
  if (document.getElementById("detail-js-spinner-style")) return;
  const style = document.createElement("style");
  style.id = "detail-js-spinner-style";
  style.textContent = `
    @keyframes btn-spin { from { transform: translate(-50%, -50%) rotate(0deg); } to { transform: translate(-50%, -50%) rotate(360deg); } }
    .action-icon.loading { opacity: 0.9; }
  `;
  document.head.appendChild(style);
})();

/* ===============================
   NETWORK DEBUGGER
   - returns parsed JSON object or null
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
      // keep data as null so callers can handle gracefully
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
   GALLERY
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
   LOAD BOARDING HOUSE
================================ */

async function loadBoardingHouse(id, university, studentId) {
  try {
    if (!id || !studentId) {
      alert("Missing boarding house id or student id");
      return;
    }

    let uniToSend = university && university !== "default"
      ? university
      : (currentUserUniversity || "");

    if (!uniToSend) {
      alert("Missing university parameter");
      return;
    }

    const url = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(id)}?student_id=${encodeURIComponent(studentId)}&university=${encodeURIComponent(uniToSend)}`;

    // show global page loading indicator (optional)
    safeLog("Fetching boarding house:", url);

    const resData = await debugRequest(url);
    if (!resData) {
      alert("No data returned from server for this boarding house");
      return;
    }

    // Accept multiple naming conventions from backend
    const data = {
      // name: backend may return name_boardinghouse or name
      name_boardinghouse: resData.name_boardinghouse ?? resData.name ?? "",
      location: resData.location ?? resData.address ?? "",
      phone_number: resData.phone_number ?? resData.phone ?? resData.phoneNumber ?? null,
      GPS_coordinates: (resData.GPS_coordinates && Array.isArray(resData.GPS_coordinates))
        ? { lat: resData.GPS_coordinates[0], lon: resData.GPS_coordinates[1] }
        : (resData.GPS_coordinates ?? resData.gps ?? null),
      yango_coordinates: (resData.yango_coordinates && Array.isArray(resData.yango_coordinates))
        ? { lat: resData.yango_coordinates[0], lon: resData.yango_coordinates[1] }
        : (resData.yango_coordinates ?? null),
      gallery: Array.isArray(resData.gallery) ? resData.gallery : (Array.isArray(resData.images) ? resData.images.map(u => ({ type: "image", url: u })) : []),
      space_description: resData.space_description ?? resData.spaceDescription ?? "",
      conditions: resData.conditions ?? "",
      amenities: Array.isArray(resData.amenities) ? resData.amenities : [],
      price_1: resData.price_1 ?? resData.price1 ?? resData.price_1,
      price_2: resData.price_2 ?? resData.price2 ?? resData.price_2,
      price_3: resData.price_3 ?? resData.price3 ?? resData.price_3,
      price_4: resData.price_4 ?? resData.price4 ?? resData.price_4,
      price_5: resData.price_5 ?? resData.price5 ?? resData.price_5,
      price_6: resData.price_6 ?? resData.price6 ?? resData.price_6,
      price_12: resData.price_12 ?? resData.price12 ?? resData.price_12,
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

    // Populate UI
    const houseNameEl = document.querySelector(".house-name");
    if (houseNameEl) houseNameEl.textContent = (data.name_boardinghouse || "").toUpperCase();

    const locationEl = document.querySelector(".location");
    if (locationEl) locationEl.textContent = "📍 " + (data.location || "");

    // Buttons (use buttons with ids if present)
    const phoneBtn = document.getElementById("phoneBtn") || document.querySelector(".action-icon.phone");
    const googleBtn = document.getElementById("googleBtn") || document.querySelector(".action-icon.google");
    const yangoBtn = document.getElementById("yangoBtn") || document.querySelector(".action-icon.yango");
    const busBtn = document.getElementById("busBtn") || document.querySelector(".action-icon.bus");

    // Attach click handlers that show loading state while performing network calls
    if (phoneBtn) {
      phoneBtn.onclick = async (e) => {
        e.preventDefault();
        setButtonLoading(phoneBtn, true);
        try {
          // call landlord-phone endpoint to get the canonical response (ensures same logic as backend)
          const phoneUrl = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(id)}/landlord-phone?university=${encodeURIComponent(uniToSend)}&student_id=${encodeURIComponent(studentId)}`;
          const phoneData = await debugRequest(phoneUrl);
          const phone = phoneData?.phone_number ?? phoneData?.phone ?? data.phone_number;
          const message = phoneData?.message ?? null;
          if (phone) {
            // try to open tel: on mobile; fallback to alert
            try {
              window.location.href = `tel:${phone}`;
              try { window.open(`tel:${phone}`); } catch (e) {}
            } catch (err) {
              alert(`Landlord phone: ${phone}`);
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
          setButtonLoading(phoneBtn, false);
        }
      };
    }

    if (googleBtn) {
      googleBtn.onclick = async (e) => {
        e.preventDefault();
        setButtonLoading(googleBtn, true);
        try {
          // prefer backend google endpoint to compute link
          const loc = await (async () => {
            // if GPS coordinates already present in payload, use them; else request browser location
            if (data.GPS_coordinates && data.GPS_coordinates.lat && data.GPS_coordinates.lon) {
              return { lat: data.GPS_coordinates.lat, lon: data.GPS_coordinates.lon };
            }
            // request browser location
            return await new Promise((resolve, reject) => {
              if (!navigator.geolocation) return reject("Geolocation not supported");
              navigator.geolocation.getCurrentPosition(pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }), err => reject(err.message || err), { enableHighAccuracy: true, timeout: 10000 });
            });
          })();

          const googleUrl = `${BASE_URL}/home/google/${encodeURIComponent(id)}?university=${encodeURIComponent(uniToSend)}&student_id=${encodeURIComponent(studentId)}&current_lat=${encodeURIComponent(loc.lat)}&current_lon=${encodeURIComponent(loc.lon)}`;
          const gdata = await debugRequest(googleUrl);
          const link = gdata?.link ?? gdata?.url ?? gdata?.maps_link ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(data.location || "")}`;
          if (link) {
            try { window.open(link, "_blank"); } catch (err) { window.location.href = link; }
          } else {
            alert("Google Maps link unavailable");
          }
        } catch (err) {
          console.error("Google action error:", err);
          alert("Failed to open Google Maps");
        } finally {
          setButtonLoading(googleBtn, false);
        }
      };
    }

    if (yangoBtn) {
      yangoBtn.onclick = async (e) => {
        e.preventDefault();
        setButtonLoading(yangoBtn, true);
        try {
          const loc = await (async () => {
            if (data.yango_coordinates && data.yango_coordinates.lat && data.yango_coordinates.lon) {
              return { lat: data.yango_coordinates.lat, lon: data.yango_coordinates.lon };
            }
            if (data.GPS_coordinates && data.GPS_coordinates.lat && data.GPS_coordinates.lon) {
              return { lat: data.GPS_coordinates.lat, lon: data.GPS_coordinates.lon };
            }
            return await new Promise((resolve, reject) => {
              if (!navigator.geolocation) return reject("Geolocation not supported");
              navigator.geolocation.getCurrentPosition(pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude }), err => reject(err.message || err), { enableHighAccuracy: true, timeout: 10000 });
            });
          })();

          const yangoUrl = `${BASE_URL}/home/yango/${encodeURIComponent(id)}?university=${encodeURIComponent(uniToSend)}&student_id=${encodeURIComponent(studentId)}&current_lat=${encodeURIComponent(loc.lat)}&current_lon=${encodeURIComponent(loc.lon)}`;
          const ydata = await debugRequest(yangoUrl);
          const deep = ydata?.deep_link ?? ydata?.deepLink ?? ydata?.deep;
          const browser = ydata?.browser_link ?? ydata?.browserLink ?? ydata?.browser ?? ydata?.url;
          const fallback = ydata?.url ?? null;

          if (deep) {
            try { window.location.href = deep; } catch (err) { if (browser) try { window.open(browser, "_blank"); } catch (e) { alert(`Yango link: ${deep}`); } }
          } else if (browser) {
            try { window.open(browser, "_blank"); } catch (err) { window.location.href = browser; }
          } else if (fallback) {
            try { window.open(fallback, "_blank"); } catch (err) { window.location.href = fallback; }
          } else {
            alert("Yango ride unavailable");
          }
        } catch (err) {
          console.error("Yango action error:", err);
          alert("Failed to launch Yango");
        } finally {
          setButtonLoading(yangoBtn, false);
        }
      };
    }

    if (busBtn) {
      busBtn.onclick = async (e) => {
        e.preventDefault();
        setButtonLoading(busBtn, true);
        try {
          // Use summary endpoint to extract coordinates or location text
          const summaryUrl = `${BASE_URL}/home/boardinghouse/${encodeURIComponent(id)}?student_id=${encodeURIComponent(studentId)}&university=${encodeURIComponent(uniToSend)}`;
          const sdata = await debugRequest(summaryUrl);
          const lat = (sdata?.GPS_coordinates && Array.isArray(sdata.GPS_coordinates)) ? sdata.GPS_coordinates[0] : (sdata?.GPS_coordinates?.lat ?? null);
          const lon = (sdata?.GPS_coordinates && Array.isArray(sdata.GPS_coordinates)) ? sdata.GPS_coordinates[1] : (sdata?.GPS_coordinates?.lon ?? null);
          if (lat && lon) {
            const mapsQuery = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat)},${encodeURIComponent(lon)}`;
            window.open(mapsQuery, "_blank");
          } else if (sdata?.location) {
            const mapsQuery = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sdata.location)}`;
            window.open(mapsQuery, "_blank");
          } else {
            alert("Bus stop or location not available");
          }
        } catch (err) {
          console.error("Bus action error:", err);
          alert("Failed to open bus location");
        } finally {
          setButtonLoading(busBtn, false);
        }
      };
    }

    // Gallery rendering
    const gallerySlider = document.querySelector(".gallery-slider");
    if (gallerySlider) {
      gallerySlider.innerHTML = "";
      slides = [];
      const galleryItems = Array.isArray(resData.gallery) ? resData.gallery : (Array.isArray(resData.images) ? resData.images.map(u => ({ type: "image", url: u })) : []);
      galleryItems.forEach(item => {
        // normalize item shape if it's a string
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
        const badgeClass = (String(r.status || "").toUpperCase() === 'AVAILABLE') ? 'available'
                         : (String(r.status || "").toUpperCase() === 'UNAVAILABLE') ? 'unavailable'
                         : 'not-supported';
        const imgUrl = normalizeMediaUrl(r.image) || '/static/assets/icons/placeholder.jpg';
        const img = document.createElement("img");
        img.src = imgUrl;
        img.alt = r.type;
        img.onload = () => card.classList.remove("shimmer");
        img.onerror = () => card.classList.remove("shimmer");

        const info = document.createElement("div");
        info.className = "room-info";
        info.innerHTML = `
          <div class="room-header">
            <p class="room-type">${r.type}</p>
            <span class="badge ${badgeClass}">${r.status || 'NOT SUPPORTED'}</span>
          </div>
          <p class="room-price">Price: ${r.price || 'N/A'}</p>
        `;

        card.appendChild(img);
        card.appendChild(info);
        grid.appendChild(card);
      });
    }

  } catch (err) {
    console.error("Error loading boarding house details:", err);
    alert("Error loading boarding house details");
  }
}

/* ===============================
   BOOTSTRAP: parse params and call loader
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
