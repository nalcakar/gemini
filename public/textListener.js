// textListener.js
window.extractedText = window.extractedText || "";

document.addEventListener("DOMContentLoaded", () => {
  const sectionBox = document.getElementById("section-content");

  const observer = new MutationObserver(() => {
    const manualInput = document.getElementById("textManualInput");

    if (manualInput && !manualInput.dataset.listenerAttached) {
      manualInput.dataset.listenerAttached = "true";

      const updateExtractedText = () => {
        const newText = manualInput.value;
        if (newText !== window.extractedText) {
          window.extractedText = newText;
          console.log("📝 Updated extractedText (input):", window.extractedText);
        }
      };

      const forcePasteUpdate = () => {
        setTimeout(() => {
          window.extractedText = manualInput.value;
          console.log("📋 Paste detected, forced update:", window.extractedText);
        }, 50); // wait for pasted text to actually be inserted
      };

      manualInput.addEventListener("input", updateExtractedText);
      manualInput.addEventListener("paste", forcePasteUpdate);
    }
  });

  if (sectionBox) {
    observer.observe(sectionBox, { childList: true, subtree: true });
  }
});
