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

        // 🔒 Dosya boyutu kontrolü
        const maxSize = 20 * 1024 * 1024;
        if (file.size > maxSize) {
          status.textContent = "❌ Dosya çok büyük. En fazla 20MB olabilir.";
          return;
        }

        // Spinner göster
        spinner.style.display = "block";
        status.textContent = "⏳ Yükleniyor...";

        // FormData hazırla
        const formData = new FormData();
        formData.append("file", file);

        // XMLHttpRequest ile gönder
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "https://gemini-j8xd.onrender.com/transcribe");

        xhr.upload.onprogress = (event) => {
          if (event.lengthComputable) {
            const percent = Math.round((event.loaded / event.total) * 100);
            progressBar.value = percent;
            status.textContent = `📤 Yükleniyor... ${percent}%`;
          }
        };

        xhr.onload = () => {
          spinner.style.display = "none"; // Yükleme bitti
          try {
            const res = JSON.parse(xhr.responseText);
            if (res.transcript) {
              output.value = res.transcript;
              window.extractedText = res.transcript;
              status.textContent = "✅ Transkripsiyon tamamlandı.";
              progressBar.value = 100;
            } else {
              throw new Error("Transkript alınamadı");
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
