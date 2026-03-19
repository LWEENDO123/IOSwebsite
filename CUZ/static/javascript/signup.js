document.getElementById("signupForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const body = {
    first_name: document.getElementById("first_name").value.trim(),
    last_name: document.getElementById("last_name").value.trim(),
    email: document.getElementById("email").value.trim(),
    password: document.getElementById("password").value.trim(),
    phone_number: document.getElementById("phone_number").value.trim(),
    university: document.getElementById("university").value.trim(),
  };

  const messageEl = document.getElementById("message");
  messageEl.textContent = "";
  messageEl.className = "message"; // reset styling

  try {
    const res = await fetch("https://klenoboardinghouse-production.up.railway.app/users/student_signup", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": "d17809df9e6c4e33801af1c5ee9d11da"
      },
      body: JSON.stringify(body)
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      // Backend returns access_token + user_id
      messageEl.textContent = "Signup successful! You can now login.";
      messageEl.classList.add("success");

      // Redirect after short delay
      setTimeout(() => {
        window.location.href = "login.html";
      }, 1500);
    } else {
      // Handle backend error details
      let errorMsg = "Signup failed.";
      if (data.detail) {
        errorMsg = data.detail;
      } else if (data.message) {
        errorMsg = data.message;
      }
      messageEl.textContent = errorMsg;
      messageEl.classList.add("error");
    }
  } catch (err) {
    messageEl.textContent = "Network error: " + err.message;
    messageEl.classList.add("error");
  }
});
