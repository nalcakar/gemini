function attachTextAreaListeners() {
  const allTextareas = document.querySelectorAll("textarea");

  allTextareas.forEach((textarea) => {
    // Zaten dinleniyorsa tekrar bağlama
    if (textarea.dataset.listenerAttached === "true") return;

    textarea.dataset.listenerAttached = "true";

    // Elle yazma
    textarea.addEventListener("input", () => {
      if (textarea.value.trim().length > 0) {
        window.extractedText = textarea.value.trim();
      }
    });

    // Yapıştırma
    textarea.addEventListener("paste", () => {
      setTimeout(() => {
        if (textarea.value.trim().length > 0) {
          window.extractedText = textarea.value.trim();
        }
      }, 50);
    });

    // İlk açılışta alan doluysa
    if (textarea.value.trim().length > 0) {
      window.extractedText = textarea.value.trim();
    }
  });
}

// Sayfa yüklendiğinde ve sekme değiştiğinde dinleyici bağla
document.addEventListener("DOMContentLoaded", attachTextAreaListeners);
const sectionObserver = new MutationObserver(attachTextAreaListeners);
const sectionBox = document.getElementById("section-content");
if (sectionBox) {
  sectionObserver.observe(sectionBox, { childList: true, subtree: true });
}
