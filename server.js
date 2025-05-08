const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  legacyMode: true,
});

redisClient.connect().catch(console.error);

// ✅ Prevent crash on Redis error
redisClient.on("error", (err) => {
  console.error("❌ Redis bağlantı hatası:", err.message);
});


redisClient.connect().catch(console.error);

const MAX_DAILY_LIMIT = 20;

async function visitorLimitMiddleware(req, res, next) {
  const token = req.headers.authorization || "";
  const isLoggedIn = token && token.startsWith("Bearer ");

  if (isLoggedIn) return next(); // logged-in users skip

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.connection.remoteAddress;
  const today = new Date().toISOString().split("T")[0];
  const redisKey = `visitor:${ip}:${today}`;

  try {
    const usage = parseInt(await redisClient.get(redisKey)) || 0;
    if (usage >= MAX_DAILY_LIMIT) {
      return res.status(429).json({ error: "🚫 Daily visitor limit reached. Please log in to continue." });
    }

    req.visitorKey = redisKey;
    req.visitorCount = usage;
    next();
  } catch (err) {
    console.error("Redis error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

async function incrementVisitorUsage(req, count = 1) {
  if (!req.user && req.visitorKey) {
    await redisClient.incrBy(req.visitorKey, count);
    await redisClient.expire(req.visitorKey, 86400); // 24 hours
  }
}


const pool = require("./pool");
const express = require("express");
const cors = require("cors");
const path = require("path");
const rateLimit = require("express-rate-limit");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const FormData = require("form-data");
const fs = require("fs");
const axios = require("axios");

const { franc } = require("franc");

require("dotenv").config();

const PizZip = require("pizzip");
const Docxtemplater = require("docxtemplater");
const app = express();

app.set("trust proxy", 1); // Bu satırı mutlaka ekle!
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fetch = require("node-fetch");

// ✅ CORS MIDDLEWARE — en üste yerleştirilmeli!
const allowedOrigins = ["https://doitwithai.org", "http://localhost:3001"];
const authMiddleware = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

  const accessToken = authHeader.split(" ")[1];
  if (!accessToken) return next();

  try {
    const response = await fetch("https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers&fields[user]=email,full_name", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    const data = await response.json();
    const email = data.data?.attributes?.email;
    const name = data.data?.attributes?.full_name;
    const tiers = data.included?.[0]?.relationships?.currently_entitled_tiers?.data || [];

    const TIER_MAP = {
      "25539224": "Bronze",
      "25296810": "Silver",
      "25669215": "Gold"
    };

    let tier = "free";
    for (const t of tiers) {
      if (TIER_MAP[t.id]) {
        tier = t.id;
        break;
      }
    }

    if (email) {
      req.user = { email, name, tier };
    }
  } catch (err) {
    console.error("❌ Kullanıcı doğrulama hatası:", err.message);
  }

  next();
};

app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) return next();

  const accessToken = authHeader.split(" ")[1];
  if (!accessToken) return next();

  try {
    const response = await fetch("https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers&fields[user]=email,full_name", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await response.json();

    const email = data.data?.attributes?.email;
    const name = data.data?.attributes?.full_name;

    const tiers = data.included?.[0]?.relationships?.currently_entitled_tiers?.data || [];

    // ID'lere göre eşleştirme
    const TIER_MAP = {
      "25539224": "Bronze",
      "25296810": "Silver",
      "25669215": "Gold"
    };

    let tier = "free"; // default

    for (const t of tiers) {
      if (TIER_MAP[t.id]) {
        tier = t.id; // numeric ID olarak kullanıyoruz
        break;
      }
    }

    if (email) {
      req.user = {
        email,
        name,
        tier // örnek: "25539224"
      };
    }
  } catch (err) {
    console.error("❌ Kullanıcı doğrulama hatası:", err.message);
  }

  next();
});

app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"]
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


app.post("/transcribe", upload.any(), async (req, res) => {
  try {
    const file = req.files?.[0];
    if (!file) return res.status(400).json({ error: "No file uploaded" });

    const ext = path.extname(file.originalname) || ".mp3";
    const renamedPath = file.path + ext;
    fs.renameSync(file.path, renamedPath);

    const form = new FormData();
    form.append("file", fs.createReadStream(renamedPath));
    form.append("model", "whisper-1");

    const response = await axios.post("https://api.openai.com/v1/audio/transcriptions", form, {
      headers: {
        ...form.getHeaders(),
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
    });

    fs.unlinkSync(renamedPath);
    res.json({ transcript: response.data.text });
  } catch (error) {
    console.error("❌ Whisper error:", error.response?.data || error.message);
    res.status(500).json({ error: "Transcription failed" });
  }
});



// === RATE LIMIT (Dakikada en fazla 10 istek) *****===
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
app.post("/generate-questions", visitorLimitMiddleware, async (req, res) => {
  const { mycontent, userLanguage, userFocus, difficulty } = req.body;
  const user = req.user || {};

  const tierQuestionCounts = {
    "25539224": 10,  // Bronze
    "25296810": 15,  // Silver
    "25669215": 20   // Gold
  };

  const userTier = user.tier;
  const questionCount = tierQuestionCounts[userTier] || 5;

  // Dil algılama
  const langCode = franc(mycontent);
  const languageMap = {
    "eng": "İngilizce", "tur": "Türkçe", "spa": "İspanyolca", "fra": "Fransızca",
    "deu": "Almanca", "ita": "İtalyanca", "por": "Portekizce", "rus": "Rusça",
    "jpn": "Japonca", "kor": "Korece", "nld": "Flemenkçe", "pol": "Lehçe",
    "ara": "Arapça", "hin": "Hintçe", "ben": "Bengalce", "zho": "Çince",
    "vie": "Vietnamca", "tha": "Tayca", "ron": "Romence", "ukr": "Ukraynaca"
  };

  const isoMap = {
    "İngilizce": "English",
    "Türkçe": "Turkish",
    "Arapça": "Arabic",
    "Fransızca": "French",
    "İspanyolca": "Spanish",
    "Almanca": "German",
    "İtalyanca": "Italian",
    "Portekizce": "Portuguese",
    "Rusça": "Russian",
    "Çince": "Chinese",
    "Japonca": "Japanese",
    "Korece": "Korean",
    "Flemenkçe": "Dutch",
    "Lehçe": "Polish",
    "Hintçe": "Hindi",
    "Bengalce": "Bengali",
    "Vietnamca": "Vietnamese",
    "Tayca": "Thai",
    "Romence": "Romanian",
    "Ukraynaca": "Ukrainian"
  };

  let questionLanguage = "İngilizce";
  if (userLanguage?.trim()) {
    questionLanguage = userLanguage.trim();
  } else if (languageMap[langCode]) {
    questionLanguage = languageMap[langCode];
  }

  const promptLanguage = isoMap[questionLanguage] || "English";
  const isShortTopic = mycontent.length < 80;

  // ✅ Temiz tekli prompt yapısı
  let prompt = "";

  if (isShortTopic) {
    prompt = `
You are an expert question generator.

Your task is to generate exactly ${questionCount} multiple-choice questions based on the topic: "${mycontent}".

${userFocus?.trim() ? `Focus specifically on: "${userFocus.trim()}".` : ""}
${difficulty?.trim() ? `Target difficulty level: ${difficulty.trim()}.` : ""}

All output must be written in ${promptLanguage}.

Format:
***[Question text]

/// A) Option 1
/// B) Option 2
/// C) Option 3
/// D) Option 4
~~Cevap: [Correct Option] 
&&Açıklama: [Short Explanation about why this answer is correct.]

Rules:
- Use exactly this structure, no extra numbering (no 1., 2., etc.)
- No additional comments outside the requested format.
- Each explanation must be at least 2 complete sentences.
- If the question involves math, format expressions using LaTeX ($...$).
`;
  } else {
    prompt = `
You are an expert quiz generator.

Based on the following content (in ${promptLanguage}), generate exactly ${questionCount} multiple-choice questions:

"${mycontent}"

Format:
***[Question text]

/// A) Option 1
/// B) Option 2
/// C) Option 3
/// D) Option 4
~~Cevap: [Correct Option] 
&&Açıklama: [Short Explanation about why this answer is correct.]

Rules:
- Use exactly the specified structure, no numbering.
- No additional notes or commentary outside.
- All content must be in ${promptLanguage}.
- Each explanation should be at least 2 full sentences.
- If math appears, format formulas properly using LaTeX ($...$).
`;
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    const estimatedCount = questionCount; // You may adjust if you have better logic

// ⏱️ Increment before calling AI
await incrementVisitorUsage(req, estimatedCount);
const result = await model.generateContent(prompt);
    const raw = await result.response.text();

    // Parse and map Gemini text to structured questions
    const blocks = raw.split("***").filter(Boolean);
    const parsed = blocks.map(block => {
      const lines = block.trim().split("\n").map(line => line.trim());
      const question = lines[0];
      const options = lines
        .filter(l => l.startsWith("///"))
        .map(l => l.replace(/^\/\/\/\s*[A-D]\)\s*/, "").trim());
    
      const optionMap = {};
      ["A", "B", "C", "D"].forEach((key, i) => {
        const rawLine = lines.find(l => l.startsWith(`/// ${key})`));
        if (rawLine) optionMap[key] = rawLine.replace(/^\/\/\/\s*[A-D]\)\s*/, "").trim();
      });
    
      let answerRaw = (lines.find(l => l.startsWith("~~Cevap:")) || "").replace(/^~~Cevap:\s*/, "").trim();
      let explanation = (lines.find(l => l.startsWith("&&Açıklama:")) || "").replace(/^&&Açıklama:\s*/, "").trim();
    
      // If answer is A/B/C/D, replace with actual text
      if (/^[A-D]$/.test(answerRaw)) {
        answerRaw = optionMap[answerRaw] || answerRaw;
      }
    
      return {
        question,
        options,
        answer: answerRaw,
        explanation
      };
    });
    
    res.json({ questions: parsed });
    
  } catch (err) {
    console.error("Gemini Error:", err.message);
    res.status(500).json({
      error: "Failed to generate questions",
      message: err.message
    });
  }
});


// === ANAHTAR KELİME ÜRETME ===
app.post("/generate-keywords", visitorLimitMiddleware, async (req, res) => {
  const { mycontent, userLanguage, difficulty } = req.body;
  const user = req.user || {};

  const tierKeywordCounts = {
    "25539224": 10,  // Bronze
    "25296810": 15,  // Silver
    "25669215": 20   // Gold
  };

  const userTier = user.tier;
  const keywordCount = tierKeywordCounts[userTier] || 5;

  // 🌐 Language detection and mapping
  const langCode = franc(mycontent || "");
  const languageMap = {
    "eng": "İngilizce", "tur": "Türkçe", "spa": "İspanyolca", "fra": "Fransızca",
    "deu": "Almanca", "ita": "İtalyanca", "por": "Portekizce", "rus": "Rusça",
    "jpn": "Japonca", "kor": "Korece", "nld": "Flemenkçe", "pol": "Lehçe",
    "ara": "Arapça", "hin": "Hintçe", "ben": "Bengalce", "zho": "Çince",
    "vie": "Vietnamca", "tha": "Tayca", "ron": "Romence", "ukr": "Ukraynaca"
  };

  const isoMap = {
    "İngilizce": "English",
    "Türkçe": "Turkish",
    "Arapça": "Arabic",
    "Fransızca": "French",
    "İspanyolca": "Spanish",
    "Almanca": "German",
    "İtalyanca": "Italian",
    "Portekizce": "Portuguese",
    "Rusça": "Russian",
    "Çince": "Chinese",
    "Japonca": "Japanese",
    "Korece": "Korean",
    "Flemenkçe": "Dutch",
    "Lehçe": "Polish",
    "Hintçe": "Hindi",
    "Bengalce": "Bengali",
    "Vietnamca": "Vietnamese",
    "Tayca": "Thai",
    "Romence": "Romanian",
    "Ukraynaca": "Ukrainian"
  };

  let questionLanguage = "İngilizce";
  if (userLanguage?.trim()) {
    questionLanguage = userLanguage.trim();
  } else if (languageMap[langCode]) {
    questionLanguage = languageMap[langCode];
  }

  const promptLanguage = isoMap[questionLanguage] || "English";

  
  const prompt = `
  You are an expert in content analysis and translation.
  
  Your task is to extract exactly ${keywordCount} important keywords from the following text.
  
  Instructions:
  - Translate the keywords and explanations into ${promptLanguage}.
  - List each keyword on a new line, starting with a dash (-).
  - After the translated keyword, write a colon and give a 2–3 sentence explanation about its meaning in the context of the passage.
  - Do not include the original (source language) keyword.
  - Avoid dictionary definitions — explain how the keyword is used in this specific text.
  
  Format:
  - [Translated Keyword]: [Explanation in ${promptLanguage}]
  
  Text:
  """
  ${mycontent}
  """`;
  

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    await incrementVisitorUsage(req, keywordCount);
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    res.json({ keywords: text });
  } catch (err) {
    console.error("Gemini Keyword hata:", err.message);
    res.status(500).json({ error: "Anahtar kelimeler üretilemedi" });
  }
});

app.post("/generate-keywords-topic", async (req, res) => {
  const { topic, focus, userLanguage, difficulty } = req.body;
  const user = req.user || {};

  // 🎯 Tier-based keyword count
  const tierKeywordCounts = {
    "25539224": 10,  // Bronze
    "25296810": 15,  // Silver
    "25669215": 20   // Gold
  };

  const userTier = user.tier;
  const keywordCount = tierKeywordCounts[userTier] || 8;

  // 🌐 Language detection and mapping
  const langCode = franc(topic || "");
  const languageMap = {
    "eng": "İngilizce", "tur": "Türkçe", "spa": "İspanyolca", "fra": "Fransızca",
    "deu": "Almanca", "ita": "İtalyanca", "por": "Portekizce", "rus": "Rusça",
    "jpn": "Japonca", "kor": "Korece", "nld": "Flemenkçe", "pol": "Lehçe",
    "ara": "Arapça", "hin": "Hintçe", "ben": "Bengalce", "zho": "Çince",
    "vie": "Vietnamca", "tha": "Tayca", "ron": "Romence", "ukr": "Ukraynaca"
  };

  const isoMap = {
    "İngilizce": "English",
    "Türkçe": "Turkish",
    "Arapça": "Arabic",
    "Fransızca": "French",
    "İspanyolca": "Spanish",
    "Almanca": "German",
    "İtalyanca": "Italian",
    "Portekizce": "Portuguese",
    "Rusça": "Russian",
    "Çince": "Chinese",
    "Japonca": "Japanese",
    "Korece": "Korean",
    "Flemenkçe": "Dutch",
    "Lehçe": "Polish",
    "Hintçe": "Hindi",
    "Bengalce": "Bengali",
    "Vietnamca": "Vietnamese",
    "Tayca": "Thai",
    "Romence": "Romanian",
    "Ukraynaca": "Ukrainian"
  };

  let questionLanguage = "İngilizce";
  if (userLanguage?.trim()) {
    questionLanguage = userLanguage.trim();
  } else if (languageMap[langCode]) {
    questionLanguage = languageMap[langCode];
  }

  const promptLanguage = isoMap[questionLanguage] || "English";

  // 🧠 Topic-based prompt
  const prompt = `
You are an expert educator.

Your task is to generate exactly ${keywordCount} essential and **educational** keywords related to the topic below.

Topic: "${topic}"
${focus ? `Focus: "${focus}"` : ""}

Instructions:
- Select keywords that are **important for understanding and teaching** this topic.
- Translate the keywords and explanations into ${promptLanguage}.
- Each keyword must be significant for learners to grasp the subject well.
- List each translated keyword on a new line, starting with a dash (-).
- After the keyword, add a colon and give a 2–3 sentence educational explanation that highlights why it is important in the context of the topic.
- Explain how the keyword contributes to comprehension or application.
- Don't include keyword in the explanation."1 
- Do not include the original (non-translated) keywords.

Format:
- [Translated Keyword]: [Explanation in ${promptLanguage}]
`;


  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    res.json({ keywords: text });
  } catch (err) {
    console.error("Gemini Keyword Topic hata:", err.message);
    res.status(500).json({ error: "Topic tabanlı anahtar kelimeler üretilemedi" });
  }
});





app.post("/suggest-topic-focus", async (req, res) => {
  const { topic, language } = req.body;

  if (!topic || topic.trim().length < 3) {
    return res.status(400).json({ error: "Konu çok kısa." });
  }

  // Dil kodu algıla
  const langCode = franc(topic);
  const languageMap = {
    "eng": "İngilizce", "tur": "Türkçe", "spa": "İspanyolca", "fra": "Fransızca",
    "deu": "Almanca", "ita": "İtalyanca", "por": "Portekizce", "rus": "Rusça",
    "jpn": "Japonca", "kor": "Korece", "nld": "Flemenkçe", "pol": "Lehçe",
    "ara": "Arapça", "hin": "Hintçe", "ben": "Bengalce", "zho": "Çince",
    "vie": "Vietnamca", "tha": "Tayca", "ron": "Romence", "ukr": "Ukraynaca"
  };

  const isoMap = {
    "İngilizce": "English", "Türkçe": "Turkish", "Arapça": "Arabic", "Fransızca": "French",
    "İspanyolca": "Spanish", "Almanca": "German", "İtalyanca": "Italian", "Portekizce": "Portuguese",
    "Rusça": "Russian", "Çince": "Chinese", "Japonca": "Japanese", "Korece": "Korean",
    "Flemenkçe": "Dutch", "Lehçe": "Polish", "Hintçe": "Hindi", "Bengalce": "Bengali",
    "Vietnamca": "Vietnamese", "Tayca": "Thai", "Romence": "Romanian", "Ukraynaca": "Ukrainian"
  };

  let questionLanguage = "Türkçe";
  if (language && language.trim()) {
    questionLanguage = language.trim();
  } else if (languageMap[langCode]) {
    questionLanguage = languageMap[langCode];
  }

  const prompt = `
"${topic}" başlıklı bir konu için, ${questionLanguage} dilinde soru üretmek istiyoruz.

Bu konuda odaklanılabilecek 12 kısa yön öner:
- Her biri en fazla 4 kelime olsun.
- ${questionLanguage} dilinde yaz.
- Liste formatı kullan: - ...
- Açıklama veya giriş yazma.

Sadece listeyi döndür.
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = await result.response.text();

    const suggestions = text
      .split("\n")
      .map(line => line.replace(/^-/, "").trim())
      .filter(line => line.length > 2);

    res.json({ suggestions });
  } catch (err) {
    console.error("🧠 Odak öneri hatası:", err.message);
    res.status(500).json({ error: "Odak önerileri üretilemedi." });
  }
});






app.post("/generate-docx", async (req, res) => {
  try {
    const { questions, title } = req.body;
    if (!questions || !Array.isArray(questions)) {
      return res.status(400).json({ error: "Invalid questions array." });
    }

    const content = fs.readFileSync(path.resolve(__dirname, "template.docx"), "binary");
    const zip = new PizZip(content);
    const doc = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true });

    const questionSection = [];
    const answerSection = [];

    questions.forEach((q, i) => {
      const index = i + 1;

      if (q.is_keyword === true) {
        questionSection.push(`${index}. ${q.question}\n______________________\n`);
        answerSection.push(`${index}. Correct Answer: ${q.answer || ""}\n`);
      } else {
        const a = q.a || "", b = q.b || "", c = q.c || "", d = q.d || "";
        questionSection.push(`${index}. ${q.question}\na) ${a}\nb) ${b}\nc) ${c}\nd) ${d}\n`);
        answerSection.push(`${index}. Correct Answer: ${q.answer || ""}\n🧠 Explanation: ${q.explanation || ""}\n`);
      }
    });

    doc.setData({
      title: title || "Untitled",
      questions_block: questionSection.join("\n"),
      answers_block: answerSection.join("\n")
    });

    try {
      doc.render();
    } catch (err) {
      console.error("❌ Docxtemplater render error:", err);
      return res.status(500).json({ error: "Template rendering error" });
    }

    const buf = doc.getZip().generate({ type: "nodebuffer" });

    res.setHeader("Content-Disposition", `attachment; filename=${title || "questions"}.docx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
    res.send(buf);
  } catch (err) {
    console.error("❌ DOCX generation error:", err);
    res.status(500).json({ error: "Server error" });
  }
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







app.get("/auth/patreon/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("❌ Kod alınamadı.");

  try {
    // 🎟️ 1. Token al
    const response = await fetch("https://www.patreon.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        grant_type: "authorization_code",
        client_id: process.env.PATREON_CLIENT_ID,
        client_secret: process.env.PATREON_CLIENT_SECRET,
        redirect_uri: "https://gemini-j8xd.onrender.com/auth/patreon/callback"
      })
    });

    const tokenData = await response.json();

    if (!tokenData.access_token) {
      console.error("❌ Token alınamadı:", tokenData);
      return res.status(500).send("❌ Access token alınamadı.");
    }

    const accessToken = tokenData.access_token;

    // 👤 2. Kullanıcı bilgilerini al
    const userRes = await fetch(
      "https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers&fields[user]=email,full_name",
      {
        headers: { Authorization: `Bearer ${accessToken}` }
      }
    );

    const userData = await userRes.json();

    if (!userData?.data?.attributes) {
      console.error("❌ Patreon kullanıcı verisi alınamadı:", userData);
      return res.status(500).send("❌ Kullanıcı bilgileri alınamadı.");
    }

    const email = userData.data.attributes.email;
    const name = userData.data.attributes.full_name;

   // 🏷️ 3. Üyelik tipi belirle
let membershipType = "Free"; // default giriş yapmayanlar için
const included = userData.included;

if (included && Array.isArray(included)) {
  const member = included.find(i => i.type === "member");
  const tiers = member?.relationships?.currently_entitled_tiers?.data || [];

  const tierIds = tiers.map(t => t.id);

  // 🎯 Patreon Tier ID eşleşmeleri (görselden aldığın ID’ler)
  const TIER_MAP = {
    "25539224": "Bronze",
    "25296810": "Silver",
    "25669215": "Gold"
  };

  for (const id of tierIds) {
    if (TIER_MAP[id]) {
      membershipType = TIER_MAP[id];
      break;
    }
  }

  console.log("🔍 Kullanıcının tier ID'leri:", tierIds);
  console.log("🎯 Belirlenen membershipType:", membershipType);
}

// 🔁 4. Frontend'e yönlendir
const originalRedirect = req.query.state || "https://doitwithai.org/AiQuestionMaker.html";

const redirectUrl = new URL(originalRedirect);
redirectUrl.searchParams.set("accessToken", accessToken);
redirectUrl.searchParams.set("userEmail", email);
redirectUrl.searchParams.set("userName", name);
redirectUrl.searchParams.set("membershipType", membershipType);

res.redirect(302, redirectUrl.toString());

  } catch (err) {
    console.error("OAuth callback hatası:", err);
    res.status(500).send("❌ Sunucu hatası: OAuth işleminde hata oluştu.");
  }
});




/////////////Sql////////
// === SAVE QUESTIONS ===
app.post("/save-questions", authMiddleware, async (req, res) => {
  const { titleName, categoryId, questions } = req.body;
  const email = req.user?.email;

  if (!titleName || !categoryId || !questions || !Array.isArray(questions)) {
    return res.status(400).json({ error: "Missing data" });
  }

  const client = await pool.connect();
  try {
    let titleId = null;

    // Check if title exists
    const titleCheck = await client.query(`
      SELECT id FROM titles WHERE name = $1 AND category_id = $2 AND user_email = $3
    `, [titleName, categoryId, email]);

    if (titleCheck.rows.length > 0) {
      titleId = titleCheck.rows[0].id;
    } else {
      const insertTitle = await client.query(`
        INSERT INTO titles (name, category_id, user_email)
        VALUES ($1, $2, $3)
        RETURNING id
      `, [titleName, categoryId, email]);
      titleId = insertTitle.rows[0].id;
    }

    for (const question of questions) {
      if (!question.question || typeof question.question !== "string" || question.question.trim() === "") {
        continue; // Skip if question text is missing
      }
      if (!question.options || !Array.isArray(question.options) || question.options.length === 0) {
        question.options = ["Placeholder Option"];
      }
      if (!question.answer || typeof question.answer !== "string") {
        question.answer = "Placeholder Answer";
      }
      if (!question.explanation || typeof question.explanation !== "string") {
        question.explanation = "";
      }
      if (!question.difficulty || !["easy", "medium", "hard"].includes(question.difficulty)) {
        question.difficulty = "medium";
      }

      await client.query(`
        INSERT INTO questions (title_id, question, options, answer, explanation, difficulty, user_email, source)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        titleId,
        question.question,
        JSON.stringify(question.options),
        question.answer,
        question.explanation,
        question.difficulty,
        email,
        question.source || null
      ]);
    }

    res.json({ success: true, titleId });
  } catch (err) {
    console.error("❌ Save questions error:", err.message);
    res.status(500).json({ error: "Failed to save questions." });
  } finally {
    client.release();
  }
});



// ✅ Update recent text (edit & save)
app.patch("/update-recent-text/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { extracted_text } = req.body;
  const email = req.user?.email;

  if (!id || !extracted_text || !email) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const result = await pool.query(`
      UPDATE recent_texts
      SET extracted_text = $1
      WHERE id = $2 AND user_email = $3
    `, [extracted_text, id, email]);

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Unauthorized or not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Update recent text error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Delete recent text
app.delete("/delete-recent-text/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const email = req.user?.email;

  if (!id || !email) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    const result = await pool.query(`
      DELETE FROM recent_texts
      WHERE id = $1 AND user_email = $2
    `, [id, email]);

    if (result.rowCount === 0) {
      return res.status(403).json({ error: "Unauthorized or not found" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete recent text error:", err.message);
    res.status(500).json({ error: "Server error" });
  }
});



app.post("/save-recent-text", authMiddleware, async (req, res) => {
  const { extracted_text, title_id, title_name } = req.body;
  const email = req.user?.email;

  if (!email || !extracted_text || !title_name) {
    return res.status(400).json({ error: "Missing parameters" });
  }

  try {
    await pool.query(`
      INSERT INTO recent_texts (user_email, title_name, title_id, extracted_text)
      VALUES ($1, $2, $3, $4)
    `, [email, title_name, title_id || null, extracted_text]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Save recent text error:", err.message);
    res.status(500).json({ error: "Database error" });
  }
});




app.get("/list-recent-texts", authMiddleware, async (req, res) => {
  const email = req.query.email;
  const titleId = req.query.title_id;

  if (!email || !titleId) {
    return res.status(400).json({ error: "Missing parameters." });
  }

  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT id, title_name, extracted_text, created_at
      FROM recent_texts
      WHERE user_email = $1 AND title_id = $2
      ORDER BY created_at DESC
    `, [email, titleId]);

    res.json({ recent_texts: result.rows });
  } catch (err) {
    console.error("❌ Recent texts fetch error:", err.message);
    res.status(500).json({ error: "Database error" });
  } finally {
    client.release();
  }
});




app.get("/list-main-topics", authMiddleware, async (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const client = await pool.connect();
  try {
    // 🟨 If user has no main_topic, add "Default" once
    const existing = await client.query("SELECT id FROM main_topics WHERE user_email = $1 LIMIT 1", [email]);
    if (existing.rowCount === 0) {
      const insertMain = await client.query(`
        INSERT INTO main_topics (name, user_email, is_default)
        VALUES ('Default', $1, true)
        RETURNING id
      `, [email]);
    
      const main_id = insertMain.rows[0].id;
    
      await client.query(`
        INSERT INTO categories (name, main_topic_id, user_email, is_default)
        VALUES ('Default', $1, $2, true)
      `, [main_id, email]);
    }

    const result = await client.query(
      `SELECT id, name FROM main_topics WHERE user_email = $1 ORDER BY name ASC`,
      [email]
    );
    res.json({ topics: result.rows });
  } finally {
    client.release();
  }
});






app.get("/list-categories", authMiddleware, async (req, res) => {
  const email = req.user?.email;
  const mainTopicId = req.query.main_topic_id;
  if (!email || !mainTopicId) return res.status(400).json({ error: "Missing data" });

  const client = await pool.connect();
  try {
    // 🟨 Only insert "Default" category if none exists and main topic is default
    const existing = await client.query(`
      SELECT id FROM categories 
      WHERE main_topic_id = $1 AND user_email = $2 
      LIMIT 1
    `, [mainTopicId, email]);

    const mainInfo = await client.query("SELECT is_default FROM main_topics WHERE id = $1", [mainTopicId]);
    const isDefaultMain = mainInfo.rows[0]?.is_default;
    
    if (existing.rowCount === 0 && isDefaultMain) {
      await client.query(`
        INSERT INTO categories (name, main_topic_id, user_email, is_default)
        VALUES ('Default', $1, $2, true)
      `, [mainTopicId, email]);
    }

    const result = await client.query(
      `SELECT id, name FROM categories 
       WHERE main_topic_id = $1 AND user_email = $2 
       ORDER BY name ASC`,
      [mainTopicId, email]
    );
    res.json({ categories: result.rows });
  } catch (err) {
    console.error("list-categories error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});







app.get("/list-titles", authMiddleware, async (req, res) => {
  const email = req.user?.email || req.query.email;
  const categoryId = req.query.category_id;
  if (!email || !categoryId) return res.status(400).json({ error: "Missing data" });

  const client = await pool.connect();
  try {
    const result = await client.query(
      `SELECT id, name FROM titles 
       WHERE category_id = $1 AND user_email = $2 
       ORDER BY name ASC`,
      [categoryId, email]
    );
    res.json({ titles: result.rows });
  } catch (err) {
    console.error("list-titles error:", err);
    res.status(500).json({ error: "Server error" });
  } finally {
    client.release();
  }
});

app.get("/get-questions", async (req, res) => {
  const titleId = req.query.title_id;
  const email = req.user?.email;

  if (!titleId || !email) {
    return res.status(400).json({ error: "Missing title_id or user not logged in." });
  }

  try {
    const result = await pool.query(  // ✅ Use pool here!
      `SELECT id, question, options, answer, explanation, difficulty, source
       FROM questions
       WHERE title_id = $1 AND user_email = $2
       ORDER BY id ASC`,
      [titleId, email]
    );

    res.json({ questions: result.rows });
  } catch (err) {
    console.error("Error in /get-questions:", err);
    res.status(500).json({ error: "Server error" });
  }
});





app.delete("/delete-question/:id", async (req, res) => {
  const { id } = req.params;
  const email = req.query.email;

  if (!email) return res.status(400).json({ success: false, message: "Email eksik" });

  try {
    const result = await pool.query("DELETE FROM questions WHERE id = $1 AND user_email = $2", [id, email]);
    if (result.rowCount === 0) {
      return res.status(403).json({ success: false, message: "Bu soruyu silme yetkiniz yok" });
    }
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Silme hatası:", err.message);
    res.status(500).json({ success: false });
  }
});
app.delete("/delete-questions-by-title/:id", async (req, res) => {
  const { id } = req.params;
  const email = req.query.email;

  try {
    await pool.query("DELETE FROM questions WHERE title_id = $1 AND user_email = $2", [id, email]);
    res.json({ success: true });
  } catch (err) {
    console.error("Silme hatası:", err.message);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});
app.put("/move-title", async (req, res) => {
  const { id, newCategoryId, email } = req.body;
  try {
    await pool.query("UPDATE titles SET category_id = $1 WHERE id = $2 AND user_email = $3", [newCategoryId, id, email]);
    res.json({ success: true });
  } catch (err) {
    console.error("Title taşıma hatası:", err.message);
    res.status(500).json({ success: false });
  }
});
app.put("/move-category", async (req, res) => {
  const { id, newMainId, email } = req.body;
  try {
    await pool.query("UPDATE categories SET main_topic_id = $1 WHERE id = $2 AND user_email = $3", [newMainId, id, email]);
    res.json({ success: true });
  } catch (err) {
    console.error("Kategori taşıma hatası:", err.message);
    res.status(500).json({ success: false });
  }
});


app.patch("/update-question/:id", async (req, res) => {
  const { id } = req.params;
  const { question, options, answer, explanation, difficulty } = req.body;

  if (!question || !options || !Array.isArray(options)) {
    return res.status(400).json({ error: "Eksik veya geçersiz veri" });
  }

  try {
    await pool.query(`
      UPDATE questions
      SET question = $1,
          options = $2,
          answer = $3,
          explanation = $4,
          difficulty = $5
      WHERE id = $6
    `, [
      question,
      JSON.stringify(options), // 👈 Buraya dikkat
      answer,
      explanation,
      difficulty || null,
      id
    ]);
    

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Soru güncelleme hatası:", err);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});



app.post("/add-main-category", async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) return res.status(400).json({ success: false, message: "Eksik bilgi" });

  try {
    await pool.query(
      "INSERT INTO main_topics (name, user_email) VALUES ($1, $2) ON CONFLICT(name, user_email) DO NOTHING",
      [name, email]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Ana başlık ekleme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


// Ana başlık adı güncelleme
app.put("/update-main-category", async (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).json({ success: false });

  try {
    await pool.query("UPDATE main_topics SET name = $1 WHERE id = $2", [name, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Main başlık güncellenemedi:", err);
    res.status(500).json({ success: false });
  }
});
// ✅ Kategori ekle
app.post("/add-category", async (req, res) => {
  const { name, main_id, email } = req.body;
  if (!name || !main_id || !email) return res.status(400).json({ success: false, message: "Eksik bilgi" });

  try {
    await pool.query(
      "INSERT INTO categories (name, main_topic_id, user_email) VALUES ($1, $2, $3)",
      [name, main_id, email]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Kategori ekleme hatası:", err);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});


// Kategori adı güncelleme
app.put("/update-category", async (req, res) => {
  const { id, name } = req.body;
  if (!id || !name) return res.status(400).json({ success: false });

  try {
    await pool.query("UPDATE categories SET name = $1 WHERE id = $2", [name, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Kategori güncellenemedi:", err);
    res.status(500).json({ success: false });
  }
});
app.put("/move-title", async (req, res) => {
  const { titleId, newCategoryId } = req.body;
  if (!titleId || !newCategoryId) return res.status(400).json({ success: false });

  try {
    await pool.query("UPDATE titles SET category_id = $1 WHERE id = $2", [newCategoryId, titleId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Başlık taşınamadı:", err);
    res.status(500).json({ success: false });
  }
});


// Bu kod bloğu server.js'e eklenmelidir. (Zaten son versiyona eklendiyse atlanabilir)

// === Başlık silme (eğer altında soru yoksa)
// Bu kod bloğu server.js'e eklenmelidir. (Zaten son versiyona eklendiyse atlanabilir)

// === Başlık silme (eğer altında soru yoksa)
app.delete("/delete-title/:id", async (req, res) => {
  const { id } = req.params;
  const email = req.query.email;
  if (!id || !email) return res.status(400).json({ success: false });

  try {
    const questionCheck = await pool.query(
      "SELECT 1 FROM questions WHERE title_id = $1 LIMIT 1",
      [id]
    );
    if (questionCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Bu başlığa ait sorular var." });
    }

    const result = await pool.query("DELETE FROM titles WHERE id = $1 AND user_email = $2", [id, email]);
    res.json({ success: result.rowCount > 0 });
  } catch (err) {
    console.error("Başlık silme hatası:", err);
    res.status(500).json({ success: false });
  }
});

// === Kategori silme (eğer altında başlık yoksa)
app.delete("/delete-category/:id", async (req, res) => {
  const { id } = req.params;
  const email = req.query.email;
  if (!id || !email) return res.status(400).json({ success: false });

  try {
    const titleCheck = await pool.query(
      "SELECT 1 FROM titles WHERE category_id = $1 LIMIT 1",
      [id]
    );
    const catInfo = await pool.query("SELECT is_default FROM categories WHERE id = $1", [id]);
  if (catInfo.rows[0]?.is_default) {
    return res.status(403).json({ success: false, message: "Varsayılan kategori silinemez." });
  }
    if (titleCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Bu kategoriye ait başlıklar var." });
    }

    const result = await pool.query("DELETE FROM categories WHERE id = $1 AND user_email = $2", [id, email]);
    res.json({ success: result.rowCount > 0 });
  } catch (err) {
    console.error("Kategori silme hatası:", err);
    res.status(500).json({ success: false });
  }
});

// === Ana başlık silme (eğer altında kategori yoksa)
app.delete("/delete-main-category/:id", authMiddleware, async (req, res) => {
  const { id } = req.params;
  const email = req.user?.email;
  if (!id || !email) return res.status(400).json({ success: false });

  try {
    const categoryCheck = await pool.query(
      "SELECT 1 FROM categories WHERE main_topic_id = $1 LIMIT 1",
      [id]
    );

    const mainInfo = await pool.query("SELECT is_default FROM main_topics WHERE id = $1", [id]);
    if (mainInfo.rows[0]?.is_default) {
      return res.status(403).json({ success: false, message: "Varsayılan ana başlık silinemez." });
    }

    if (categoryCheck.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Bu ana başlığa ait kategoriler var." });
    }

    const result = await pool.query("DELETE FROM main_topics WHERE id = $1 AND user_email = $2", [id, email]);
    res.json({ success: result.rowCount > 0 });
  } catch (err) {
    console.error("Ana başlık silme hatası:", err);
    res.status(500).json({ success: false });
  }
});


// === Başlık adını güncelle
app.put("/update-title-name", async (req, res) => {
  const { id, newName, email } = req.body;
  if (!id || !newName || !email) return res.status(400).json({ success: false });

  try {
    await pool.query(
      "UPDATE titles SET name = $1 WHERE id = $2 AND user_email = $3",
      [newName, id, email]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Başlık güncelleme hatası:", err.message);
    res.status(500).json({ success: false });
  }
});

// === Kategori adını güncelle
app.put("/update-category-name", async (req, res) => {
  const { id, newName, email } = req.body;
  if (!id || !newName || !email) return res.status(400).json({ success: false });

  try {
    await pool.query(
      "UPDATE categories SET name = $1 WHERE id = $2 AND user_email = $3",
      [newName, id, email]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Kategori güncelleme hatası:", err.message);
    res.status(500).json({ success: false });
  }
});
app.put("/move-title-to-category", async (req, res) => {
  const { titleId, newCategoryId, email } = req.body;
  try {
    await pool.query("UPDATE titles SET category_id = $1 WHERE id = $2 AND user_email = $3", [newCategoryId, titleId, email]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});


// === Ana başlık adını güncelle
app.put("/update-main-topic-name", async (req, res) => {
  const { id, newName, email } = req.body;
  if (!id || !newName || !email) return res.status(400).json({ success: false });

  try {
    await pool.query(
      "UPDATE main_topics SET name = $1 WHERE id = $2 AND user_email = $3",
      [newName, id, email]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Ana başlık güncelleme hatası:", err.message);
    res.status(500).json({ success: false });
  }
});
app.get("/list-all-titles", async (req, res) => {
  const { email, order_by = "created_at", sort = "desc" } = req.query;

  if (!email) return res.status(400).json({ success: false, message: "Email gereklidir." });

  const orderField = ["name", "created_at"].includes(order_by) ? order_by : "created_at";
  const sortDirection = sort.toLowerCase() === "asc" ? "ASC" : "DESC";

  try {
    const result = await pool.query(`
      SELECT titles.*, categories.name AS category_name, main_topics.name AS main_name
      FROM titles
      JOIN categories ON titles.category_id = categories.id
      JOIN main_topics ON categories.main_topic_id = main_topics.id
      WHERE titles.user_email = $1
      ORDER BY ${orderField} ${sortDirection}
    `, [email]);

    res.json({ success: true, titles: result.rows });
  } catch (err) {
    console.error("Başlıkları listelerken hata:", err.message);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});



app.get("/get-questions-by-name", authMiddleware, async (req, res) => {
  const { title, email } = req.query;
  if (!title || !email) return res.status(400).json({ error: "Eksik parametre" });

  const result = await pool.query(`
    SELECT q.* FROM questions q
    JOIN titles t ON q.title_id = t.id
    WHERE t.name = $1 AND t.user_email = $2
    ORDER BY q.created_at DESC
  `, [title, email]);

  res.json({ questions: result.rows });
});

// ✅ Ana başlık hakkında bilgi döner (özellikle is_default kontrolü için)
app.get("/get-main-topic-info/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ error: "Ana başlık ID'si eksik." });

  try {
    const result = await pool.query("SELECT is_default FROM main_topics WHERE id = $1", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Ana başlık bulunamadı." });
    }

    res.json({ is_default: result.rows[0].is_default });
  } catch (err) {
    console.error("Ana başlık bilgi hatası:", err.message);
    res.status(500).json({ error: "Sunucu hatası" });
  }
});

// ✅ Get latest 10 recent texts for the 'Recent Texts' tab
app.get("/list-latest-recent-texts", authMiddleware, async (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  try {
    const result = await pool.query(`
      SELECT id, title_id, title_name, extracted_text, created_at
      FROM recent_texts
      WHERE user_email = $1
      ORDER BY created_at DESC
      LIMIT 10
    `, [email]);

    res.json({ recent_texts: result.rows });
  } catch (err) {
    console.error("❌ list-latest-recent-texts error:", err.message);
    res.status(500).json({ error: "Server error" });
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
app.post("/rename-category", async (req, res) => {
  const { category_id, new_name, email } = req.body;
  if (!category_id || !new_name || !email) {
    return res.status(400).json({ success: false, message: "Eksik bilgi" });
  }

  try {
    const result = await pool.query(
      "UPDATE categories SET name = $1 WHERE id = $2 AND user_email = $3",
      [new_name, category_id, email]
    );

    res.json({ success: result.rowCount > 0 });
  } catch (err) {
    console.error("Kategori yeniden adlandırma hatası:", err);
    res.status(500).json({ success: false });
  }
});
app.post("/rename-main-topic", async (req, res) => {
  const { main_topic_id, new_name, email } = req.body;
  if (!main_topic_id || !new_name || !email) {
    return res.status(400).json({ success: false, message: "Eksik veri" });
  }

  try {
    const result = await pool.query(
      "UPDATE main_topics SET name = $1 WHERE id = $2 AND user_email = $3",
      [new_name, main_topic_id, email]
    );

    res.json({ success: result.rowCount > 0 });
  } catch (err) {
    console.error("Main topic rename error:", err);
    res.status(500).json({ success: false });
  }
});

// === SUNUCU BAŞLAT ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
});
