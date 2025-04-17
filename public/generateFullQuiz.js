async function generateFullQuiz() {
    let extractedText = window.extractedText || "";
  
    if (!extractedText) {
      const idsToCheck = ["textManualInput", "textOutput", "imageTextOutput", "audioTextOutput"];
      for (const id of idsToCheck) {
        const el = document.getElementById(id);
        if (el && el.value && el.value.trim().length > 0) {
          extractedText = el.value.trim();
          break;
        }
      }
    }
  
    if (!extractedText || extractedText.trim().length < 10) {
      alert("⚠️ Please paste or upload some text first.");
      return;
    }
  
    const button = event?.target || document.querySelector("#generateQuizButton");
    if (button) {
      button.disabled = true;
      button.textContent = "⏳ Generating...";
    }
  
    try {
      const res = await fetch("/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mycontent: extractedText })
      });
  
      const data = await res.json();
  
      if (!data.questions || !Array.isArray(data.questions)) {
        throw new Error("Invalid response from server");
      }
  
      const output = document.getElementById("quizOutput");
      output.innerHTML = "<h3>🎯 Generated Questions:</h3>";
  
      data.questions.forEach((q, index) => {
        const card = document.createElement("div");
        card.className = "quiz-card";
        card.innerHTML = `
          <h4>Q${index + 1}. ${q.question}</h4>
          <ul>
            ${q.options.map(opt => `<li>${opt}</li>`).join("")}
          </ul>
          <p><strong>✅ Answer:</strong> ${q.answer}</p>
          <p><strong>💡 Explanation:</strong> ${q.explanation}</p>
        `;
        output.appendChild(card);
      });
  
    } catch (err) {
      console.error("❌ Error:", err);
      alert("❌ Failed to generate questions.");
    }
  
    if (button) {
      button.disabled = false;
      button.textContent = "Generate Multiple Choice Questions";
    }
  }
  