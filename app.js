const fs = require("fs");
const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");

// Soruları oku
const questions = JSON.parse(fs.readFileSync("questions.json", "utf8"));

// Her soru için bir belge üret
questions.forEach((data, i) => {
  const template = fs.readFileSync("template.docx", "binary");
  const zip = new PizZip(template);
  const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

  doc.render(data);

  const buffer = doc.getZip().generate({ type: "nodebuffer" });
  fs.writeFileSync(`output_${i + 1}.docx`, buffer);
});

console.log("✅ Tüm sorular Word belgesi olarak oluşturuldu!");
