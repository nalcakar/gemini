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
    await redisClient.expire(redisKey, 86400); // 24h expiry

    req.visitorKey = redisKey;
    req.visitorCount = projected;
    next();

  } catch (err) {
    console.error("Redis error:", err);
    res.status(500).json({ error: "Server error" });
  }
}

const MAX_TITLES = 4;
const MAX_ITEMS = 20;

function resetDailyVisitorDataIfNewDay() {
  const today = new Date().toISOString().split("T")[0];
  const data = JSON.parse(localStorage.getItem("visitorData"));
  if (!data || data.date !== today) {
    localStorage.setItem("visitorData", JSON.stringify({ date: today, titles: [], generatedCount: 0 }));
  } else if (!("generatedCount" in data)) {
    data.generatedCount = data.titles.reduce((sum, t) => sum + t.questions.length, 0);
    localStorage.setItem("visitorData", JSON.stringify(data));
  }
}

function getVisitorData() {
  resetDailyVisitorDataIfNewDay();
  return JSON.parse(localStorage.getItem("visitorData"));
}

function getTotalVisitorItemsToday() {
  const data = getVisitorData();
  return data.generatedCount || 0;
}

function canVisitorGenerate(countNeeded = 1) {
  const data = getVisitorData();
  const totalItems = getTotalVisitorItemsToday();

  const withinTitleLimit = data.titles.length < MAX_TITLES;
  const withinItemLimit = totalItems + countNeeded <= MAX_ITEMS;

  return withinTitleLimit && withinItemLimit;
}


function saveCurrentVisitorQuestions(titleName, questions, isKeyword = false) {
  const data = getVisitorData();
  if (data.titles.length >= MAX_TITLES) return false;

  const trimmed = questions.slice(0, 5).map(q => ({
    q: q.question,
    a: q.answer,
    explanation: q.explanation || "",
    options: q.options || [],
    difficulty: q.difficulty || ""
  }));

  data.titles.push({ name: titleName, questions: trimmed, isKeyword });
  localStorage.setItem("visitorData", JSON.stringify(data));
  return true;
}

function renderVisitorSavedContent() {
  const container = document.getElementById("visitorSavedSection");
  const data = getVisitorData();

  if (!data || !data.titles.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = `<h3 style="text-align:center; margin-bottom:20px;">📘 Your Saved Titles (Visitor)</h3>` +
    data.titles.map((t, i) => {
      const questionsHTML = t.questions.map((q, index) => {
        if (t.isKeyword) {
          return `
          <details class="quiz-preview" style="max-width:700px; margin:15px auto;">
            <summary><b>Keyword ${index + 1}:</b> ${q.q}</summary>
            <div style="padding: 8px;">
              <p><strong>💬 Explanation:</strong> ${q.a}</p>
            </div>
          </details>`;
        } else {
          const badge = q.difficulty === "easy" ? "🟢 Easy"
                      : q.difficulty === "hard" ? "🔴 Hard"
                      : "🟡 Medium";
          const options = q.options?.length
            ? `<ul>${q.options.map(opt => `<li>${opt}</li>`).join("")}</ul>`
            : "";

          return `
          <details class="quiz-preview" style="max-width:700px; margin:15px auto;">
            <summary><b>Q${index + 1}:</b> ${q.q}</summary>
            <div style="padding: 8px;">
              ${options}
              <p><strong>✅ Answer:</strong> ${q.a}</p>
              <p><strong>💡 Explanation:</strong> ${q.explanation}</p>
              <p><strong>Difficulty:</strong> ${badge}</p>
            </div>
          </details>`;
        }
      }).join("");

      return `
        <div style="background:#f9fafb; border:1px solid #d1d5db; border-radius:12px; padding:16px; margin-bottom:24px;">
          <h4>${i + 1}. ${t.name}</h4>
          ${questionsHTML}
        </div>`;
    }).join("");
}

function disableGenerateUIForVisitors() {
  const generateBtn = document.getElementById("generateQuizButton");
  const keywordBtn = document.getElementById("generateKeywordsButton");
  const note = document.getElementById("visitorLimitNote");

  if (generateBtn) generateBtn.style.display = "none";
  if (keywordBtn) keywordBtn.style.display = "none";

  if (!note) {
    const warning = document.createElement("div");
    warning.id = "visitorLimitNote";
    warning.style = "margin-top: 20px; padding: 14px; text-align:center; background:#fff3cd; border:1px solid #ffeeba; border-radius: 8px; font-size: 16px;";
    warning.innerHTML = `⚠️ You’ve reached your daily visitor limit (4 titles / 20 questions or keywords).<br>🎁 <b><a href="/join" style="color:#0c63e4;">Join now</a></b> to unlock unlimited access.`;

    const container = document.getElementById("quizOutput") || document.body;
    container.appendChild(warning);
  }
}

document.addEventListener("DOMContentLoaded", renderVisitorSavedContent);
document.addEventListener("DOMContentLoaded", showVisitorUsageBadge);

function incrementVisitorGeneratedCount(count = 1) {
  const data = getVisitorData();
  data.generatedCount = (data.generatedCount || 0) + count;
  localStorage.setItem("visitorData", JSON.stringify(data));
}


async function showVisitorUsageBadge() {
  const isLoggedIn = !!localStorage.getItem("accessToken");
  if (isLoggedIn) return;

  try {
    const res = await fetch("/visitor-usage");
    if (!res.ok) throw new Error("Failed");

    const { used, max } = await res.json();
    const badge = document.getElementById("visitorUsageBadge") || document.createElement("div");
    badge.id = "visitorUsageBadge";

    badge.innerHTML = `🎯 Visitor Usage: <strong>${used} / ${max}</strong> items today`;
    badge.style = `
      background: #fef3c7;
      border: 1px solid #fcd34d;
      padding: 10px 16px;
      border-radius: 8px;
      font-size: 15px;
      text-align: center;
      margin: 12px auto;
      max-width: 400px;
    `;

    const parent = document.getElementById("quizOutput") || document.body;
    if (!document.getElementById("visitorUsageBadge")) {
      parent.prepend(badge);
    }
  } catch (err) {
    console.warn("❌ Could not show visitor usage badge.");
  }
}

