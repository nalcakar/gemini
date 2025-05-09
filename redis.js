const MAX_DAILY_LIMIT = 20;
const DEFAULT_EXPECTED = 5;

async function visitorLimitMiddleware(req, res, next) {
  const token = req.headers.authorization || "";
  const isLoggedIn = token && token.startsWith("Bearer ");
  if (isLoggedIn) return next();

  const ip = req.headers["x-forwarded-for"]?.split(",")[0] || req.connection.remoteAddress;
  const today = new Date().toISOString().split("T")[0];
  const redisKey = `visitor:${ip}:${today}`;

  try {
    const usage = parseInt(await redisClient.get(redisKey)) || 0;
    const projected = usage + DEFAULT_EXPECTED;

    if (projected > MAX_DAILY_LIMIT) {
      return res.status(429).json({ error: "🚫 Daily visitor limit reached. Please log in to continue." });
    }

    await redisClient.incrBy(redisKey, DEFAULT_EXPECTED);
    await redisClient.expire(redisKey, 86400); // 1 day

    req.visitorKey = redisKey;
    req.visitorCount = projected;
    next();
  } catch (err) {
    console.error("Redis error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
