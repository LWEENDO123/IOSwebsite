import { authorizedGet } from "./tokenManager.js";

console.log("🚀 DETAIL CONTROLLER STARTED");

const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";

/* ===============================
   PAGE PARAMETERS
================================ */

const params = new URLSearchParams(window.location.search);

const houseId = params.get("id");
const university = params.get("university");
const studentId = params.get("student_id");

console.group("📌 PAGE PARAMETERS");
console.log("houseId:", houseId);
console.log("university:", university);
console.log("studentId:", studentId);
console.groupEnd();


/* ===============================
   PARAM VALIDATION
================================ */

function validateParams() {

console.group("🔎 PARAM VALIDATION");

if (!houseId) {
console.error("❌ Missing houseId");
console.groupEnd();
return false;
}

if (!university) {
console.error("❌ Missing university");
console.groupEnd();
return false;
}

if (!studentId) {
console.error("❌ Missing studentId");
console.groupEnd();
return false;
}

console.log("✅ Params valid");
console.groupEnd();

return true;
}


/* ===============================
   ERROR HANDLER
================================ */

function showError(message) {

console.group("❌ APPLICATION ERROR");

console.error(message);

alert(message || "Something went wrong");

console.groupEnd();

}


/* ===============================
   GEOLOCATION SERVICE
================================ */

function getCurrentLocation() {

console.group("📍 LOCATION REQUEST");

return new Promise((resolve, reject) => {

if (!navigator.geolocation) {

console.error("❌ Geolocation not supported");
reject("Geolocation not supported");
console.groupEnd();
return;

}

navigator.geolocation.getCurrentPosition(

(pos) => {

const location = {
lat: pos.coords.latitude,
lon: pos.coords.longitude
};

console.log("📍 Location received:", location);

console.groupEnd();

resolve(location);

},

(err) => {

console.error("❌ Location error:", err.message);

console.groupEnd();

reject(err.message);

},

{
enableHighAccuracy: true,
timeout: 10000,
maximumAge: 0
}

);

});

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

/* ---------- RESPONSE HEADERS ---------- */

console.group("📥 Response Headers");

for (const [key, value] of res.headers.entries()) {
console.log(`${key}: ${value}`);
}

console.groupEnd();

/* ---------- RAW RESPONSE ---------- */

const raw = await res.text();

console.log("📦 Response Length:", raw.length);

/* Empty response detection */

if (!raw || raw.trim() === "") {

console.error("❌ EMPTY RESPONSE BODY");

console.groupEnd();

return null;

}

console.log("📦 Raw Response:", raw);

/* ---------- JSON PARSING ---------- */

let data = null;

try {

data = JSON.parse(raw);

console.log("✅ JSON Parsed Successfully");

console.log("📄 JSON Object:", data);

} catch (parseError) {

console.error("❌ JSON Parsing Failed");

console.error(parseError);

}

console.groupEnd();

return data;

} catch (err) {

console.error("❌ Network Request Failed");

console.error(err);

console.groupEnd();

throw err;

}

}


/* ===============================
   PHONE ACTION
================================ */

async function callLandlordPhone() {

console.group("📞 PHONE BUTTON CLICKED");

if (!validateParams()) return;

try {

const url =
`${BASE_URL}/home/boardinghouse/${encodeURIComponent(houseId)}/landlord-phone`
+ `?university=${encodeURIComponent(university)}`
+ `&student_id=${encodeURIComponent(studentId)}`;

const data = await debugRequest(url);

if (data?.phone_number) {

console.log("📞 Launching dialer:", data.phone_number);

window.location.href = `tel:${data.phone_number}`;

} else {

showError("Phone number unavailable");

}

} catch (err) {

showError("Failed to fetch phone number");

}

console.groupEnd();

}


/* ===============================
   GOOGLE MAPS ACTION
================================ */

async function openGoogleMaps() {

console.group("🗺 GOOGLE MAPS BUTTON");

if (!validateParams()) return;

try {

const { lat, lon } = await getCurrentLocation();

const url =
`${BASE_URL}/home/google/${encodeURIComponent(houseId)}`
+ `?university=${encodeURIComponent(university)}`
+ `&student_id=${encodeURIComponent(studentId)}`
+ `&current_lat=${lat}`
+ `&current_lon=${lon}`;

const data = await debugRequest(url);

if (data?.link) {

console.log("🗺 Opening Google Maps:", data.link);

window.open(data.link, "_blank");

} else {

showError("Google Maps link unavailable");

}

} catch (err) {

showError("Failed to open Google Maps");

}

console.groupEnd();

}


/* ===============================
   YANGO ACTION
================================ */

async function openYango() {

console.group("🚗 YANGO BUTTON");

if (!validateParams()) return;

try {

const { lat, lon } = await getCurrentLocation();

const url =
`${BASE_URL}/home/yango/${encodeURIComponent(houseId)}`
+ `?university=${encodeURIComponent(university)}`
+ `&student_id=${encodeURIComponent(studentId)}`
+ `&current_lat=${lat}`
+ `&current_lon=${lon}`;

const data = await debugRequest(url);

if (data?.deep_link) {

console.log("🚗 Opening Yango deep link");

window.location.href = data.deep_link;

}
else if (data?.browser_link) {

console.log("🚗 Opening Yango browser link");

window.open(data.browser_link, "_blank");

}
else {

showError("Yango ride unavailable");

}

} catch (err) {

showError("Failed to launch Yango");

}

console.groupEnd();

}


/* ===============================
   PAGE INITIALIZATION
================================ */

document.addEventListener("DOMContentLoaded", () => {

console.group("🚀 PAGE INITIALIZATION");

if (!validateParams()) {

console.warn("⚠ Page initialization stopped due to invalid parameters");

console.groupEnd();

return;

}

const phoneBtn = document.getElementById("phoneBtn");
const googleBtn = document.getElementById("googleBtn");
const yangoBtn = document.getElementById("yangoBtn");

console.log("🔘 Buttons detected:", {
phoneBtn,
googleBtn,
yangoBtn
});

phoneBtn?.addEventListener("click", callLandlordPhone);
googleBtn?.addEventListener("click", openGoogleMaps);
yangoBtn?.addEventListener("click", openYango);

console.groupEnd();

});
