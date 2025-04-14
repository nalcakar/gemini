document.addEventListener("DOMContentLoaded", () => {
  function renderUserBox() {
    const name = localStorage.getItem("userName");
    const membership = localStorage.getItem("membershipType") || "Free";
    const accessToken = localStorage.getItem("accessToken");

    const container = document.getElementById("user-box") || document.createElement("div");
    container.id = "user-box";

    container.innerHTML = accessToken && name
      ? `
        <div class="user-box-inner">
          <span class="user-name">${name}</span>
          <span class="badge ${membership.toLowerCase()}">${membership}</span>
          <button class="logout-btn">Logout</button>
        </div>
      `
      : `
        <div class="user-box-inner">
          <a class="login-btn" href="https://www.patreon.com/oauth2/authorize?response_type=code&client_id=IGUdh16RfRFyfzSrcqZR-Ots5N2jUd3Cu5B2tK5EKm6Dlaou0h2Pzq4S_urdc0Sl
&redirect_uri=https://gemini-j8xd.onrender.com/auth/patreon/callback&scope=identity">Login with Patreon</a>
        </div>
      `;

    if (!document.getElementById("user-box")) {
      document.body.prepend(container);
    }

    const logoutBtn = document.querySelector(".logout-btn");
    if (logoutBtn) {
      logoutBtn.onclick = () => {
        localStorage.clear();
        location.reload();
      };
    }
  }

  // Token geldiyse kaydet ve sayfayı temizle
  const params = new URLSearchParams(window.location.search);
  if (params.get("accessToken")) {
    localStorage.setItem("accessToken", params.get("accessToken"));
    localStorage.setItem("userEmail", params.get("userEmail"));
    localStorage.setItem("userName", params.get("userName"));
    localStorage.setItem("membershipType", params.get("membershipType") || "Free");

    // Otomatik sekmeyi geri getir
    const last = localStorage.getItem("lastSection");
    if (last && typeof window.showSection === "function") {
      setTimeout(() => window.showSection(last), 100);
    }

    // URL'den query parametrelerini temizle
    window.history.replaceState({}, document.title, window.location.pathname);
  }

  renderUserBox();
});
