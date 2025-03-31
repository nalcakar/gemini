const express = require("express");
const cors = require("cors");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { franc } = require("franc");
const fetch = require("node-fetch");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

app.post("/generate-questions", async (req, res) => {
  const { content } = req.body;
  const langCode = franc(content);
  
  // Basit dil eşleştirmesi:
  let questionLanguage = "Türkçe"; // varsayılan

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

if (languageMap[langCode]) {
  questionLanguage = languageMap[langCode];
}

  // Gerekirse diğer diller eklenebilir

  const prompt = ` 
  Metin ${questionLanguage} dilindedir. Lütfen bu dilde çoktan seçmeli sorular üret.
  
  Kurallar:
  - Her soru *** ile başlamalıı.
  - Her sorunun 4 şıkkı olmalı. Şıklar /// ile başlasın.
  - Her sorunun altında doğru cevabı belirt: "~~Cevap: [cevap metni]" şeklinde  olsun.
  - Ayrıca metne göre mutlaka bir açıklama ekle: "&&Açıklama: [açıklama metni] olsun."
  - En az 10 soru en fazla 20 soru olsun.
  - Sadece metin formatında yanıt ver. JSON veya kod bloğu istemiyorum.
  - Cevapları **tam metin olarak** döndür.
  
  Metin:
  ${content}
  `;
  

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    res.json({ questions: text });
  } catch (error) {
    console.error("Soru üretimi hatası:", error.message);
    res.status(500).json({ error: "Soru üretilemedi" });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sunucu ${PORT} portunda çalışıyor`);
});


// site çaplı çeviri

app.post("/translate-ui", async (req, res) => {
  const { targetLang, texts } = req.body;

  try {
    const results = await Promise.all(texts.map(async (text) => {
      const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${process.env.GOOGLE_TRANSLATE_API_KEY}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          q: text,
          target: targetLang,
          format: "text"
        })
      });

      const data = await response.json();
      return data.data.translations[0].translatedText;
    }));

    res.json({ translated: results });
  } catch (error) {
    console.error("Çeviri hatası:", error.message);
    res.status(500).json({ error: "Çeviri yapılamadı" });
  }
});
