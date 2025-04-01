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

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// === MIDDLEWARE ===
app.use(cors({ origin: true, credentials: true }));
app.use(session({
  secret: process.env.SESSION_SECRET || 'patreon_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // HTTPS ortamda: true
    sameSite: "lax" // HTTPS ortamda: "none"
  }
}));
app.use(express.json());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(path.join(__dirname, "public")));

// === PASSPORT CONFIG ===
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

    let tier = "Ziyaretçi";
    if (Array.isArray(data.included)) {
      const entitledTier = data.included.find(item => item.type === "tier");
      if (entitledTier?.attributes?.title) {
        tier = entitledTier.attributes.title.trim();
      }
    }

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

// === GİRİŞ / ÇIKIŞ ROUTE ===
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

// === FRONTEND'E GİRİŞ DURUMU VER ===
app.get("/me", (req, res) => {
  const user = req.session?.passport?.user || null;

  res.json({
    user,
    usage: {
      freeCount: req.session.freeCount || 0,
      anonCount: req.session.anonCount || 0
    }
  });
});

// === GEMINI SORU ÜRETME SINIRLI ===
app.post("/generate-questions", (req, res, next) => {
  const user = req.session?.passport?.user;
  const today = new Date().toISOString().split("T")[0];

  // Varsayılan değerler (ziyaretçi için)
  let minCount = 5;
  let maxCount = 5;

  // 🚫 Giriş yapılmamışsa
  if (!user) {
    if (req.session.anonDate !== today) {
      req.session.anonCount = 0;
      req.session.anonDate = today;
    }

    req.session.anonCount = (req.session.anonCount || 0) + 1;

    if (req.session.anonCount > 5) {
      return res.status(403).json({
        error: "Giriş yapmadan günlük en fazla 5 üretim yapabilirsiniz."
      });
    }

    req.soruAyari = { minCount, maxCount };
    return next();
  }

  // ✅ Giriş yapan kullanıcı
  const tier = (user.tier || "").toLowerCase();

  if (tier.includes("pro")) {
    minCount = 15;
    maxCount = 20;
    req.soruAyari = { minCount, maxCount };
    return next();
  }

  if (tier.includes("üyelik")) {
    minCount = 10;
    maxCount = 10;

    if (req.session.freeDate !== today) {
      req.session.freeCount = 0;
      req.session.freeDate = today;
    }

    req.session.freeCount = (req.session.freeCount || 0) + 1;

    if (req.session.freeCount > 5) {
      return res.status(403).json({
        error: "Üyelik seviyesinde günlük en fazla 5 üretim yapabilirsiniz."
      });
    }

    req.soruAyari = { minCount, maxCount };
    return next();
  }

  // Her ihtimale karşı varsayılan
  req.soruAyari = { minCount, maxCount };
  next();
}, async (req, res) => {
  const { content } = req.body;
  const { minCount, maxCount } = req.soruAyari;

  const langCode = franc(content);
  const languageMap = {
    eng: "İngilizce", tur: "Türkçe", spa: "İspanyolca", fra: "Fransızca",
    deu: "Almanca", ita: "İtalyanca", por: "Portekizce", rus: "Rusça",
    jpn: "Japonca", kor: "Korece", nld: "Flemenkçe", pol: "Lehçe",
    ara: "Arapça", hin: "Hintçe", ben: "Bengalce", zho: "Çince",
    vie: "Vietnamca", tha: "Tayca", ron: "Romence", ukr: "Ukraynaca"
  };

  const questionLanguage = languageMap[langCode] || "Türkçe";

  const prompt = `
Metin ${questionLanguage} dilindedir. Lütfen bu dilde çoktan seçmeli sorular üret.

Kurallar:
- Her soru *** ile başlamalı.
- Her sorunun 4 şıkkı olmalı. Şıklar /// ile başlasın.
- Her sorunun altında doğru cevabı belirt: "~~Cevap: [cevap metni]" şeklinde olsun.
- Ayrıca metne göre mutlaka bir açıklama ekle: "&&Açıklama: [açıklama metni]" olsun.
- En az ${minCount} soru, en fazla ${maxCount} soru üret.
- Sadece metin formatında yanıt ver. JSON veya kod bloğu istemiyorum.
- Cevapları **tam metin olarak** döndür.

Metin:
${content}
`;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    const text = await result.response.text();
    res.json({ questions: text });
  } catch (err) {
    console.error("Soru üretimi hatası:", err.message);
    res.status(500).json({ error: "Soru üretilemedi" });
  }
});




// patreon >>>>//


// SESSION
app.use(session({
  secret: process.env.SESSION_SECRET || 'patreon_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: false, // Render için: true
    sameSite: "lax" // Render için: "none"
  }
}));

// PASSPORT BAŞLAT
app.use(passport.initialize());
app.use(passport.session());

// KULLANICI SERİLEŞTİRME / DESERİLEŞTİRME
passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

// PATREON STRATEJİSİ
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
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });

    const data = await res.json();
    console.log("Patreon API:", JSON.stringify(data, null, 2));

    let tier = "Ziyaretçi";
    if (Array.isArray(data.included)) {
      const entitledTier = data.included.find(item => item.type === "tier");
      if (entitledTier?.attributes?.title) {
        tier = entitledTier.attributes.title.trim();
      }
    }

    const user = {
      name: data.data.attributes.full_name,
      email: data.data.attributes.email || null,
      patreon_id: data.data.id,
      tier
    };

    return done(null, user);
  } catch (err) {
    console.error("Patreon API error:", err);
    return done(err, null);
  }
}));


app.get("/auth/patreon", passport.authenticate("patreon"));

app.get("/auth/patreon/callback", passport.authenticate("patreon", {
  failureRedirect: "/",
  successRedirect: "/"
}));

app.get("/me", (req, res) => {
  const user = req.session?.passport?.user || null;
  res.json({
    user,
    usage: {
      freeCount: req.session.freeCount || 0,
      anonCount: req.session.anonCount || 0
    }
  });
});


app.get("/logout", (req, res) => {
  req.logout(err => {
    if (err) {
      console.error("Çıkış sırasında hata:", err);
      return res.status(500).send("Çıkış yapılamadı.");
    }

    req.session.destroy(() => {
      res.clearCookie("connect.sid"); // opsiyonel: oturum çerezini temizle
      res.redirect("/"); // anasayfaya yönlendir
    });
  });
});

// <<<< patreon //

// === SPA ROUTING: Diğer tüm isteklerde index.html dön ===
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// === SUNUCUYU BAŞLAT ===
const PORT = process.env.PORT || 3001;

app.listen(PORT, () => {
  console.log(`✅ Sunucu çalışıyor: http://localhost:${PORT}`);
});
