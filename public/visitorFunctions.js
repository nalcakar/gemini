
// 🎯 Visitor Limit = 30 per day (tracked via Redis)

async function generateVisitorQuestions() {
  const extractedText = getCurrentSectionText();
  if (!extractedText || extractedText.length < 10) {
    alert("⚠️ Please provide some content first.");
    return;
  }

  const lang = document.getElementById("languageSelect")?.value || "";
  const focus = document.getElementById("topicFocus")?.value.trim() || "";
  const difficulty = document.getElementById("difficultySelect")?.value || "";

  try {
    const res = await fetch("https://gemini-j8xd.onrender.com/visitor/generate-questions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mycontent: extractedText, userLanguage: lang, userFocus: focus, difficulty })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Unknown error");

    displayGeneratedQuestions(data.questions);
    updateVisitorUsageBadge(data.usage);
  } catch (err) {
    alert("❌ " + err.message);
  }
}

async function generateVisitorKeywords() {
  const extractedText = getCurrentSectionText();
  if (!extractedText || extractedText.length < 10) {
    alert("⚠️ Please provide some content first.");
    return;
  }

  const lang = document.getElementById("languageSelect")?.value || "";
  const difficulty = document.getElementById("difficultySelect")?.value || "";

  try {
    const res = await fetch("https://gemini-j8xd.onrender.com/visitor/generate-keywords", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mycontent: extractedText, userLanguage: lang, difficulty })
    });

    const data = await res.json();

    if (!res.ok) throw new Error(data.error || "Limit reached or server error");

    displayGeneratedKeywords(data.keywords);
    updateVisitorUsageBadge(data.usage);
  } catch (err) {
    alert("❌ " + err.message);
  }
}

function updateVisitorUsageBadge(usage) {
  const badge = document.getElementById("visitorUsageBadge");
  if (badge && usage?.count != null) {
    badge.textContent = `🎯 Visitor Usage: ${usage.count} / ${usage.max}`;
  }
}
