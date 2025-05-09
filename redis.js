// redis.js
require("dotenv").config();
const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  socket: {
    reconnectStrategy: retries => Math.min(retries * 100, 3000),
    keepAlive: 30000
  }
});

redisClient.on("error", (err) => {
  console.error("❌ Redis bağlantı hatası:", err.message);
});

redisClient.connect().catch((err) => {
  console.error("❌ Redis bağlantısı başarısız:", err.message);
});

// 🚫 Visitor Limits
const MAX_DAILY_LIMIT = 20;
const DEFAULT_EXPECTED = 5;

async function visitorLimitMiddleware(req, res, next) {
  const token = req.headers.authorization || "";
  const isLoggedIn = token && token.startsWith("Bearer ");

  if (isLoggedIn) {
    console.log("🛡️ Logged-in user detected — skipping visitor limits.");
    return next();
  }

  let ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.connection.remoteAddress;
  if (!ip || ip === "::1" || ip === "127.0.0.1") ip = "localtest"; // Fallback for localhost

  const today = new Date().toISOString().split("T")[0];
  const redisKey = `visitor:${ip}:${today}`;
  console.log("🧠 Visitor Redis Key:", redisKey);

  try {
    const raw = await redisClient.get(redisKey);
    const usage = parseInt(raw) || 0;
    const projected = usage + DEFAULT_EXPECTED;

    console.log("📊 Redis value before increment:", raw);
    console.log("🧮 Projected usage:", projected, "/", MAX_DAILY_LIMIT);

    if (projected > MAX_DAILY_LIMIT) {
      console.log("🚫 Limit reached. Blocking visitor.");
      return res.status(429).json({ error: "🚫 Daily visitor limit reached. Please log in to continue." });
    }

    await redisClient.incrBy(redisKey, DEFAULT_EXPECTED);
    await redisClient.expireAt(redisKey, Math.floor(Date.now() / 1000) + 86400); // Always apply expiry

    console.log("✅ Visitor usage incremented. New value should be reflected in badge.");

    req.visitorKey = redisKey;
    req.visitorCount = projected;
    next();
  } catch (err) {
    console.error("❌ Redis middleware error:", err);
    res.status(500).json({ error: "Server error" });
  }
}


async function incrementVisitorUsage(req, count = 1) {
  if (!req.user && req.visitorKey) {
    await redisClient.incrBy(req.visitorKey, count);
    await redisClient.expire(req.visitorKey, 86400);
  }
}

module.exports = {
  redisClient,
  visitorLimitMiddleware,
  incrementVisitorUsage
};
