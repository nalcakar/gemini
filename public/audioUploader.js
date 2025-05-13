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

        const maxSize = 20 * 1024 * 1024;
        if (file.size > maxSize) {
          status.textContent = "❌ Dosya çok büyük. En fazla 20MB olabilir.";
          return;
        }

        spinner.style.display = "block";
        status.textContent = "⏳ Yükleniyor...";

        const formData = new FormData();
        formData.append("file", file);

        const xhr = new XMLHttpRequest();
        xhr.open("POST", "https://gemini-j8xd.onrender.com/transcribe");

        // 🪪 Add headers
        const visitorId = localStorage.getItem("visitorId") || "guest";
        const accessToken = localStorage.getItem("accessToken");

        xhr.setRequestHeader("x-visitor-id", visitorId);
        if (accessToken) {
          xhr.setRequestHeader("Authorization", "Bearer " + accessToken);
        }

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            progressBar.value = percent;
            status.textContent = `📤 Yükleniyor... ${percent}%`;
          }
        };

        xhr.onload = () => {
          spinner.style.display = "none";
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.transcript) {
              output.value = res.transcript;
              window.extractedText = res.transcript;
              status.textContent = "✅ Transkripsiyon tamamlandı.";
              progressBar.value = 100;

              // 🔄 Update usage bars if present
              if (res.usage) updateTranscribeUsageBars(res.usage);
            } else {
              throw new Error("No transcript");
            }
          } catch {
            status.textContent = "❌ Transkripsiyon başarısız.";
          }
        };

        xhr.onerror = () => {
          spinner.style.display = "none";
          status.textContent = "❌ Ağ hatası oluştu.";
        };

        xhr.send(formData);
      });
    }
  });

  if (sectionBox) {
    observer.observe(sectionBox, { childList: true, subtree: true });
  }
});
