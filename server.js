const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { franc } = require("franc");
require("dotenv").config();

const app = express();
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
  4. After the keyword, write a colon and explain its meaning in ${questionLanguage} with two  or three sentences.
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

// === SPA (Tek Sayfa) Yönlendirme ===
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// === SUNUCU BAŞLAT ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
});
