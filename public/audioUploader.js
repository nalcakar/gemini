// audioUploader.js
window.extractedText = window.extractedText || "";

document.addEventListener("DOMContentLoaded", () => {
  const sectionBox = document.getElementById("section-content");

  const observer = new MutationObserver(() => {
    const input = document.getElementById("audioInput");
    const output = document.getElementById("audioTextOutput");
    const status = document.getElementById("audioStatus");
    const progressBar = document.getElementById("uploadProgress");
    const languageSelect = document.getElementById("audioLanguage");

    if (input && output && status && !input.dataset.listenerAttached) {
      input.dataset.listenerAttached = "true";

      input.addEventListener("change", () => {
        const file = input.files[0];
        if (!file) return;

        // 1. File size check
        const maxSize = 20 * 1024 * 1024; // 20MB
        if (file.size > maxSize) {
          status.textContent = "❌ File too large. Max size: 20MB.";
          return;
        }

        // 2. Build FormData
        const formData = new FormData();
        formData.append("file", file);
        const lang = languageSelect?.value || "";
        if (lang) formData.append("language", lang);

        // 3. Setup upload
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/transcribe");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            progressBar.value = percent;
            status.textContent = `⏳ Uploading... ${percent}%`;
          }
        };

        xhr.onload = () => {
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.transcript) {
              output.value = res.transcript;
              window.extractedText = res.transcript;
              status.textContent = "✅ Transcription complete.";
              progressBar.value = 100;
            } else {
              throw new Error("No transcript");
            }
          } catch {
            status.textContent = "❌ Transcription failed.";
          }
        };

        xhr.onerror = () => {
          status.textContent = "❌ Network error during upload.";
        };

        xhr.send(formData);
      });
    }
  });

  if (sectionBox) {
    observer.observe(sectionBox, { childList: true, subtree: true });
  }
});
