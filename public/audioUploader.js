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

      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;

        // ❌ Block visitors
        if (!localStorage.getItem("accessToken")) {
          status.textContent = "❌ Audio transcription is for logged-in users only.";
          return;
        }

        // 🔒 File size limit (client-side max 20MB)
        const maxSize = 20 * 1024 * 1024;
        if (file.size > maxSize) {
          status.textContent = "❌ File too large. Max 20MB allowed.";
          return;
        }

        // Show spinner
        spinner.style.display = "block";
        status.textContent = "⏳ Uploading...";

        // Prepare form data
        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "https://gemini-j8xd.onrender.com/transcribe");

        // ✅ Include accessToken in Authorization header
        const token = localStorage.getItem("accessToken");
        if (token) {
          xhr.setRequestHeader("Authorization", `Bearer ${token}`);
        }

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
            if (res.transcript) {
              output.value = res.transcript;
              window.extractedText = res.transcript;
              status.textContent = "✅ Transcription complete.";
              progressBar.value = 100;
            } else if (res.error) {
              status.textContent = `❌ ${res.error}`;
            } else {
              throw new Error("No transcript returned");
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
