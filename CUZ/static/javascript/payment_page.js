// /static/javascript/premium.js
import { authorizedGet, authorizedPost } from "./tokenManager.js";

/*
  Mirrors Dart PremiumPaymentPage behavior:
  - Loads stored phone via GET /payments/{student_id}/phone?university={university}
  - Normalizes phone to +260 format
  - Detects operator; only Airtel allowed
  - Posts to POST /payments/collect/mobile-money
  - Shows friendly messages and debug output
*/

const baseUrl = "https://klenoboardinghouse-production.up.railway.app";
const studentId = localStorage.getItem("user_id") || "";
const university = localStorage.getItem("user_university") || "";

const phoneInput = document.getElementById("phoneInput");
const operatorSelect = document.getElementById("operatorSelect");
const payBtn = document.getElementById("payBtn");
const statusMessage = document.getElementById("statusMessage");
const storedPhoneContainer = document.getElementById("storedPhoneContainer");
const debugEl = document.getElementById("debug");

let storedPhoneNumber = null;
let useStoredNumber = true;

// Normalize phone to +260 format (same logic as Dart)
function normalizePhone(phone) {
  if (!phone) return phone;
  const s = String(phone).trim();
  if (s.startsWith("+")) return s;
  if (s.startsWith("260")) return `+${s}`;
  if (s.startsWith("0")) return `+260${s.substring(1)}`;
  return `+260${s}`;
}

// Detect operator (mirrors Dart)
function detectOperator(msisdn) {
  if (!msisdn) return "airtel";
  const digits = String(msisdn).replace(/\D/g, "");
  let local = digits;
  if (digits.startsWith("260")) local = digits.substring(3);
  else if (digits.startsWith("0")) local = digits.substring(1);

  if (local.length < 3) return "airtel";
  const prefix = local.substring(0, 3);

  const airtelPrefixes = new Set(["097", "077"]);
  const mtnPrefixes = new Set(["096"]);
  const zamtelPrefixes = new Set(["095"]);

  if (airtelPrefixes.has(prefix)) return "airtel";
  if (mtnPrefixes.has(prefix)) return "mtn";
  if (zamtelPrefixes.has(prefix)) return "zamtel";
  return "airtel";
}

// UI helpers
function setLoading(loading) {
  payBtn.disabled = loading;
  payBtn.textContent = loading ? "Processing…" : "Pay ZMW 75 / 150";
  if (loading) statusMessage.textContent = "";
}

function showMessage(text, type = "info") {
  statusMessage.className = "message";
  if (type === "success") statusMessage.classList.add("success");
  if (type === "error") statusMessage.classList.add("error");
  statusMessage.textContent = text;
}

function showDebug(title, status, body) {
  if (!debugEl) return;
  debugEl.style.display = "block";
  debugEl.textContent = `${title}\nStatus: ${status}\n\n${typeof body === "string" ? body : JSON.stringify(body, null, 2)}`;
}

// Load stored phone from backend
async function loadStoredPhone() {
  if (!studentId || !university) return;
  try {
    const url = `${baseUrl}/payments/${encodeURIComponent(studentId)}/phone?university=${encodeURIComponent(university)}`;
    const res = await authorizedGet(url);
    if (!res.ok) {
      storedPhoneNumber = null;
      renderStoredPhone();
      return;
    }
    const data = await res.json();
    storedPhoneNumber = data.phone_number || null;
    renderStoredPhone();
  } catch (err) {
    console.error("Error loading stored phone:", err);
    storedPhoneNumber = null;
    renderStoredPhone();
  }
}

function renderStoredPhone() {
  storedPhoneContainer.innerHTML = "";
  if (storedPhoneNumber) {
    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.gap = "12px";
    wrapper.style.alignItems = "center";
    wrapper.style.marginBottom = "8px";

    const radioUse = document.createElement("input");
    radioUse.type = "radio";
    radioUse.name = "phoneChoice";
    radioUse.checked = true;
    radioUse.id = "useStored";
    radioUse.addEventListener("change", () => {
      useStoredNumber = true;
      phoneInput.value = "";
      phoneInput.disabled = true;
    });

    const labelUse = document.createElement("label");
    labelUse.htmlFor = "useStored";
    labelUse.textContent = `Use stored number: ${storedPhoneNumber}`;

    const radioOther = document.createElement("input");
    radioOther.type = "radio";
    radioOther.name = "phoneChoice";
    radioOther.id = "useOther";
    radioOther.addEventListener("change", () => {
      useStoredNumber = false;
      phoneInput.disabled = false;
      phoneInput.focus();
    });

    const labelOther = document.createElement("label");
    labelOther.htmlFor = "useOther";
    labelOther.textContent = "Use another number";

    wrapper.appendChild(radioUse);
    wrapper.appendChild(labelUse);
    wrapper.appendChild(radioOther);
    wrapper.appendChild(labelOther);

    storedPhoneContainer.appendChild(wrapper);

    useStoredNumber = true;
    phoneInput.disabled = true;
  } else {
    const note = document.createElement("div");
    note.style.color = "var(--muted)";
    note.style.marginBottom = "8px";
    note.textContent = "No stored phone number found. Enter a mobile money number below.";
    storedPhoneContainer.appendChild(note);
    useStoredNumber = false;
    phoneInput.disabled = false;
  }
}

// Payment flow
async function pay() {
  setLoading(true);
  showMessage("", "info");
  debugEl.style.display = "none";
  debugEl.textContent = "";

  try {
    const chosen = useStoredNumber && storedPhoneNumber ? storedPhoneNumber : phoneInput.value.trim();
    if (!chosen) {
      showMessage("Please provide a mobile money number.", "error");
      setLoading(false);
      return;
    }

    const normalized = normalizePhone(chosen);
    const operatorSelected = operatorSelect.value;
    const operator = operatorSelected === "auto" ? detectOperator(normalized) : operatorSelected;

    if (operator !== "airtel") {
      showMessage("❌ Only Airtel mobile-money is supported right now. MTN and Zamtel are under testing.", "error");
      setLoading(false);
      return;
    }

    const payload = {
      university: university || "",
      operator: operator,
      bearer: "merchant",
      phone: normalized,
      amount: 75,
      country: "zm"
    };

    const endpoint = `${baseUrl}/payments/collect/mobile-money`;

    let res;
    try {
      res = await authorizedPost(endpoint, payload);
    } catch (err) {
      // fallback to fetch if authorizedPost not available
      res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    const statusCode = res.status ?? res.statusCode ?? 0;
    let body;
    try { body = await res.json(); } catch (e) { body = await res.text().catch(() => String(e)); }

    if (statusCode === 200) {
      showMessage("✅ Payment request sent. Confirm on your phone.", "success");
      showDebug("Payment Sent", statusCode, body);
    } else if (statusCode === 422) {
      showMessage("❌ Payment failed: invalid request data. Please confirm your phone number and try again.", "error");
      showDebug("Payment Failed (422)", statusCode, body);
    } else if (statusCode >= 500) {
      showMessage("❌ Payment provider error. Please try again later.", "error");
      showDebug("Payment Error", statusCode, body);
    } else {
      showMessage(`❌ Payment failed (status ${statusCode}).`, "error");
      showDebug("Payment Response", statusCode, body);
    }
  } catch (err) {
    console.error("Payment exception:", err);
    showMessage(`❌ Internal error: ${err}`, "error");
  } finally {
    setLoading(false);
  }
}

// Wire events
payBtn.addEventListener("click", (e) => {
  e.preventDefault();
  pay();
});

// Initialize
(async function init() {
  operatorSelect.value = "auto";
  await loadStoredPhone();
  renderStoredPhone();
})();
