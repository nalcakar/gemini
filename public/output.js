async function exportAsTXT() {
    const container = document.getElementById("modalQuestionList");
    if (!container) return alert("⚠️ No questions loaded.");
  
    const questionBlocks = container.querySelectorAll("details");
  
    if (questionBlocks.length === 0) {
      alert("⚠️ No questions found to export.");
      return;
    }
  
    let questionsPart = "=== QUIZ QUESTIONS ===\n\n";
    let answersPart = "=== ANSWERS & EXPLANATIONS ===\n\n";
  
    questionBlocks.forEach((block, index) => {
      const qNumber = index + 1;
      const questionText = block.querySelector("summary .q")?.textContent.trim() || `Question ${qNumber}`;
  
      const options = Array.from(block.querySelectorAll("ul li")).map((li, idx) => {
        const letter = String.fromCharCode(65 + idx); // A, B, C, D
        let cleanText = li.textContent.trim();
        // Remove first A), B), C), D) if already present
        cleanText = cleanText.replace(/^[A-D]\)\s*/, '');
        return `${letter}) ${cleanText}`;
      }).join("\n");
  
      const answerParagraphs = block.querySelectorAll("p");
      const answerText = answerParagraphs[0]?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";
      const explanationSpan = block.querySelector(".q[data-key='explanation']") || answerParagraphs[1]?.querySelector("span");
      const explanationText = explanationSpan?.textContent.trim() || "No explanation.";
  
      // Build parts
      questionsPart += `Q${qNumber}. ${questionText}\n${options}\n\n`;
      answersPart += `Q${qNumber}. Correct Answer: ${answerText}\nExplanation: ${explanationText}\n\n`;
    });
  
    const finalText = questionsPart + "\n" + answersPart;
  
    // Download
    const blob = new Blob([finalText], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (currentTitleName || "quiz") + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
  

  async function exportAsWord() {
  const container = document.getElementById("modalQuestionList");
  if (!container) return alert("⚠️ No questions loaded.");

  const questionBlocks = container.querySelectorAll("details");
  if (questionBlocks.length === 0) {
    alert("⚠️ No questions found to export.");
    return;
  }

  let content = "";

  content += "=== QUIZ QUESTIONS ===\n\n";

  questionBlocks.forEach((block, index) => {
    const qNumber = index + 1;
    const questionText = block.querySelector("summary .q")?.textContent.trim() || `Question ${qNumber}`;

    const options = Array.from(block.querySelectorAll("ul li")).map((li, idx) => {
      const letter = String.fromCharCode(65 + idx); // A, B, C, D
      let cleanText = li.textContent.trim();
      cleanText = cleanText.replace(/^[A-D]\)\s*/, ''); // remove any double A)
      return `${letter}) ${cleanText}`;
    }).join("\n");

    content += `Q${qNumber}. ${questionText}\n${options}\n\n`;
  });

  content += "\n=== ANSWERS & EXPLANATIONS ===\n\n";

  questionBlocks.forEach((block, index) => {
    const qNumber = index + 1;

    const answerParagraph = Array.from(block.querySelectorAll("p")).find(p => p.textContent.includes("Answer"));
    const answerText = answerParagraph?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";

    const explanationSpan = block.querySelector(".q[data-key='explanation']") || block.querySelector("p:nth-of-type(2) span");
    const explanationText = explanationSpan?.textContent.trim() || "No explanation.";

    content += `Q${qNumber}. Correct Answer: ${answerText}\nExplanation: ${explanationText}\n\n`;
  });

  // Prepare Word doc
  const header = `
    MIME-Version: 1.0
    Content-Type: multipart/related; boundary="boundary";

    --boundary
    Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document

    `;

  const blob = new Blob([content], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (currentTitleName || "quiz") + ".docx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
async function exportAsWord() {
    if (!currentTitleId) {
      alert("⚠️ Please select a Title first.");
      return;
    }
  
    const container = document.getElementById("modalQuestionList");
    if (!container) return alert("⚠️ No questions loaded.");
  
    const questionBlocks = container.querySelectorAll("details");
    if (questionBlocks.length === 0) {
      alert("⚠️ No questions found to export.");
      return;
    }
  
    const questions = [];
  
    questionBlocks.forEach((block, index) => {
      const questionText = block.querySelector("summary .q")?.textContent.trim() || `Question ${index + 1}`;
  
      const options = Array.from(block.querySelectorAll("ul li")).map((li, idx) => {
        let text = li.textContent.trim();
        text = text.replace(/^[A-D]\)\s*/, '');
        return text;
      });
  
      const answerParagraph = Array.from(block.querySelectorAll("p")).find(p => p.textContent.includes("Answer"));
      const answerText = answerParagraph?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";
  
      const explanationSpan = block.querySelector(".q[data-key='explanation']") || block.querySelector("p:nth-of-type(2) span");
      const explanationText = explanationSpan?.textContent.trim() || "No explanation.";
  
      questions.push({
        question: questionText,
        a: options[0] || "",
        b: options[1] || "",
        c: options[2] || "",
        d: options[3] || "",
        answer: answerText,
        explanation: explanationText
      });
    });
  
    try {
      const response = await fetch(`${API}/generate-docx`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          questions: questions,
          title: currentTitleName
        })
      });
  
      if (!response.ok) {
        const error = await response.json();
        alert("❌ Error creating DOCX: " + (error?.error || "Unknown server error."));
        return;
      }
  
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
  
      const a = document.createElement("a");
      a.href = url;
      a.download = `${currentTitleName || "quiz"}.docx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
  
    } catch (err) {
      console.error("❌ Export DOCX error:", err);
      alert("❌ Failed to export DOCX.");
    }
  }
  