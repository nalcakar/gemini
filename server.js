const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { franc } = require("franc");
const fs = require("fs");
require("dotenv").config();

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const app = express();

app.set("trust proxy", 1); // Bu satırı mutlaka ekle!
const fetch = require("node-fetch");

// ✅ CORS MIDDLEWARE — en üste yerleştirilmeli!
const allowedOrigins = ["https://doitwithai.org"];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("CORS hatası: izin verilmeyen origin"));
    }
  },
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
}));

// ✅ JSON parse işlemi
app.use(express.json());

// ✅ Patreon token'ı doğrulayan fonksiyon
async function verifyPatreonToken(token) {
  try {
    const response = await fetch("https://www.patreon.com/api/oauth2/v2/identity?fields[user]=email,full_name", {
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) return null;

    const data = await response.json();
    const user = data.data.attributes;
    return {
      email: user.email,
      name: user.full_name
    };
  } catch (err) {
    console.error("Patreon token doğrulama hatası:", err.message);
    return null;
  }
}

// ✅ /patreon-me endpoint’i — Token ile giriş yapan kullanıcıyı döner
app.post("/patreon-me", async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  if (!token) return res.status(400).json({ error: "Token eksik" });

  const userInfo = await verifyPatreonToken(token);
  if (!userInfo) return res.status(401).json({ error: "Geçersiz token" });

  res.json(userInfo); // Örnek çıktı: { email: "...", name: "..." }
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



app.post("/generate-math-question", async (req, res) => {
  const { content, language } = req.body;

  const langCode = franc(content); // fallback language detection
  const languageMap = {
    eng: "English", tur: "Turkish", spa: "Spanish", fra: "French",
    deu: "German", ita: "Italian", por: "Portuguese", rus: "Russian",
    jpn: "Japanese", kor: "Korean", nld: "Dutch", pol: "Polish",
    ara: "Arabic", hin: "Hindi", ben: "Bengali", zho: "Chinese",
    vie: "Vietnamese", tha: "Thai", ron: "Romanian", ukr: "Ukrainian"
  };

  let questionLanguage = "English";
  if (language && typeof language === "string") {
    questionLanguage = language;
  } else if (languageMap[langCode]) {
    questionLanguage = languageMap[langCode];
  }

  const prompt = `
You are an educational content creator. Please generate 15 multiple-choice questions in ${questionLanguage} related to the math topic below.

### Task:
1. Each question must be in ${questionLanguage}.
2. Each question must start with ***. Don't add 1. 2. listing before question.
3. Each choice should be listed on a new line starting with letters like: "/// A) ...". The options must be A), B), C), and D).
4. The answer line should be written as: ~~Answer: A [text]. For example: ~~Answer: C) 25
   - The answer must always start with ~~Answer:
   - The option and the text in the answer line must match exactly one of the above choices.
5. The explanation line must start with &&Explanation:. It should include at least 2 to 5 full sentences with opic explanation.
6. Use LaTeX formatting where needed, like \\( ... \\) or \\[ ... \\].
7. At the end of each question, add a %%Check: line. This should verify:
   - Ask the question to yourself again, check if the Answer is correct.
   - Is there an answer line?
   - Is the answer format correct?
   - Does the answer match one of the options?
   - Does the explanation support the answer?
  
Important Rules:
- The correct answer MUST match one of the choices exactly. If the correct answer is not listed among A) to D), regenerate the options.
- Avoid inconsistency between answer and choices. Check carefully.
- If %Check shows any errors, regenerate the question before returning.


Topic:
${content}
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    res.json({ result: text });
  } catch (err) {
    console.error("MathJax question generation error:", err.message);
    res.status(500).json({ error: "Failed to generate MathJax questions." });
  }
});

/////////////Sql////////





app.get("/oauth/callback", async (req, res) => {
  const code = req.query.code;

  if (!code) {
    return res.status(400).send("❌ Kod alınamadı.");
  }

  try {
    const response = await fetch("https://www.patreon.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: process.env.PATREON_CLIENT_ID,
        client_secret: process.env.PATREON_CLIENT_SECRET,
        redirect_uri: "https://doitwithai.org/oauth/callback"
      })
    });

    const tokenData = await response.json();

    if (!tokenData.access_token) {
      console.error("Token alınamadı:", tokenData);
      return res.status(500).send("❌ Access token alınamadı.");
    }

    const userRes = await fetch("https://www.patreon.com/api/oauth2/v2/identity?fields[user]=email,full_name", {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`
      }
    });

    const userData = await userRes.json();
    const email = userData.data.attributes.email;
    const name = userData.data.attributes.full_name;

    // Tarayıcıda token'ı kaydet ve yönlendir
    res.send(`
      <script>
        localStorage.setItem("accessToken", "${tokenData.access_token}");
        localStorage.setItem("userEmail", "${email}");
        localStorage.setItem("userName", "${name}");
        window.location.href = "/editor"; // Giriş sonrası sayfan
      </script>
    `);
  } catch (err) {
    console.error("OAuth callback hatası:", err);
    res.status(500).send("❌ Hata oluştu.");
  }
});


// === SPA (Tek Sayfa) Yönlendirme ===
app.get("*", (req, res, next) => {
  // Eğer istek bir API endpoint'iyse yönlendirme yapma
  if (req.path.startsWith("/generate") || req.path.startsWith("/define") || req.path.startsWith("/patreon")) {
    return next();
  }

  // Aksi halde index.html'e yönlendir
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === SUNUCU BAŞLAT ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
});
