// CLEANED VERSION OF SERVER.JS (NO PATREON, LOCALSTORAGE, OR SQL)

const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { franc } = require("franc");
require("dotenv").config();

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// === MIDDLEWARE ===
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// === GEMINI SORU ÜRETME ===
app.post("/generate-questions", async (req, res) => {
  const { content } = req.body;
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
  const questionLanguage = languageMap[langCode] || "Türkçe";

  const prompt = `
Metin ${questionLanguage} dilindedir. Bu dilde çoktan seçmeli 10 ile 20 arası soru üret.
Kurallar:
- Her soru *** ile başlasın.
- 4 şık /// ile başlasın.
- Cevap ~~Cevap: [cevap]
- Açıklama &&Açıklama: [açıklama]
- Sadece metin olarak döndür.
Metin:
${content}`;

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
  const { content } = req.body;
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
  const questionLanguage = languageMap[langCode] || "Türkçe";

  const prompt = `
Metin ${questionLanguage} dilindedir.
Talimatlar:
1. Metindeki konuyu belirle.
2. Bu konu hakkındaki genel bilgiye göre metindeki ${questionLanguage} dilindeki en az 10 ve en fazla 20 anahtar kelimeleri bul.
3. Her kelimeyi madde işareti (-) ile başlat.
4. Kelimeden sonra ":" koy ve o kelimenin anlamını açıkla.
Örnek Yapı:
- Kelime: Açıklama
Metin:
"""
${content}
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

// === SPA Routing ===
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// === SUNUCU BAŞLAT ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
});
