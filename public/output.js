

const difficultyEmoji = {
  easy: "🟢",
  medium: "🟡",
  hard: "🔴"
};
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

  /// flashcards:

 // === FLASHCARD SYSTEM - FINAL WITH CORRECT RESTART ===

let flashcards = [];
let currentFlashcardIndex = 0;
let knownCount = 0;
let answeredCount = 0;

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

function openFlashcardMode() {
  const blocks = document.querySelectorAll("#modalQuestionList .question-card");

  // ✅ Select all if none are checked
  const noneSelected = !Array.from(blocks).some(block =>
    block.querySelector("input[type='checkbox']")?.checked
  );

  if (noneSelected) {
    blocks.forEach(block => {
      const checkbox = block.querySelector("input[type='checkbox']");
      if (checkbox) checkbox.checked = true;
    });
  }

  flashcards = Array.from(blocks)
    .filter(block => block.querySelector("input[type='checkbox']")?.checked)
    .map((block, i) => {
      const questionSpan = block.querySelector("summary .q[data-key='question']");
      const answerText = block.querySelector("p:nth-of-type(1)")?.textContent?.replace(/^✅ Answer:\s*/, "").trim() || "Answer not found.";

      return {
        front: questionSpan?.textContent?.trim() || `Q${i + 1}`,
        back: `<strong>✅ Answer:</strong> ${answerText}`,
        isAnswered: false
      };
    });

  if (flashcards.length === 0) {
    alert("⚠️ No selected flashcards to show.");
    return;
  }

  currentFlashcardIndex = 0;
  knownCount = 0;
  answeredCount = 0;

  document.getElementById("flashcardModal").style.display = "block";
  renderFlashcard();
}



  

function renderFlashcard() {
  const total = flashcards.length;
  const card = flashcards[currentFlashcardIndex];

  document.getElementById("flashcardCounter").textContent = `Flashcard ${currentFlashcardIndex + 1}/${total}`;
  document.getElementById("flashcardFrontContent").innerHTML = card.front;
  document.getElementById("flashcardBackContent").innerHTML = card.back;

  updateScore();
  if (window.MathJax) MathJax.typesetPromise();
}

function markKnown(knewIt) {
  if (flashcards[currentFlashcardIndex].isAnswered) return;

  flashcards[currentFlashcardIndex].isAnswered = true;

  disableAnswerButtons();

  answeredCount++;
  if (knewIt) knownCount++;

  updateScore();

  if (answeredCount === flashcards.length) {
    setTimeout(() => {
      showCompletionScreen();
    }, 400);
  }
}

function disableAnswerButtons() {
  const knownBtn = document.querySelector("#flashcardControls button:nth-child(1)");
  const unknownBtn = document.querySelector("#flashcardControls button:nth-child(2)");
  if (knownBtn && unknownBtn) {
    knownBtn.disabled = true;
    unknownBtn.disabled = true;
    knownBtn.style.background = "#9ca3af";
    unknownBtn.style.background = "#9ca3af";
  }
}

function updateScore() {
  document.getElementById("flashcardScore").textContent = `✅ Knew: ${knownCount} / Answered: ${answeredCount}`;
}

function flipFlashcard() {
  const inner = document.getElementById("flashcardInner");
  if (inner.style.transform === "rotateY(180deg)") {
    inner.style.transform = "rotateY(0deg)";
  } else {
    inner.style.transform = "rotateY(180deg)";
  }
}

function nextFlashcard() {
  if (currentFlashcardIndex < flashcards.length - 1) {
    currentFlashcardIndex++;
    document.getElementById("flashcardInner").style.transform = "rotateY(0deg)"; // ✅ Show front
    renderFlashcard();
  }
}


function prevFlashcard() {
  if (currentFlashcardIndex > 0) {
    currentFlashcardIndex--;
    document.getElementById("flashcardInner").style.transform = "rotateY(0deg)"; // ✅ Show front
    renderFlashcard();
  }
}


function closeFlashcardModal() {
  document.getElementById("flashcardModal").style.display = "none";
}

function showCompletionScreen() {
  const totalCards = flashcards.length;
  const scorePercent = Math.round((knownCount / totalCards) * 100);

  let feedback = "🧠 Good effort!";
  if (scorePercent === 100) feedback = "🏆 Perfect! You're a master!";
  else if (scorePercent >= 80) feedback = "🎯 Excellent work!";
  else if (scorePercent >= 60) feedback = "👍 Good job!";
  else feedback = "💪 Keep practicing!";

  document.getElementById("flashcardGameSection").style.display = "none";
  document.getElementById("flashcardResultSection").style.display = "block";

  document.getElementById("finalScoreText").innerHTML = `
    <h2 style="font-size:28px;">🎉 Quiz Completed!</h2>
    <p style="font-size:22px; margin:20px 0;">Your Score: <strong>${scorePercent}%</strong></p>
    <p style="font-size:20px; margin:20px 0;">${feedback}</p>
    <p style="font-size:18px;">✅ You knew <strong>${knownCount}</strong> out of <strong>${totalCards}</strong> cards.</p>
  `;
}

function restartFlashcards() {
  shuffleArray(flashcards);
  flashcards.forEach(card => card.isAnswered = false);
  currentFlashcardIndex = 0;
  knownCount = 0;
  answeredCount = 0;

  document.getElementById("flashcardGameSection").style.display = "block";
  document.getElementById("flashcardResultSection").style.display = "none";

  renderFlashcard();
}