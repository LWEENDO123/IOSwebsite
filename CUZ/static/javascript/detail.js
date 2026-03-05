import { authorizedGet } from "./tokenManager.js";

console.log("🚀 DETAIL CONTROLLER STARTED");

const BASE_URL = "https://klenoboardinghouse-production.up.railway.app";

/* ===============================
   PAGE PARAMETERS
   (Equivalent to Flutter route args)
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
   VALIDATION
================================ */

function validateParams() {

console.group("🔎 PARAM VALIDATION");

if (!houseId) {
console.error("❌ Missing houseId");
return false;
}

if (!university) {
console.error("❌ Missing university");
return false;
}

if (!studentId) {
console.error("❌ Missing studentId");
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
console.error("❌ ERROR:", message);
alert(message || "Something went wrong");
}

/* ===============================
   LOCATION SERVICE
   (Equivalent to Flutter Permission + Geolocator)
================================ */

function getCurrentLocation() {

console.log("📍 Requesting user location...");

return new Promise((resolve, reject) => {

if (!navigator.geolocation) {
reject("Geolocation not supported");
return;
}

navigator.geolocation.getCurrentPosition(

(pos) => {

console.log("📍 LOCATION RECEIVED:", pos.coords);

resolve({
lat: pos.coords.latitude,
lon: pos.coords.longitude
});

},

(err) => {

console.error("❌ LOCATION ERROR:", err);
reject(err.message);

}

);

});

}

/* ===============================
   NETWORK DEBUGGER
================================ */

async function debugRequest(url) {

console.group("🌍 NETWORK REQUEST");
console.log("URL:", url);

try {

const res = await authorizedGet(url);

console.log("STATUS:", res.status);

const raw = await res.text();

console.log("RAW RESPONSE:", raw);

let data = null;

try {
data = JSON.parse(raw);
console.log("JSON:", data);
} catch {
console.warn("⚠ JSON parsing failed");
}

console.groupEnd();

return data;

} catch (err) {

console.error("❌ NETWORK ERROR:", err);
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

console.groupEnd();

}

/* ===============================
   GOOGLE MAPS ACTION
================================ */

async function openGoogleMaps() {

console.group("🗺 GOOGLE BUTTON CLICKED");

if (!validateParams()) return;

const { lat, lon } = await getCurrentLocation();

const url =
`${BASE_URL}/home/google/${encodeURIComponent(houseId)}`
+ `?university=${encodeURIComponent(university)}`
+ `&student_id=${encodeURIComponent(studentId)}`
+ `&current_lat=${lat}`
+ `&current_lon=${lon}`;

const data = await debugRequest(url);

if (data?.link) {

console.log("🗺 Opening map:", data.link);

window.open(data.link, "_blank");

} else {

showError("Google map link unavailable");

}

console.groupEnd();

}

/* ===============================
   YANGO ACTION
================================ */

async function openYango() {

console.group("🚗 YANGO BUTTON CLICKED");

if (!validateParams()) return;

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

console.groupEnd();

}

/* ===============================
   PAGE INIT (Flutter initState)
================================ */

document.addEventListener("DOMContentLoaded", () => {

console.log("🚀 PAGE INITIALIZED");

if (!validateParams()) return;

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

});
