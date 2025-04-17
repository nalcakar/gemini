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
const allowedOrigins = ["https://doitwithai.org"];
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
  origin: "https://doitwithai.org",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
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
app.post("/generate-questions", async (req, res) => {
  const { mycontent } = req.body;
  const user = req.user || {};

  const tierQuestionCounts = {
    "25539224": 10,  // Bronze
    "25296810": 15,  // Silver
    "25669215": 20   // Gold
  };

  const userTier = user.tier;
  const questionCount = tierQuestionCounts[userTier] || 5; // Giriş yapmayan: 5

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
Metin ${questionLanguage} dilindedir. Bu dilde çoktan seçmeli tam ${questionCount} soru üret.
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
const redirectUrl = new URL("https://doitwithai.org/AiQuestionMaker.html");
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
app.post("/save-questions", authMiddleware, async (req, res) => {
  const { categoryId, titleName, questions } = req.body;
  const email = req.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const titleRes = await client.query(`
      INSERT INTO titles (name, category_id, user_email)
      VALUES ($1, $2, $3)
      ON CONFLICT (name, category_id, user_email) DO NOTHING
      RETURNING id
    `, [titleName, categoryId, email]);

    const titleId = titleRes.rows[0]?.id || (
      await client.query(`SELECT id FROM titles WHERE name = $1 AND category_id = $2 AND user_email = $3`,
        [titleName, categoryId, email])
    ).rows[0]?.id;

    for (const q of questions) {
      await client.query(`
        INSERT INTO questions (title_id, question, options, answer, explanation, user_email)
        VALUES ($1, $2, $3, $4, $5, $6)
      `, [titleId, q.question, JSON.stringify(q.options), q.answer, q.explanation, email]);
    }

    await client.query("COMMIT");
    res.json({ success: true });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Kaydetme hatası:", err);
    res.status(500).json({ error: "Soru kaydedilemedi" });
  } finally {
    client.release();
  }
});


app.get("/list-main-topics", authMiddleware, async (req, res) => {
  const email = req.user?.email;
  if (!email) return res.status(401).json({ error: "Unauthorized" });

  const client = await pool.connect();
  try {
    await client.query(`
      INSERT INTO main_topics (name, user_email)
      VALUES ('Genel', $1)
      ON CONFLICT DO NOTHING
    `, [email]);

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
    await client.query(`
      INSERT INTO categories (name, main_topic_id, user_email)
      VALUES ('Genel', $1, $2)
      ON CONFLICT DO NOTHING
    `, [mainTopicId, email]);

    const result = await client.query(
      `SELECT id, name FROM categories WHERE main_topic_id = $1 AND user_email = $2 ORDER BY name ASC`,
      [mainTopicId, email]
    );
    res.json({ categories: result.rows });
  } finally {
    client.release();
  }
});





app.get("/list-titles", authMiddleware, async (req, res) => {
  const email = req.user?.email;
  const categoryId = req.query.category_id;
  if (!email || !categoryId) return res.status(400).json({ error: "Missing data" });

  const result = await pool.query(
    `SELECT id, name FROM titles WHERE category_id = $1 AND user_email = $2 ORDER BY created_at DESC LIMIT 50`,
    [categoryId, email]
  );
  res.json({ titles: result.rows });
});

app.get("/get-questions", async (req, res) => {
  const { title_id, email } = req.query;
  if (!title_id || !email) return res.status(400).json({ success: false, message: "Eksik veri" });

  try {
    const result = await pool.query(`
      SELECT id, question, options, answer, explanation 
      FROM questions 
      WHERE title_id = $1 AND user_email = $2
      ORDER BY id DESC
    `, [title_id, email]);

    res.json({ questions: result.rows });
  } catch (err) {
    console.error("❌ Soru getirme hatası:", err.message);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
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


app.put("/update-question", async (req, res) => {
  const { id, question, options, answer, explanation, email } = req.body;

  if (!id || !email) return res.status(400).json({ success: false, message: "Eksik ID veya email" });

  try {
    const result = await pool.query(`
      UPDATE questions 
      SET question = $1, options = $2, answer = $3, explanation = $4 
      WHERE id = $5 AND user_email = $6
    `, [question, JSON.stringify(options), answer, explanation, id, email]);

    if (result.rowCount === 0) {
      return res.status(403).json({ success: false, message: "Bu soruyu güncelleme yetkiniz yok" });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Güncelleme hatası:", err.message);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
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
app.delete("/delete-main-category/:id", async (req, res) => {
  const { id } = req.params;
  const email = req.query.email;
  if (!id || !email) return res.status(400).json({ success: false });

  try {
    const categoryCheck = await pool.query(
      "SELECT 1 FROM categories WHERE main_topic_id = $1 LIMIT 1",
      [id]
    );
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

app.post("/save-flashcards", async (req, res) => {
  const { title, title_id, keywords, userEmail, promptText } = req.body;

  if ((!title_id && !title) || !keywords || !userEmail) {
    return res.status(400).json({ success: false, message: "Eksik bilgi" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let resolvedTitleId = title_id;

    if (!resolvedTitleId) {
      // 1. Başlık kontrolü
      const titleSelect = await client.query(
        "SELECT id FROM titles WHERE name = $1 AND user_email = $2 LIMIT 1",
        [title, userEmail]
      );
      resolvedTitleId = titleSelect.rows[0]?.id;

      // 2. Başlık yoksa oluştur
      if (!resolvedTitleId) {
        // a) Ana başlık
        const mainRes = await client.query(`
          INSERT INTO main_topics(name, user_email)
          VALUES ('AI', $1)
          ON CONFLICT(name, user_email) DO NOTHING
          RETURNING id
        `, [userEmail]);
        const main_topic_id = mainRes.rows[0]?.id || (
          await client.query("SELECT id FROM main_topics WHERE name = 'AI' AND user_email = $1", [userEmail])
        ).rows[0]?.id;

        // b) Kategori
        const catRes = await client.query(`
          INSERT INTO categories(name, main_topic_id, user_email)
          VALUES ('Flashcards', $1, $2)
          ON CONFLICT(name, main_topic_id, user_email) DO NOTHING
          RETURNING id
        `, [main_topic_id, userEmail]);
        const category_id = catRes.rows[0]?.id || (
          await client.query("SELECT id FROM categories WHERE name = 'Flashcards' AND main_topic_id = $1 AND user_email = $2", [main_topic_id, userEmail])
        ).rows[0]?.id;

        // c) Başlık oluştur
        const titleInsert = await client.query(`
          INSERT INTO titles(name, category_id, user_email, prompt_text)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT(name, category_id, user_email) DO NOTHING
          RETURNING id
        `, [title, category_id, userEmail, promptText || null]);
        resolvedTitleId = titleInsert.rows[0]?.id || (
          await client.query("SELECT id FROM titles WHERE name = $1 AND category_id = $2 AND user_email = $3", [title, category_id, userEmail])
        ).rows[0]?.id;
      }
    }

    // 3. Soruları kaydet
    let insertCount = 0;
    for (const kw of keywords) {
      const q = kw.keyword || kw.question;
      const a = kw.explanation || kw.answer;

      if (!q || !a) continue;

      await client.query(
        "INSERT INTO questions(title_id, question, options, answer, user_email) VALUES ($1, $2, $3, $4, $5)",
        [resolvedTitleId, q, JSON.stringify([]), a, userEmail]
      );

      insertCount++;
    }

    await client.query("COMMIT");
    res.json({ success: true, inserted: insertCount });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Flashcard kayıt hatası:", err.message);
    res.status(500).json({ success: false, message: "Sunucu hatası: " + err.message });
  } finally {
    client.release();
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
