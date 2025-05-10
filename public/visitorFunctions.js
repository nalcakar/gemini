

// 🧠 Ensure a stable anonymous visitor ID is created and stored
if (!localStorage.getItem("visitorId")) {
  const id = "v_" + Math.random().toString(36).substring(2, 12);
  localStorage.setItem("visitorId", id);
}
const VISITOR_ID = localStorage.getItem("visitorId");


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
      headers: {
        "Content-Type": "application/json",
        "X-Visitor-ID": VISITOR_ID
      },
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
      headers: {
        "Content-Type": "application/json",
        "X-Visitor-ID": VISITOR_ID
      },
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
function displayGeneratedQuestions(questions) {
  const output = document.getElementById("quizOutput");
  output.innerHTML = `<h3 style="text-align:center;">🎯 Generated Questions:</h3>`;

  questions.forEach((q, i) => {
    const details = document.createElement("details");
    details.className = "quiz-preview";
    details.style.maxWidth = "700px";
    details.style.margin = "15px auto";

    const badge = q.difficulty === "easy" ? "🟢 Easy"
                : q.difficulty === "hard" ? "🔴 Hard"
                : "🟡 Medium";

    const questionHTML = `<span class="q" data-key="question">${q.question}</span>`;
    const optionsHTML = q.options.map(opt =>
      `<li class="q" data-key="option">${opt}</li>`
    ).join("");
    const answerHTML = `<span class="q" data-key="answer">${q.answer}</span>`;
    const explanationHTML = `<span class="q" data-key="explanation">${q.explanation}</span>`;

    details.innerHTML = `
      <summary><b>Q${i + 1}.</b> ${questionHTML}</summary>
      <div style="margin-top: 8px; padding: 8px;">
        <ul>${optionsHTML}</ul>
        <p><strong>✅ Answer:</strong> ${answerHTML}</p>
        <p><strong>💡 Explanation:</strong> ${explanationHTML}</p>
        <p class="difficulty-line" data-level="${q.difficulty}"><strong>Difficulty:</strong> ${badge}</p>
      </div>
    `;

    output.appendChild(details);
  });

  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise();
  }
}

function updateVisitorUsageBadge(usage) {
  const badge = document.getElementById("visitorUsageBadge");
  if (badge && usage?.count != null) {
    badge.textContent = `🎯 Visitor Usage: ${usage.count} / ${usage.max}`;
  }
}
