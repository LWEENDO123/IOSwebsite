import { authorizedGet, authorizedPost } from "./tokenManager.js";

const BASE_URL = "https://klenoboardinghouse-production.up.railway.app/home";

const params = new URLSearchParams(window.location.search);

const houseId = params.get("id");
const university = params.get("university");
const studentId =
  params.get("student_id") || localStorage.getItem("user_id");

let galleryData = [];
let currentIndex = 0;

/* =========================
   LOAD DATA
========================= */
async function loadBoardingHouse() {
  try {
    const url = `${BASE_URL}/boardinghouse/${houseId}?university=${university}&student_id=${studentId}`;

    const res = await authorizedGet(url);

    if (!res.ok) {
      alert("Failed loading boarding house");
      return;
    }

    const data = await res.json();

    populateDetail(data);

  } catch (error) {
    console.error(error);
  }
}

/* =========================
   POPULATE
========================= */
function populateDetail(data) {
  document.getElementById("listingTitle").textContent =
    data.name || "Boarding House";

  document.querySelector(".location").textContent =
    data.location || "";

  document.querySelector(".space-description").textContent =
    data.description || "No description";

  document.querySelector(".conditions").textContent =
    data.conditions || "No conditions";

  renderGallery(data.gallery || []);
  attachActions(data);
}

/* =========================
   GALLERY SLIDER
========================= */
function renderGallery(gallery) {
  const slider = document.getElementById("imageSlider");

  slider.innerHTML = "";
  galleryData = gallery;

  if (!gallery.length) return;

  gallery.forEach((item) => {
    const slide = document.createElement("div");
    slide.className = "slide";

    slide.innerHTML = `
      <img src="${item.url}" alt="Boarding house image">
    `;

    slider.appendChild(slide);
  });

  updateSlider();
}

/* =========================
   UPDATE SLIDER POSITION
========================= */
function updateSlider() {
  const slider = document.getElementById("imageSlider");
  slider.style.transform = `translateX(-${currentIndex * 100}%)`;
}

/* =========================
   NAVIGATION
========================= */
document.getElementById("nextBtn").addEventListener("click", () => {
  if (!galleryData.length) return;

  currentIndex = (currentIndex + 1) % galleryData.length;
  updateSlider();
});

document.getElementById("prevBtn").addEventListener("click", () => {
  if (!galleryData.length) return;

  currentIndex =
    (currentIndex - 1 + galleryData.length) % galleryData.length;

  updateSlider();
});

/* =========================
   ACTION BUTTONS
========================= */
function attachActions(data) {
  document.getElementById("phoneBtn").onclick = () => {
    window.location.href = `tel:${data.phone_number}`;
  };

  document.getElementById("googleBtn").onclick = () => {
    window.open(
      `${BASE_URL}/google/${houseId}?university=${university}&student_id=${studentId}`,
      "_blank"
    );
  };

  document.getElementById("yangoBtn").onclick = () => {
    window.open(
      `${BASE_URL}/yango/${houseId}?university=${university}&student_id=${studentId}`,
      "_blank"
    );
  };

  document.getElementById("arrivalBtn").onclick = () => {
    notifyArrival();
  };
}

/* =========================
   ARRIVAL
========================= */
async function notifyArrival() {
  try {
    const url = `${BASE_URL}/${university}/boardinghouse/${houseId}/notify_arrival`;

    const res = await authorizedPost(url, {
      student_id: studentId,
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.detail || "Failed");
      return;
    }

    alert("Arrival sent successfully");
  } catch (error) {
    console.error(error);
  }
}

/* =========================
   INIT
========================= */
document.addEventListener("DOMContentLoaded", loadBoardingHouse);
