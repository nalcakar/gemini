// generateFullQuiz.js
async function generateFullQuiz() {
    let extractedText = window.extractedText || "";

// Diğer sekmelerden textarea varsa, onu kullan:
if (!extractedText) {
  const idsToCheck = ["textManualInput", "textOutput", "imageTextOutput", "audioTextOutput"];
  for (let id of idsToCheck) {
    const el = document.getElementById(id);
    if (el && el.value.trim().length > 0) {
      extractedText = el.value.trim();
      break;
    }
  }
}

    if (!extractedText || extractedText.trim().length < 10) {
      alert("Please paste or upload some text first.");
      return;
    }
  
    const button = event?.target || document.querySelector("#generateQuizButton");
    if (button) {
      button.disabled = true;
      button.textContent = "⏳ Generating...";
    }
  
    try {
      const res = await fetch("https://gemini-j8xd.onrender.com/generate-questions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mycontent: extractedText })
      });
  
      const data = await res.json();
      if (data.questions) {
        document.getElementById("quizOutput").innerHTML = `
          <h3>🎯 Generated Questions:</h3>
          <pre style="background:#f9f9f9;padding:10px;border-radius:6px;white-space:pre-wrap;">${data.questions}</pre>`;
      } else {
        alert("No questions returned.");
      }
    } catch (err) {
      console.error("Error generating questions:", err);
      alert("❌ Failed to generate questions.");
    }
  
    if (button) {
      button.disabled = false;
      button.textContent = "Generate Multiple Choice Questions";
    }
  }
  