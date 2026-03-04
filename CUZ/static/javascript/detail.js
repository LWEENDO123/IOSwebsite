import { authorizedGet } from "./tokenManager.js";

const baseUrl = "https://klenoboardinghouse-production.up.railway.app";
const currentUserUniversity = localStorage.getItem("user_university") || "";

const params = new URLSearchParams(window.location.search);
const houseId = params.get("id");
const university = params.get("university");
const studentId = params.get("student_id");

// ---------- Phone ----------
async function callLandlordPhone() {
  try {
    const url = `${baseUrl}/home/boardinghouse/${encodeURIComponent(houseId)}/landlord-phone?university=${encodeURIComponent(university)}&student_id=${encodeURIComponent(studentId)}`;
    const res = await authorizedGet(url);
    const data = await res.json();
    if (data.phone_number) {
      window.location.href = `tel:${data.phone_number}`;
    } else {
      alert(data.message || "Phone number not available");
    }
  } catch (err) {
    console.error("Phone error:", err);
    alert("Error fetching landlord phone");
  }
}

// ---------- Google Maps ----------
async function openGoogleMaps() {
  try {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const url = `${baseUrl}/home/google/${encodeURIComponent(houseId)}?university=${encodeURIComponent(university)}&student_id=${encodeURIComponent(studentId)}&current_lat=${lat}&current_lon=${lon}`;
      const res = await authorizedGet(url);
      const data = await res.json();
      if (data.link) {
        window.open(data.link, "_blank");
      } else {
        alert("Google Maps link not available");
      }
    });
  } catch (err) {
    console.error("Google Maps error:", err);
    alert("Error opening Google Maps");
  }
}

// ---------- Yango ----------
async function openYango() {
  try {
    if (!navigator.geolocation) {
      alert("Geolocation not supported");
      return;
    }
    navigator.geolocation.getCurrentPosition(async pos => {
      const lat = pos.coords.latitude;
      const lon = pos.coords.longitude;
      const url = `${baseUrl}/home/yango/${encodeURIComponent(houseId)}?university=${encodeURIComponent(university)}&student_id=${encodeURIComponent(studentId)}&current_lat=${lat}&current_lon=${lon}&tariff=econom&lang=en&secure=false`;
      const res = await authorizedGet(url);
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        alert("Yango link not available");
      }
    });
  } catch (err) {
    console.error("Yango error:", err);
    alert("Error opening Yango");
  }
}

// ---------- Bind actions ----------
document.addEventListener("DOMContentLoaded", () => {
  const phoneBtn = document.querySelector(".action-icon.phone");
  if (phoneBtn) phoneBtn.addEventListener("click", callLandlordPhone);

  const googleBtn = document.querySelector(".action-icon.google");
  if (googleBtn) googleBtn.addEventListener("click", openGoogleMaps);

  const yangoBtn = document.querySelector(".action-icon.yango");
  if (yangoBtn) yangoBtn.addEventListener("click", openYango);
});
