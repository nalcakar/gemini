// audioUploader.js
window.extractedText = window.extractedText || "";

document.addEventListener("DOMContentLoaded", () => {
  const sectionBox = document.getElementById("section-content");

  const observer = new MutationObserver(() => {
    const input = document.getElementById("audioInput");
    const output = document.getElementById("audioTextOutput");
    const status = document.getElementById("audioStatus");
    const progressBar = document.getElementById("uploadProgress");
    const spinner = document.getElementById("loadingSpinner");

    if (input && output && status && spinner && !input.dataset.listenerAttached) {
      input.dataset.listenerAttached = "true";

      // Create usage container if needed
      let usageBar = document.getElementById("audioUsageBar");
      if (!usageBar) {
        usageBar = document.createElement("div");
        usageBar.id = "audioUsageBar";
        usageBar.className = "usage-bar-container";
        status.parentNode.insertBefore(usageBar, output);
      }

      // Renders visual horizontal bars
function renderUsageBar(usage) {
  const dailyLimitMB = (usage.dailyLimit / 1024 / 1024).toFixed(0);
  const monthlyLimitMB = (usage.monthlyLimit / 1024 / 1024).toFixed(0);
  const dailyUsedMB = (usage.daily / 1024 / 1024).toFixed(2);
  const monthlyUsedMB = (usage.monthly / 1024 / 1024).toFixed(2);

  const dailyPercent = Math.min((usage.daily / usage.dailyLimit) * 100, 100);
  const monthlyPercent = Math.min((usage.monthly / usage.monthlyLimit) * 100, 100);

  const dailyWarn = usage.daily >= usage.dailyLimit;
  const monthlyWarn = usage.monthly >= usage.monthlyLimit;

  const usageBar = document.getElementById("audioUsageBar");
  const input = document.getElementById("audioInput");
  const status = document.getElementById("audioStatus");

  if (!usageBar || !input || !status) return;

  usageBar.innerHTML = `
    <div class="usage-bar-label">📆 Daily Usage: ${dailyUsedMB} / ${dailyLimitMB} MB</div>
    <div class="usage-bar">
      <div class="usage-bar-fill ${dailyWarn ? "usage-bar-warning" : ""}" style="width: ${dailyPercent}%;"></div>
    </div>
    <div class="usage-bar-label" style="margin-top: 8px;">🗓️ Monthly Usage: ${monthlyUsedMB} / ${monthlyLimitMB} MB</div>
    <div class="usage-bar">
      <div class="usage-bar-fill ${monthlyWarn ? "usage-bar-warning" : ""}" style="width: ${monthlyPercent}%;"></div>
    </div>
  `;

  // 🔒 Disable file input if limit is exceeded
  if (dailyWarn || monthlyWarn) {
    input.disabled = true;
    input.style.opacity = "0.5";
    status.textContent = "❌ Upload disabled — usage limit reached.";
  } else {
    input.disabled = false;
    input.style.opacity = "1";
  }
}



      // Initial fetch on page load
      const token = localStorage.getItem("accessToken");
      if (token) {
        fetch("https://gemini-j8xd.onrender.com/transcribe-usage", {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(r => r.json())
          .then(data => data.usage && renderUsageBar(data.usage))
          .catch(err => console.warn("⚠️ Cannot load usage info:", err.message));
      }

      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;

        if (!token) {
          status.textContent = "❌ Audio transcription is for logged-in users only.";
          return;
        }

        const maxSize = 20 * 1024 * 1024;
        if (file.size > maxSize) {
          status.textContent = "❌ File too large. Max 20MB allowed.";
          return;
        }

        spinner.style.display = "block";
        status.textContent = "⏳ Uploading...";
        progressBar.value = 0;
        output.value = "";

        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "https://gemini-j8xd.onrender.com/transcribe");
        xhr.setRequestHeader("Authorization", `Bearer ${token}`);

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            progressBar.value = percent;
            status.textContent = `📤 Uploading... ${percent}%`;
          }
        };

        xhr.onload = () => {
          spinner.style.display = "none";
          try {
            const res = JSON.parse(xhr.responseText);

            if (res.usage) renderUsageBar(res.usage);

            if (res.transcript) {
              output.value = res.transcript;
              window.extractedText = res.transcript;
              status.textContent = "✅ Transcription complete.";
              progressBar.value = 100;
            } else if (res.error) {
              status.textContent = `❌ ${res.error}`;
            } else {
              throw new Error("No transcript returned.");
            }
          } catch {
            status.textContent = "❌ Transcription failed.";
          }
        };

        xhr.onerror = () => {
          spinner.style.display = "none";
          status.textContent = "❌ Network error occurred.";
        };

        xhr.send(formData);
      });
    }
  });

  if (sectionBox) {
    observer.observe(sectionBox, { childList: true, subtree: true });
  }
});
