// imageReader.js
window.extractedText = window.extractedText || "";

document.addEventListener("DOMContentLoaded", () => {
  const sectionBox = document.getElementById("section-content");

  const observer = new MutationObserver(() => {
    const imageInput = document.getElementById("imageInput");
    const output = document.getElementById("imageTextOutput");

    if (imageInput && output && !imageInput.dataset.listenerAttached) {
      imageInput.dataset.listenerAttached = "true";

      imageInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file || !file.type.startsWith("image/")) return;

        output.value = "🕓 Scanning image...";
        const imageUrl = URL.createObjectURL(file);

        try {
          const result = await Tesseract.recognize(imageUrl, 'eng', {
            logger: m => console.log("🔍", m.status, m.progress),
          });

          const text = result.data.text.trim();
          output.value = text;
          window.extractedText = text;

          console.log("🖼️ OCR Extracted Text:", text);
        } catch (err) {
          console.error("❌ OCR failed:", err);
          output.value = "❌ Failed to extract text from image.";
        }
      });
    }
  });

  if (sectionBox) {
    observer.observe(sectionBox, { childList: true, subtree: true });
  }
});
