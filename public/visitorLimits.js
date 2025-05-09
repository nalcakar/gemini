// visitorLimits.js — Cleaned version without limits or badges

function renderVisitorSavedContent() {
  const container = document.getElementById("visitorSavedSection");
  const raw = localStorage.getItem("visitorData");
  if (!raw) return (container.innerHTML = "");

  const data = JSON.parse(raw);
  if (!data || !data.titles?.length) {
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

document.addEventListener("DOMContentLoaded", renderVisitorSavedContent);


function saveCurrentVisitorQuestions(titleName, questions, isKeyword = false) {
  const raw = localStorage.getItem("visitorData") || "{}";
  const data = JSON.parse(raw);
  const titles = data.titles || [];

  if (titles.length >= 4) return false;

  const trimmed = questions.slice(0, 5).map(q => ({
    q: q.question,
    a: q.answer,
    explanation: q.explanation || "",
    options: q.options || [],
    difficulty: q.difficulty || ""
  }));

  const updated = {
    date: new Date().toISOString().split("T")[0],
    titles: [...titles, { name: titleName, questions: trimmed, isKeyword }]
  };

  localStorage.setItem("visitorData", JSON.stringify(updated));
  return true;
}
