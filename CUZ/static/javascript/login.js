const baseUrl = "https://klenoboardinghouse-production.up.railway.app";
const apiKey = "d17809df9e6c4e33801af1c5ee9d11da";

/**
 * Helper to perform authorized POST requests
 */
async function authorizedPost(url, bodyData) {
    const token = localStorage.getItem("access_token");
    const response = await fetch(url, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${token}`,
            "x-api-key": apiKey
        },
        body: JSON.stringify(bodyData)
    });
    return response;
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const messageEl = document.getElementById("message");
    const loginBtn = document.getElementById("loginBtn");

    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value.trim();
    const university = document.getElementById("university").value.trim();

    // Feedback to user
    messageEl.textContent = "Logging in...";
    loginBtn.disabled = true;

    const formData = new URLSearchParams();
    formData.append("username", email);
    formData.append("password", password);

    try {
        const res = await fetch(`${baseUrl}/users/login?university=${university}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                "x-api-key": apiKey
            },
            body: formData.toString()
        });

        const data = await res.json();

        if (res.ok) {
            messageEl.style.color = "green";
            messageEl.textContent = "Login successful! Redirecting...";

            // Save tokens and context
            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("refresh_token", data.refresh_token);
            localStorage.setItem("role", data.role);
            localStorage.setItem("user_id", data.user_id);
            localStorage.setItem("university", data.university);
            localStorage.setItem("user_university", data.university);

            // Device Token Logic
            let deviceToken = data.device_token || `web-${Date.now()}`;
            localStorage.setItem("device_token", deviceToken);

            // Register device (Now works because authorizedPost is defined)
            try {
                await authorizedPost(`${baseUrl}/device/register`, {
                    university: data.university,
                    user_id: data.user_id,
                    role: data.role,
                    device_token: deviceToken,
                    platform: "web"
                });
                console.log("Device registered successfully");
            } catch (err) {
                console.error("Device registration background failed:", err);
            }

            // Redirect to homepage - using the route without .html if using the dynamic route
            window.location.href = "/homepage";

        } else {
            messageEl.style.color = "red";
            messageEl.textContent = data.detail || "Login failed. Check credentials.";
            loginBtn.disabled = false;
        }
    } catch (err) {
        messageEl.style.color = "red";
        messageEl.textContent = "Connection error. Please try again.";
        console.error("Login Error:", err);
        loginBtn.disabled = false;
    }
});