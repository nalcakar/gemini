// redis.js
require("dotenv").config();
const redis = require("redis");

const redisClient = redis.createClient({
  url: process.env.REDIS_URL,
  legacyMode: true
});

redisClient.on("error", (err) => {
  console.error("❌ Redis bağlantı hatası:", err.message);
});

redisClient.connect().catch((err) => {
  console.error("❌ Redis bağlantısı başarısız:", err.message);
});

const MAX_DAILY_LIMIT = 20;

async function visitorLimitMiddleware(req, res, next) {
  const token = req.headers.authorization || "";
  const isLoggedIn = token && token.startsWith("Bearer ");

  if (isLoggedIn) return next();

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
    await redisClient.expire(req.visitorKey, 86400);
  }
}

module.exports = {
  redisClient,
  visitorLimitMiddleware,
  incrementVisitorUsage
};
