const pool = require("./pool");
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
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const fetch = require("node-fetch");

// ✅ CORS MIDDLEWARE — en üste yerleştirilmeli!
const allowedOrigins = ["https://doitwithai.org"];


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







app.get("/auth/patreon/callback", async (req, res) => {
  const code = req.query.code;
  if (!code) return res.status(400).send("❌ Kod alınamadı.");

  try {
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

    // ✅ YENİ yönlendirme kodu burada
    const redirectUrl = new URL("https://doitwithai.org/the-history-of-ai/editor/");
    redirectUrl.searchParams.set("accessToken", tokenData.access_token);
    redirectUrl.searchParams.set("userEmail", email);
    redirectUrl.searchParams.set("userName", name);

    res.redirect(302, redirectUrl.toString()); // 🔁 yönlendirme

  } catch (err) {
    console.error("OAuth callback hatası:", err);
    res.status(500).send("❌ Hata oluştu.");
  }
});


/////////////Sql////////
app.post("/save-questions", async (req, res) => {
  const { title, questions, userEmail } = req.body;

  if (!title || !questions || !userEmail) {
    return res.status(400).json({ success: false, message: "Eksik bilgi" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    let resolvedTitleId;

    // 1. Başlık zaten var mı?
    const titleSelect = await client.query(
      "SELECT id FROM titles WHERE name = $1 LIMIT 1",
      [title]
    );
    resolvedTitleId = titleSelect.rows[0]?.id;

    // 2. Başlık yoksa oluştur (AI > General altında)
    if (!resolvedTitleId) {
      // a) Ana başlık: AI
      const mainRes = await client.query(`
        INSERT INTO main_topics(name)
        VALUES ('AI')
        ON CONFLICT(name) DO NOTHING
        RETURNING id
      `);
      const main_topic_id = mainRes.rows[0]?.id || (
        await client.query("SELECT id FROM main_topics WHERE name = 'AI'")
      ).rows[0]?.id;

      if (!main_topic_id) throw new Error("Ana başlık oluşturulamadı.");

      // b) Kategori: General
      const catRes = await client.query(`
        INSERT INTO categories(name, main_topic_id)
        VALUES ('General', $1)
        ON CONFLICT(name, main_topic_id) DO NOTHING
        RETURNING id
      `, [main_topic_id]);
      const category_id = catRes.rows[0]?.id || (
        await client.query("SELECT id FROM categories WHERE name = 'General' AND main_topic_id = $1", [main_topic_id])
      ).rows[0]?.id;

      if (!category_id) throw new Error("Kategori oluşturulamadı.");

      // c) Başlık ekle
      const titleInsert = await client.query(`
        INSERT INTO titles(name, category_id)
        VALUES ($1, $2)
        RETURNING id
      `, [title, category_id]);
      resolvedTitleId = titleInsert.rows[0]?.id;

      if (!resolvedTitleId) throw new Error("Başlık oluşturulamadı.");
    }

    // 3. Soruları ekle
    let insertCount = 0;
    for (const q of questions) {
      if (!q.question || !q.options || !q.answer) continue;

      const exists = await client.query(
        "SELECT id FROM questions WHERE question = $1 AND title_id = $2",
        [q.question, resolvedTitleId]
      );

      if (exists.rows.length === 0) {
        await client.query(
          "INSERT INTO questions(title_id, question, options, answer, explanation, user_email) VALUES ($1, $2, $3, $4, $5, $6)",
          [resolvedTitleId, q.question, JSON.stringify(q.options), q.answer, q.explanation, userEmail]
        );
        insertCount++;
      }
    }

    await client.query("COMMIT");
    console.log(`✅ ${insertCount} soru başarıyla kaydedildi.`);
    res.json({ success: true, inserted: insertCount });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Soru kaydetme hatası:", err.message);
    res.status(500).json({ success: false, message: "Sunucu hatası: " + err.message });
  } finally {
    client.release();
  }
});
app.get("/list-main-categories", async (req, res) => {
  const { email } = req.query;
  if (!email) return res.status(400).json({ success: false, message: "Email gerekli" });

  try {
    const result = await pool.query(`
      SELECT DISTINCT mt.id, mt.name
      FROM main_topics mt
      JOIN categories c ON c.main_topic_id = mt.id
      JOIN titles t ON t.category_id = c.id
      JOIN questions q ON q.title_id = t.id
      WHERE q.user_email = $1
      ORDER BY mt.name
    `, [email]);

    res.json(result.rows);
  } catch (err) {
    console.error("Ana başlıklar alınamadı:", err.message);
    res.status(500).json({ success: false });
  }
});


app.get("/list-categories", async (req, res) => {
  const { main_id, email } = req.query;
  if (!main_id || !email) return res.status(400).json({ success: false, message: "main_id ve email gerekli" });

  try {
    const result = await pool.query(`
      SELECT DISTINCT c.id, c.name
      FROM categories c
      JOIN titles t ON t.category_id = c.id
      JOIN questions q ON q.title_id = t.id
      WHERE c.main_topic_id = $1 AND q.user_email = $2
      ORDER BY c.name
    `, [main_id, email]);

    res.json(result.rows);
  } catch (err) {
    console.error("Kategoriler alınamadı:", err.message);
    res.status(500).json({ success: false });
  }
});



app.get("/list-titles", async (req, res) => {
  const { category_id, email } = req.query;
  if (!category_id || !email) return res.status(400).json({ success: false, message: "category_id ve email gerekli" });

  try {
    const result = await pool.query(`
      SELECT DISTINCT t.id, t.name
      FROM titles t
      JOIN questions q ON q.title_id = t.id
      WHERE t.category_id = $1 AND q.user_email = $2
      ORDER BY t.name
    `, [category_id, email]);

    res.json(result.rows);
  } catch (err) {
    console.error("Başlıklar alınamadı:", err.message);
    res.status(500).json({ success: false });
  }
});

app.get("/get-questions", async (req, res) => {
  const { title_id } = req.query;
  if (!title_id) return res.status(400).json({ success: false, message: "Eksik başlık ID" });

  try {
    const result = await pool.query(`
      SELECT id, question, options, answer, explanation 
      FROM questions 
      WHERE title_id = $1
      ORDER BY id DESC
    `, [title_id]);

    res.json({ questions: result.rows });
  } catch (err) {
    console.error("❌ Soru getirme hatası:", err.message);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
  }
});
app.delete("/delete-question/:id", async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query("DELETE FROM questions WHERE id = $1", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Silme hatası:", err.message);
    res.status(500).json({ success: false });
  }
});

app.put("/update-question", async (req, res) => {
  const { id, question, options, answer, explanation } = req.body;

  if (!id) return res.status(400).json({ success: false, message: "Eksik ID" });

  try {
    const result = await pool.query(`
      UPDATE questions 
      SET question = $1, options = $2, answer = $3, explanation = $4 
      WHERE id = $5
    `, [question, JSON.stringify(options), answer, explanation, id]);

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Güncelleme hatası:", err.message);
    res.status(500).json({ success: false, message: "Sunucu hatası" });
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
