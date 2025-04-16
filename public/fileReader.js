// fileReader.js
let extractedText = "";

document.addEventListener("DOMContentLoaded", () => {
  const contentBox = document.getElementById("section-content");

  const observer = new MutationObserver(() => {
    const fileInput = document.getElementById("fileInput");
    const output = document.getElementById("textOutput");

    if (fileInput && output && !fileInput.dataset.listenerAttached) {
      fileInput.dataset.listenerAttached = "true";
      fileInput.addEventListener("change", async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const ext = file.name.split(".").pop().toLowerCase();
        if (ext === "pdf") {
          extractedText = await extractFromPDF(file);
        } else if (ext === "docx") {
          extractedText = await extractFromDocx(file);
        } else if (ext === "txt") {
          extractedText = await extractFromTxt(file);
        } else {
          extractedText = "❌ Unsupported file type.";
        }

        output.value = extractedText;
        console.log("✅ Extracted Text:", extractedText);
      });
    }
  });

  observer.observe(contentBox, { childList: true, subtree: true });
});

// === 📄 PDF ===
async function extractFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = "";

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(i => i.str).join(" ") + "\n\n";
  }

  return text.trim();
}

// === 📘 DOCX ===
async function extractFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value.trim();
}

// === 📝 TXT ===
async function extractFromTxt(file) {
  return await file.text();
}
