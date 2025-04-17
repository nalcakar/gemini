async function generateFullQuiz() {
    let extractedText = window.extractedText || "";
  
    // 1️⃣ Eğer window.extractedText boşsa, textarea’lara bak
    if (!extractedText) {
      const idsToCheck = ["textManualInput", "textOutput", "imageTextOutput", "audioTextOutput"];
      for (const id of idsToCheck) {
        const el = document.getElementById(id);
        if (el && el.value.trim().length > 0) {
          extractedText = el.value.trim();
          break;
        }
      }
    }
  
    // 2️⃣ Hâlâ boşsa uyarı ver
    if (!extractedText || extractedText.trim().length < 10) {
      alert("⚠️ Please paste or upload some text first.");
      return;
    }
  
    // 3️⃣ Butonu devre dışı bırak
    const button = event?.target || document.querySelector("#generateQuizButton");
    if (button) {
      button.disabled = true;
      button.textContent = "⏳ Generating...";
    }
  
    try {
      const accessToken = localStorage.getItem("accessToken") || "";
  
      // 4️⃣ Sunucuya token ile fetch gönder
      const res = await fetch("https://gemini-j8xd.onrender.com/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({ mycontent: extractedText })
      });
  
      // 5️⃣ Sunucu cevabını kontrol et
      if (!res.ok) {
        const text = await res.text();
        console.error("🔴 Server Error:", res.status, text);
        throw new Error(`Server returned ${res.status}`);
      }
  
      const data = await res.json();
  
      // 6️⃣ Beklenen format: { questions: string (*** /// ~~ &&) }
      if (!data.questions || typeof data.questions !== "string") {
        throw new Error("Sunucu geçerli soru formatı döndürmedi.");
      }
  
      const raw = data.questions;
  
      // 7️⃣ *** /// ~~ && formatını parse et
      const questions = raw
        .split("***")
        .map(b => b.trim())
        .filter(Boolean)
        .map(block => {
          const question = block.split("///")[0].trim();
          const options = block.match(/\/\/\/\s*(.+)/g)?.map(opt => opt.replace("///", "").trim()) || [];
          const answerMatch = block.match(/~~Cevap:\s*(.+)/i);
          const explanationMatch = block.match(/&&Açıklama:\s*([\s\S]*)/i);
  
          return {
            question,
            options,
            answer: answerMatch ? answerMatch[1].trim() : "",
            explanation: explanationMatch ? explanationMatch[1].trim() : ""
          };
        });
  
      // 8️⃣ DOM’a yaz
      const output = document.getElementById("quizOutput");
      output.innerHTML = "<h3>🎯 Generated Questions:</h3>";
  
      questions.forEach((q, i) => {
        const div = document.createElement("div");
        div.className = "quiz-preview";
        div.innerHTML = `
          <b>Q${i + 1}. ${q.question}</b>
          <ul>${q.options.map(opt => `<li>${opt}</li>`).join("")}</ul>
          <p><strong>✅ Answer:</strong> ${q.answer}</p>
          <p><strong>💡 Explanation:</strong> ${q.explanation}</p>
        `;
        output.appendChild(div);
      });
  
    } catch (err) {
      console.error("❌ Error generating questions:", err.message || err);
      alert(`❌ Failed to generate questions.\n${err.message || "Unknown error"}`);
    }
  
    // 9️⃣ Butonu tekrar aktif et
    if (button) {
      button.disabled = false;
      button.textContent = "Generate Multiple Choice Questions";
    }
  }
  