const express = require("express");
const cors = require("cors");
const path = require("path");
const session = require("express-session");
const passport = require("passport");
const OAuth2Strategy = require("passport-oauth2");
const { GoogleGenerativeAI } = require("@google/generative-ai");
const { franc } = require("franc");
const fetch = require("node-fetch");
require("dotenv").config();
const pool = require("./pool"); // PostgreSQL bağlantısı
const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// === MIDDLEWARE ===
app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

app.use(session({
  secret: process.env.SESSION_SECRET || 'patreon_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // HTTPS ortamda true
    sameSite: "lax" // HTTPS ortamda "none"
  }
}));

// === PASSPORT AYARI ===
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use("patreon", new OAuth2Strategy({
  authorizationURL: "https://www.patreon.com/oauth2/authorize",
  tokenURL: "https://www.patreon.com/api/oauth2/token",
  clientID: process.env.PATREON_CLIENT_ID,
  clientSecret: process.env.PATREON_CLIENT_SECRET,
  callbackURL: process.env.PATREON_REDIRECT_URI
},
async (accessToken, refreshToken, profile, done) => {
  try {
    const res = await fetch("https://www.patreon.com/api/oauth2/v2/identity?include=memberships.currently_entitled_tiers&fields[user]=full_name,email&fields[tier]=title", {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    const data = await res.json();

    const tier = data.included?.find(item => item.type === "tier")?.attributes?.title?.trim() || "Ziyaretçi";

    const user = {
      name: data.data.attributes.full_name,
      email: data.data.attributes.email,
      patreon_id: data.data.id,
      tier
    };
    return done(null, user);
  } catch (err) {
    console.error("Patreon API error:", err);
    return done(err, null);
  }
}));

app.use(passport.initialize());
app.use(passport.session());

// === ROUTES ===
app.get("/auth/patreon", passport.authenticate("patreon"));
app.get("/auth/patreon/callback",
  passport.authenticate("patreon", {
    failureRedirect: "/?error=giris",
    successRedirect: "/"
  })
);

app.get("/logout", (req, res) => {
  req.logout(() => {
    req.session.destroy(() => {
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });
});

app.get("/me", (req, res) => {
  res.json({
    user: req.session?.passport?.user || null,
    usage: {
      freeCount: req.session.freeCount || 0,
      anonCount: req.session.anonCount || 0
    }
  });
});

// === GEMINI SORU ÜRETME ===
app.post("/generate-questions", (req, res, next) => {
  const user = req.session?.passport?.user;
  const today = new Date().toISOString().split("T")[0];
  let minCount = 5, maxCount = 5;

  if (!user) {
    req.session.anonDate !== today && (req.session.anonCount = 0, req.session.anonDate = today);
    req.session.anonCount = (req.session.anonCount || 0) + 1;
    if (req.session.anonCount > 5)
      return res.status(403).json({ error: "Giriş yapmadan günlük en fazla 5 üretim yapabilirsiniz." });
  } else {
    const tier = (user.tier || "").toLowerCase();
    if (tier.includes("pro")) [minCount, maxCount] = [15, 20];
    else if (tier.includes("üyelik")) {
      [minCount, maxCount] = [10, 10];
      req.session.freeDate !== today && (req.session.freeCount = 0, req.session.freeDate = today);
      req.session.freeCount = (req.session.freeCount || 0) + 1;
      if (req.session.freeCount > 5)
        return res.status(403).json({ error: "Üyelik seviyesinde günlük en fazla 5 üretim yapabilirsiniz." });
    }
  }

  req.soruAyari = { minCount, maxCount };
  next();
}, async (req, res) => {
  const { content } = req.body;
  const { minCount, maxCount } = req.soruAyari;
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
Metin ${questionLanguage} dilindedir. Bu dilde çoktan seçmeli sorular üret.

Kurallar:
- Her soru *** ile başlasın.
- 4 şık /// ile başlasın.
- Cevap ~~Cevap: [cevap]
- Açıklama &&Açıklama: [açıklama]
- ${minCount}-${maxCount} arası soru üret.
- Sadece metin olarak döndür.

Metin:
${content}
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-8b" });
    const result = await model.generateContent(prompt);
    res.json({ questions: await result.response.text() });
  } catch (err) {
    console.error("Gemini hata:", err.message);
    res.status(500).json({ error: "Soru üretilemedi" });
  }
});

app.post("/generate-keywords", async (req, res) => {
  const user = req.session?.passport?.user;
  let minCount = 5, maxCount = 5;

  // Kullanıcı giriş yaptıysa seviye bazlı sınırları ayarla (ama hak düşülmez!)
  if (user) {
    const tier = (user.tier || "").toLowerCase();
    if (tier.includes("pro")) {
      [minCount, maxCount] = [15, 20];
    } else if (tier.includes("üyelik")) {
      [minCount, maxCount] = [10, 10];
    }
  }

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
2. Bu konu hakkındaki genel bilgiye göre metindeki ${questionLanguage} dilindeki anahtar kelimeleri bul. (En az ${minCount} ve en fazla ${maxCount} anahtar kelime)
3. Her kelimeyi madde işareti (-) ile başlat.
4. Kelimeden sonra ":" koy ve o kelimenin anlamını genel bilgilere dayanarak anlaşılır biçimde ${questionLanguage} dilinde açıkla (metinden alıntı yapma, genel bilgini kullan).

Örnek Yapı:
- Kelime: Açıklama

Aşağıdaki metne göre yukarıdaki yönergeleri uygula:

"""
${content}
"""
`;

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


//// sql//////////

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

function buildPrompt(content, language, level, instructions = "") {
  let levelText = "";
  if (level === "Easy") {
    levelText = "The questions should be easy and cover basic-level concepts suitable for beginners or early learners.";
  } else if (level === "Medium") {
    levelText = "The questions should be of medium difficulty and involve some reasoning, problem-solving, or moderate-level math skills.";
  } else if (level === "Hard") {
    levelText = "The questions should be hard and include multi-step problems, conceptual understanding, or advanced reasoning.";
  }

  const randomSeed = Math.floor(Math.random() * 100000);

  return `
You are an expert math teacher and educational content creator.

### Goal:
Create one creative, complete, and original multiple-choice math question in **${language}**.  
The question must relate to: **${content}**  
Use the following instructional guidance to shape the tone and style:  
${instructions || "Use standard formatting and educational tone."}

### Question difficulty:
${levelText}

### Format (follow this strictly):
- Start with: \`***\`
- Include exactly 4 answer choices: \`/// A)\`, \`/// B)\`, etc.
- Mark the correct answer: \`~~Answer: ...\`
- Add an explanation: \`&&Explanation:\`  
  Use bullet points or line breaks between steps.  
  Each explanation must clearly justify why the answer is correct using at least 4 logical steps.
- End with: \`%%Check:\`

### Variation Rules:
- Use new numbers, settings, names, and question types every time
- Use creative classroom scenarios or real-world themes
- Vary the structure: comparisons, calculations, missing values, logic puzzles
- Use LaTeX for math
- Avoid repeating similar phrases

### Random Seed:
${randomSeed}
`;
}

function buildFixPrompt(originalText) {
  return `
You previously generated the following math question and answer:

${originalText}

However, the explanation does not match the correct answer, or there is a logical inconsistency.

Your task:
- Keep the theme and context the same.
- Fix any calculation or reasoning mistakes.
- Update the correct answer and explanation accordingly.
- Keep the same format:
  - Start with \`***\`
  - 4 choices: \`/// A)\`, etc.
  - Correct answer: \`~~Answer: ...\`
  - Explanation: \`&&Explanation:\`
  - End with \`%%Check: pass\`

Please regenerate a clean and accurate version of the question.
`;
}

app.post("/generate-math-question", async (req, res) => {
  const { content, language, level, instructions } = req.body;
  const difficulty = level || "Easy";

  if (!content || typeof content !== "string" || content.trim() === "") {
    return res.status(400).json({ error: "Content field is required." });
  }

  try {
    const langCode = franc(content || "");
    let questionLanguage = "English";

    if (language) {
      questionLanguage = language;
    } else if (langCode !== "und" && languageMap[langCode]) {
      const fallbackEnglish = ["fra", "deu", "spa", "ita"].includes(langCode) &&
        /\b(the|is|are|what|how|many|which)\b/i.test(content);
      questionLanguage = fallbackEnglish ? "English" : languageMap[langCode];
    }

    const prompt = buildPrompt(content, questionLanguage, difficulty, instructions);
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let attempts = 0;
    let resultText = "";
    let checkPassed = false;

    // Orijinal üretim denemesi
    while (attempts < 3 && !checkPassed) {
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024
        }
      });

      const rawText = await result.response.text();
      resultText = rawText.replaceAll("\\(", "\\(").replaceAll("\\)", "\\)");

      const checkLine = resultText.split("\n").find(line => line.trim().startsWith("%%Check:"));
      const checkMessage = checkLine?.toLowerCase() || "";
      checkPassed = checkMessage.includes("pass");

      attempts++;
    }

    // Otomatik düzeltme gerekirse
    if (!checkPassed) {
      const fixPrompt = buildFixPrompt(resultText);
      const fixResult = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: fixPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.9,
          maxOutputTokens: 1024
        }
      });

      const fixedText = await fixResult.response.text();
      return res.json({ result: fixedText, fixed: true });
    }

    res.json({ result: resultText, fixed: false });
  } catch (err) {
    console.error("MathJax question generation error:", err.message);
    res.status(500).json({
      error: "Failed to generate MathJax questions.",
      details: err.message
    });
  }
});





app.post("/save-all", async (req, res) => {
  const user = req.session?.passport?.user;
  if (!user) return res.status(401).json({ error: "Giriş yapmanız gerekiyor." });

  const { titleName, content, keywords, questions } = req.body;

  if (!titleName || !content || !keywords || !questions) {
    return res.status(400).json({ error: "Eksik veri gönderildi." });
  }

  try {
    // 1. Kullanıcı ID'sini al veya oluştur
    let { rows: userRows } = await pool.query("SELECT id FROM users WHERE email = $1", [user.email]);
    let userId;
    if (userRows.length === 0) {
      const result = await pool.query(
        "INSERT INTO users (name, email, tier) VALUES ($1, $2, $3) RETURNING id",
        [user.name, user.email, user.tier]
      );
      userId = result.rows[0].id;
    } else {
      userId = userRows[0].id;
    }

    // 2. Default Main Topic al veya oluştur
    const mainQuery = await pool.query(
      "SELECT id FROM main_topics WHERE user_id = $1 AND LOWER(name) = LOWER($2)",
      [userId, "Default Main"]
    );
    let mainTopicId = mainQuery.rows[0]?.id;
    if (!mainTopicId) {
      const inserted = await pool.query(
        "INSERT INTO main_topics (user_id, name) VALUES ($1, $2) RETURNING id",
        [userId, "Default Main"]
      );
      mainTopicId = inserted.rows[0].id;
    }

    // 3. Default Category al veya oluştur
    const catQuery = await pool.query(
      "SELECT id FROM categories WHERE main_topic_id = $1 AND LOWER(name) = LOWER($2)",
      [mainTopicId, "Default Category"]
    );
    let categoryId = catQuery.rows[0]?.id;
    if (!categoryId) {
      const inserted = await pool.query(
        "INSERT INTO categories (main_topic_id, name) VALUES ($1, $2) RETURNING id",
        [mainTopicId, "Default Category"]
      );
      categoryId = inserted.rows[0].id;
    }

    // 4. Başlık (Title) + Content
    const { rows: titleInsert } = await pool.query(
      "INSERT INTO titles (category_id, name, content) VALUES ($1, $2, $3) RETURNING id",
      [categoryId, titleName, content]
    );
    const titleId = titleInsert[0].id;

    // 5. Keywords kaydet
    for (const kw of keywords) {
      await pool.query(
        "INSERT INTO keywords (title_id, keyword, explanation) VALUES ($1, $2, $3)",
        [titleId, kw.keyword, kw.explanation]
      );
    }

    // 6. Questions kaydet
    for (const q of questions) {
      await pool.query(
        "INSERT INTO questions (title_id, question, choices, correct_answer, explanation) VALUES ($1, $2, $3, $4, $5)",
        [titleId, q.question, q.choices, q.correct_answer, q.explanation]
      );
    }

    res.json({ success: true, redirect: "/admin.html" });

  } catch (err) {
    console.error("Veri kaydetme hatası:", err);
    res.status(500).json({ error: "Kayıt sırasında bir hata oluştu." });
  }
});


////sql Admin/////
app.get("/get-tree", async (req, res) => {
  const user = req.session?.passport?.user;
  if (!user) return res.status(401).json({ error: "Giriş gerekli" });

  const { rows: userRows } = await pool.query("SELECT id FROM users WHERE email = $1", [user.email]);
  const userId = userRows[0]?.id;

  const mains = await pool.query("SELECT id, name FROM main_topics WHERE user_id = $1", [userId]);
  const result = [];

  for (const m of mains.rows) {
    const categories = await pool.query("SELECT id, name FROM categories WHERE main_topic_id = $1", [m.id]);
    const catsWithTitles = [];

    for (const c of categories.rows) {
      const titles = await pool.query("SELECT id, name FROM titles WHERE category_id = $1", [c.id]);
      catsWithTitles.push({
        id: c.id,        // <<< eksikse buradan geliyor
        name: c.name,
        titles: titles.rows
      });
    }

    result.push({
      id: m.id,          // <<< eksikse buradan geliyor
      name: m.name,
      categories: catsWithTitles
    });
  }

  res.json(result);
});



app.get("/details/:titleId", async (req, res) => {
  const titleId = req.params.titleId;

  const titleRes = await pool.query("SELECT name, content FROM titles WHERE id = $1", [titleId]);
  const title = titleRes.rows[0];

  const keywords = await pool.query("SELECT keyword, explanation FROM keywords WHERE title_id = $1", [titleId]);
  const questions = await pool.query("SELECT question, choices, correct_answer, explanation FROM questions WHERE title_id = $1", [titleId]);

  res.json({
    title: title.name,
    content: title.content,
    keywords: keywords.rows,
    questions: questions.rows
  });
});

app.post("/main-topic", async (req, res) => {
  const user = req.session?.passport?.user;
  if (!user) return res.status(401).json({ error: "Giriş yapmalısınız." });

  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Geçersiz isim" });

  const { rows: userRows } = await pool.query("SELECT id FROM users WHERE email = $1", [user.email]);
  const userId = userRows[0]?.id;

  const result = await pool.query(
    "INSERT INTO main_topics (user_id, name) VALUES ($1, $2) RETURNING id",
    [userId, name]
  );

  res.json({ success: true, id: result.rows[0].id });
});


app.put("/category/:id", async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  try {
    await pool.query("UPDATE categories SET name = $1 WHERE id = $2", [name, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Kategori güncelleme hatası:", err);
    res.status(500).json({ error: "Kategori güncellenemedi" });
  }
});
app.put("/title/:id/move", async (req, res) => {
  const { id } = req.params;
  const { newCategoryId } = req.body;
  try {
    await pool.query("UPDATE titles SET category_id = $1 WHERE id = $2", [newCategoryId, id]);
    res.json({ success: true });
  } catch (err) {
    console.error("Başlık taşıma hatası:", err);
    res.status(500).json({ error: "Başlık taşınamadı" });
  }
});
app.post("/category", async (req, res) => {
  const { main_topic_id, name } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO categories (main_topic_id, name) VALUES ($1, $2) RETURNING id",
      [main_topic_id, name]
    );
    res.json({ success: true, id: result.rows[0].id });
  } catch (err) {
    console.error("Kategori ekleme hatası:", err);
    res.status(500).json({ error: "Kategori eklenemedi" });
  }
});

app.delete("/main-topic/:id", async (req, res) => {
  const id = req.params.id;

  try {
    const result = await pool.query("SELECT is_default FROM main_topics WHERE id = $1", [id]);
    const topic = result.rows[0];

    if (!topic) return res.status(404).json({ error: "Ana kategori bulunamadı" });
    if (topic.is_default) return res.status(403).json({ error: "Default ana kategori silinemez" });

    await pool.query("DELETE FROM main_topics WHERE id = $1", [id]);
    res.json({ success: true });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Ana kategori silinemedi" });
  }
});


app.put("/category/:id", async (req, res) => {
  const id = req.params.id;
  const { name, main_topic_id } = req.body;

  try {
    // Duruma göre ayrı ayrı sorgular yap
    if (name && main_topic_id) {
      await pool.query("UPDATE categories SET name = $1, main_topic_id = $2 WHERE id = $3", [name, main_topic_id, id]);
    } else if (name) {
      await pool.query("UPDATE categories SET name = $1 WHERE id = $2", [name, id]);
    } else if (main_topic_id) {
      await pool.query("UPDATE categories SET main_topic_id = $1 WHERE id = $2", [main_topic_id, id]);
    } else {
      return res.status(400).json({ error: "Geçersiz istek: name veya main_topic_id gerekli." });
    }

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kategori güncellenemedi" });
  }
});




app.put("/title/:id", async (req, res) => {
  const id = req.params.id;
  const { category_id } = req.body;

  if (!category_id) {
    return res.status(400).json({ error: "category_id gerekli" });
  }

  try {
    await pool.query("UPDATE titles SET category_id = $1 WHERE id = $2", [category_id, id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Başlık güncellenemedi" });
  }
});



// === SPA Routing ===
app.get("*", (req, res) => res.sendFile(path.join(__dirname, "public", "index.html")));

// === SUNUCU BAŞLAT ===
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
});
