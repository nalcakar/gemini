const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { franc } = require("franc");
const fs = require("fs"); // ✅ Eksik olan bu satır
require("dotenv").config();

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const app = express();

app.set("trust proxy", 1); // Bu satırı mutlaka ekle!

// Rate limit middleware’i bundan sonra gelsin

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// === CORS KONTROLÜ (Sadece doitwithai.org erişebilsin) ===
const allowedOrigins = ["https://doitwithai.org"];

app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (allowedOrigins.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  // Diğer gerekli CORS başlıkları
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  next();
});

// === RATE LIMIT (Dakikada en fazla 10 istek) ===
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 dakika
  max: 10, // Dakikada 10 istek
  message: { error: "Çok fazla istek gönderildi. Lütfen 1 dakika sonra tekrar deneyin." }
});
app.use("/generate-questions", limiter);
app.use("/generate-keywords", limiter);

// === PARSER + STATIC ===
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// === SORU ÜRETME ===
app.post("/generate-questions", async (req, res) => {
  const { mycontent } = req.body;
  const langCode = franc(mycontent);
  const languageMap = {
    "eng": "İngilizce", "tur": "Türkçe", "spa": "İspanyolca", "fra": "Fransızca",
    "deu": "Almanca", "ita": "İtalyanca", "por": "Portekizce", "rus": "Rusça",
    "jpn": "Japonca", "kor": "Korece", "nld": "Flemenkçe", "pol": "Lehçe",
    "ara": "Arapça", "hin": "Hintçe", "ben": "Bengalce", "zho": "Çince",
    "vie": "Vietnamca", "tha": "Tayca", "ron": "Romence", "ukr": "Ukraynaca"
  };
  const questionLanguage = languageMap[langCode] || "ingilizce";

  const prompt = `
Metin ${questionLanguage} dilindedir. Bu dilde çoktan seçmeli 10 ile 20 arası soru üret.
Kurallar:
- Her soru *** ile başlasın.
- 4 şık /// ile başlasın.
- Cevap ~~Cevap: [cevap]
- Açıklama &&Açıklama: [açıklama]
- Sadece metin olarak döndür.
Metin:
${mycontent}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    const result = await model.generateContent(prompt);
    res.json({ questions: await result.response.text() });
  } catch (err) {
    console.error("Gemini hata:", err.message);
    res.status(500).json({ error: "Soru üretilemedi" });
  }
});

app.post("/generate-single-question", async (req, res) => {
  const { mycontent } = req.body;
  const langCode = franc(mycontent);
  const languageMap = {
    "eng": "İngilizce", "tur": "Türkçe", "spa": "İspanyolca", "fra": "Fransızca",
    "deu": "Almanca", "ita": "İtalyanca", "por": "Portekizce", "rus": "Rusça",
    "jpn": "Japonca", "kor": "Korece", "nld": "Flemenkçe", "pol": "Lehçe",
    "ara": "Arapça", "hin": "Hintçe", "ben": "Bengalce", "zho": "Çince",
    "vie": "Vietnamca", "tha": "Tayca", "ron": "Romence", "ukr": "Ukraynaca"
  };
  const questionLanguage = languageMap[langCode] || "ingilizce";

  const prompt = `
Metin ${questionLanguage} dilindedir. Bu dilde çoktan seçmeli 1 soru üret.
Kurallar:
- Her soru *** ile başlasın.
- 4 şık /// ile başlasın.
- Cevap ~~Cevap: [cevap]
- Açıklama &&Açıklama: [açıklama]
- Sadece metin olarak döndür.
Metin:
${mycontent}`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    const result = await model.generateContent(prompt);
    res.json({ questions: await result.response.text() });
  } catch (err) {
    console.error("Gemini hata:", err.message);
    res.status(500).json({ error: "Soru üretilemedi" });
  }
});


// === ANAHTAR KELİME ÜRETME ===
app.post("/generate-keywords", async (req, res) => {
  const { mycontent } = req.body;
  const langCode = franc(mycontent);
  const languageMap = {
    "eng": "English",
    "tur": "Turkish",
    "spa": "Spanish",
    "fra": "French",
    "deu": "German",
    "ita": "Italian",
    "por": "Portuguese",
    "rus": "Russian",
    "jpn": "Japanese",
    "kor": "Korean",
    "nld": "Dutch",
    "pol": "Polish",
    "ara": "Arabic",
    "hin": "Hindi",
    "ben": "Bengali",
    "zho": "Chinese",
    "vie": "Vietnamese",
    "tha": "Thai",
    "ron": "Romanian",
    "ukr": "Ukrainian"
  };
  const questionLanguage = languageMap[langCode] || "ingilizce";

  const prompt = `
  The text is in ${questionLanguage}.
  Instructions:
  1. Identify the topic of the text.
  2. Based on general knowledge, list 10 to 20 keywords from the text in ${questionLanguage}.
  3. Start each line with a dash (-).
  4. After the keyword, write a colon and explain its meaning in ${questionLanguage} with two or three sentences. 
  Avoid generic definitions — consider how the term is used in this passage.
  Example format:
  - Keyword: Explanation
  Text:
  """
  ${mycontent}
  """`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    res.json({ keywords: text });
  } catch (err) {
    console.error("Gemini Keyword hata:", err.message);
    res.status(500).json({ error: "Anahtar kelimeler üretilemedi" });
  }
});

app.post("/define-keyword", async (req, res) => {
  const { keyword, mycontent } = req.body;

  if (!keyword || keyword.length < 2) {
    return res.status(400).json({ error: "Anahtar kelime eksik veya çok kısa." });
  }

  const langCode = franc(mycontent || keyword);
  const languageMap = {
    "eng": "English", "tur": "Turkish", "spa": "Spanish", "fra": "French",
    "deu": "German", "ita": "Italian", "por": "Portuguese", "rus": "Russian",
    "jpn": "Japanese", "kor": "Korean", "nld": "Dutch", "pol": "Polish",
    "ara": "Arabic", "hin": "Hindi", "ben": "Bengali", "zho": "Chinese",
    "vie": "Vietnamese", "tha": "Thai", "ron": "Romanian", "ukr": "Ukrainian"
  };
  const detectedLang = languageMap[langCode] || "English";

  const prompt = mycontent
    ? `
You are given a text and a keyword. Explain the meaning of the keyword based on the context of the text in ${detectedLang}.
Avoid generic definitions — consider how the term is used in this passage.

Text:
"""
${mycontent}
"""

Keyword:
"${keyword}"

Explain it in 2–3 simple sentences in ${detectedLang}, clearly and in context.
`
    : `
Explain the term "${keyword}" in ${detectedLang} using 2–3 simple sentences.
Avoid list format, give a direct definition only.
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    const result = await model.generateContent(prompt);
    const explanation = await result.response.text();
    res.json({ explanation: explanation.trim(), lang: detectedLang });
  } catch (err) {
    console.error("Define Keyword Error:", err.message);
    res.status(500).json({ error: "Tanım alınamadı." });
  }
});

app.post("/generate-docx", (req, res) => {
  const { questions, title } = req.body;

  if (!questions || !Array.isArray(questions) || questions.length === 0) {
    return res.status(400).json({ error: "Soru listesi eksik veya boş." });
  }

  // Soruları numaralandırarak yeniden düzenle
  const withIndex = questions.map((q, i) => ({
    index: i + 1,
    question: q.question,
    a: q.a,
    b: q.b,
    c: q.c,
    d: q.d,
    answer: q.answer,
    explanation: q.explanation
  }));

  // Şablon dosyasını oku
  const content = fs.readFileSync(path.join(__dirname, "template.docx"), "binary");
  const zip = new PizZip(content);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
  });

  try {
    // Şablona başlık ve soruları ekle
    doc.render({ questions: withIndex, title: title || "Quiz" });
  } catch (error) {
    console.error("Docx şablon hatası:", error);
    return res.status(500).json({ error: "Belge oluşturulamadı." });
  }

  const buffer = doc.getZip().generate({ type: "nodebuffer" });

  // Dosya adı için güvenli bir format oluştur
  const safeFilename = (title || "quiz")
    .toLowerCase()
    .replace(/[^a-z0-9\-_\sçğıöşü]/gi, "")  // Türkçe karakterlere izin ver
    .replace(/\s+/g, "_")  // boşlukları _ ile değiştir
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "");  // aksanları temizle

  res.set({
    "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "Content-Disposition": `attachment; filename="${safeFilename}.docx"`
  });

  res.send(buffer);
});



pp.post("/generate-math-question", async (req, res) => {
  const { content } = req.body;

  // franc ile dili tespit et
  const langCode = franc(content);
  const languageMap = {
    "eng": "İngilizce",
    "tur": "Türkçe",
    "spa": "İspanyolca",
    "fra": "Fransızca",
    "deu": "Almanca",
    "ita": "İtalyanca",
    "por": "Portekizce",
    "rus": "Rusça",
    "jpn": "Japonca",
    "kor": "Korece",
    "nld": "Flemenkçe",
    "pol": "Lehçe",
    "ara": "Arapça",
    "hin": "Hintçe",
    "ben": "Bengalce",
    "zho": "Çince",
    "vie": "Vietnamca",
    "tha": "Tayca",
    "ron": "Romence",
    "ukr": "Ukraynaca"
  };
  const questionLanguage = languageMap[langCode] || "İngilizce";


const prompt = `
You are an educational content creator. Please generate a multiple-choice math question in ${questionLanguage} based on the topic below and optionally similar to the provided example.

### Task:
1. First, 5 multiple-choice questions in ${questionLanguage}.
2. Each question must start with ***.
3. Each choice should be listed on a new line starting with letters like: "/// A) ...". The options must be A), B), C), and D).
4. The answer line should be written as: ~~Answer: A [text]. For example: ~~Answer: C) 25
   - The answer must always start with ~~Answer:
   - The option and the text in the answer line must match exactly one of the above choices.
5. The explanation line must start with &&Explanation:. It should include at least 2 full sentences.
6. Use LaTeX formatting where needed, like \\( ... \\) or \\[ ... \\].
7. At the end of each question, add a %%Check: line. This should verify:
   - Is there an answer line?
   - Is the answer format correct?
   - Does the answer match one of the options?
   - Does the explanation support the answer?
---

### Extra Task:
- If there is an incorrect example or question, correct it before generating the others.
- If a question has a mistake, display it first with the label “$$$ Correction Note:”.
- If the mistake is in an option, correct both the option and the correct answer accordingly.
- Then show the corrected version and include it with the other valid questions.
- So the structure is: mistake → correction → all valid questions → with %%Check lines.

---

Topic:
${content}
`;



  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    res.json({ result: text });
  } catch (err) {
    console.error("MathJax soru üretme hatası:", err.message);
    res.status(500).json({ error: "MathJax soruları üretilemedi." });
  }
});








// === SPA (Tek Sayfa) Yönlendirme ===
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// === SUNUCU BAŞLAT ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
});
