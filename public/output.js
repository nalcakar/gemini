

const difficultyEmoji = {
  easy: "🟢",
  medium: "🟡",
  hard: "🔴"
};
async function exportAsTXT() {
  const container = document.getElementById("modalQuestionList");
  if (!container) return alert("⚠️ No questions loaded.");

  const selectedBlocks = Array.from(container.querySelectorAll("details")).filter(block =>
    block.querySelector("input[type='checkbox']")?.checked
  );

  if (selectedBlocks.length === 0) {
    alert("⚠️ No flashcards or questions selected.");
    return;
  }

  let questionsPart = "=== QUESTIONS ===\n\n";
  let answersPart = "=== ANSWERS ===\n\n";

  selectedBlocks.forEach((block, index) => {
    const qNumber = index + 1;
    const questionText = block.querySelector("summary .q")?.textContent.trim() || `Question ${qNumber}`;
    const answerText = block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";
    const source = block.dataset.source || "";

    if (source === "keyword") {
      // ✅ CEVAP sonra boşluk
      questionsPart += `${qNumber}. ✅ ${answerText}\n    __________\n\n`;
      answersPart += `${qNumber}. 🔄 ${questionText}\n   ✅ Answer: ${answerText}\n\n`;
    } else {
      // MCQ normal biçim
      questionsPart += `${qNumber}. ${questionText}\n`;
      const options = Array.from(block.querySelectorAll("ul li")).map((li, idx) => {
        let cleanText = li.textContent.trim().replace(/^[A-D]\)\s*/, '');
        return `${String.fromCharCode(65 + idx)}) ${cleanText}`;
      }).join("\n");
      questionsPart += `${options}\n\n`;

      const explanationSpan = block.querySelector(".q[data-key='explanation']") || block.querySelector("p:nth-of-type(2) span");
      const explanationText = explanationSpan?.textContent.trim() || "No explanation.";
      answersPart += `${qNumber}. ✅ Correct Answer: ${answerText}\n💡 Explanation: ${explanationText}\n\n`;
    }
  });

  const finalText = questionsPart + "\n" + answersPart;

  const blob = new Blob([finalText], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (currentTitleName || "questions") + ".txt";
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

  const selectedBlocks = Array.from(container.querySelectorAll("details")).filter(block =>
    block.querySelector("input[type='checkbox']")?.checked
  );

  if (selectedBlocks.length === 0) {
    alert("⚠️ No flashcards or questions selected.");
    return;
  }

  const questions = [];

  selectedBlocks.forEach((block, index) => {
    const source = block.dataset.source || "mcq";
    const isKeyword = source === "keyword";

    const questionText = block.querySelector("summary .q")?.textContent.trim() || `Question ${index + 1}`;
    const answerParagraph = Array.from(block.querySelectorAll("p")).find(p => p.textContent.includes("Answer"));
    const answerText = answerParagraph?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";
    const explanationSpan = block.querySelector(".q[data-key='explanation']") || block.querySelector("p:nth-of-type(2) span");
    const explanationText = explanationSpan?.textContent.trim() || "";

    let a = "", b = "", c = "", d = "";

    if (!isKeyword) {
      const options = Array.from(block.querySelectorAll("ul li")).map((li) => li.textContent.trim());
      a = options[0] || "";
      b = options[1] || "";
      c = options[2] || "";
      d = options[3] || "";
    }

    if (isKeyword) {
      questions.push({
        index: index + 1,
        question: `${answerText}`,
        a: "", b: "", c: "", d: "",
        answer: questionText,
        explanation: explanationText,
        is_keyword: true
      });
    } else {
      questions.push({
        index: index + 1,
        question: questionText,
        a, b, c, d,
        answer: answerText,
        explanation: explanationText,
        is_keyword: false
      });
    }
  });

  try {
    const response = await fetch("https://gemini-j8xd.onrender.com/generate-docx", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        questions,
        title: currentTitleName || "Quiz"
      })
    });

    if (!response.ok) throw new Error("❌ Failed to generate DOCX.");

    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentTitleName || "quiz"}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error("Export error:", err);
    alert("❌ Failed to generate Word file.");
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
  const toggle = document.getElementById("flashcardFlipToggle");
  if (toggle) {
    toggle.checked = localStorage.getItem("flashcardFlipMode") === "answerFirst";
  }

  const blocks = document.querySelectorAll("#modalQuestionList .question-card");

  const selected = Array.from(blocks).filter(block => {
    const checkbox = block.querySelector("input[type='checkbox']");
    return checkbox?.checked;
  });

  if (selected.length === 0) {
    alert("⚠️ No flashcards selected. Please check at least one.");
    return;
  }

  const isAnswerFirst = toggle?.checked;
  localStorage.setItem("flashcardFlipMode", isAnswerFirst ? "answerFirst" : "questionFirst");

  flashcards = selected.map((block, i) => {
    const source = block.dataset.source || "mcq";
    const questionText = block.querySelector("summary .q[data-key='question']")?.textContent.trim() || `Q${i + 1}`;
    const rawAnswer = block.querySelector("p:nth-of-type(1)")?.textContent || "Answer not found.";

    // Remove "✅ Answer:" or "Answer:" prefix
    const answerText = rawAnswer.replace(/^✅?\s*Answer:\s*/i, "").trim();

    if (source === "keyword") {
      return {
        front: answerText,
        back: questionText,
        isAnswered: false
      };
    } else {
      return {
        front: questionText,
        back: answerText,
        isAnswered: false
      };
    }
  });

  currentFlashcardIndex = 0;
  knownCount = 0;
  answeredCount = 0;

  document.getElementById("flashcardModal").style.display = "block";
  renderFlashcard();
}




window.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("flashcardFlipToggle");
  if (toggle) {
    // Set initial state from localStorage
    toggle.checked = localStorage.getItem("flashcardFlipMode") === "answerFirst";

    toggle.addEventListener("change", function () {
      const isAnswerFirst = this.checked;
      localStorage.setItem("flashcardFlipMode", isAnswerFirst ? "answerFirst" : "questionFirst");

      // Update all flashcards
      flashcards = flashcards.map((card, i) => {
        const block = document.querySelectorAll("#modalQuestionList .question-card")[i];
        const questionSpan = block.querySelector("summary .q[data-key='question']");
        const answerText = block.querySelector("p:nth-of-type(1)")?.textContent?.replace(/^✅ Answer:\s*/, "").trim() || "Answer not found.";

        return isAnswerFirst
          ? {
              front: `<strong>✅ Answer:</strong> ${answerText}`,
              back: questionSpan?.textContent?.trim() || `Q${i + 1}`,
              isAnswered: flashcards[i]?.isAnswered || false
            }
          : {
              front: questionSpan?.textContent?.trim() || `Q${i + 1}`,
              back: `<strong>✅ Answer:</strong> ${answerText}`,
              isAnswered: flashcards[i]?.isAnswered || false
            };
      });

      // Rerender current card with new orientation
      renderFlashcard();
    });
  }
});






  



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

function disableAnswerButtons() {
  const knownBtn = document.querySelector("#flashcardControls button:nth-child(1)");
  const unknownBtn = document.querySelector("#flashcardControls button:nth-child(2)");
  if (knownBtn && unknownBtn) {
    knownBtn.disabled = true;
    unknownBtn.disabled = true;
    knownBtn.classList.add("disabled-btn");
    unknownBtn.classList.add("disabled-btn");
  }
}

function renderFlashcard() {
  const total = flashcards.length;
  const card = flashcards[currentFlashcardIndex];

  document.getElementById("flashcardCounter").textContent = `Flashcard ${currentFlashcardIndex + 1}/${total}`;
  document.getElementById("flashcardFrontContent").innerHTML = card.front;
  document.getElementById("flashcardBackContent").innerHTML = card.back;

  const knownBtn = document.querySelector("#flashcardControls button:nth-child(1)");
  const unknownBtn = document.querySelector("#flashcardControls button:nth-child(2)");
  if (!card.isAnswered) {
    knownBtn.disabled = false;
    unknownBtn.disabled = false;
    knownBtn.classList.remove("disabled-btn");
    unknownBtn.classList.remove("disabled-btn");
  } else {
    knownBtn.disabled = true;
    unknownBtn.disabled = true;
    knownBtn.classList.add("disabled-btn");
    unknownBtn.classList.add("disabled-btn");
  }

  updateScore();
  if (window.MathJax) MathJax.typesetPromise();
}


let allSelected = true; // <-- Start with true so the first click deselects

function toggleAllQuestions() {
  const checkboxes = document.querySelectorAll("#modalQuestionList input[type='checkbox']");
  allSelected = !allSelected;

  checkboxes.forEach(cb => {
    cb.checked = allSelected;

    const block = cb.closest("details");
    if (block) {
      if (allSelected) {
        block.dataset.selected = "true";
        block.classList.remove("unselected");
      } else {
        delete block.dataset.selected;
        block.classList.add("unselected");
      }
    }
  });

  const toggleBtn = document.getElementById("toggleSelectAll");
  toggleBtn.textContent = allSelected ? "🔲 Deselect All" : "☑️ Select All";
}



function showPreviewModal(type) {
  const container = document.getElementById("modalQuestionList");
  const selectedBlocks = Array.from(container.querySelectorAll("details")).filter(block =>
    block.querySelector("input[type='checkbox']")?.checked
  );

  if (selectedBlocks.length === 0) {
    alert("⚠️ No questions selected.");
    return;
  }

  let preview = "";
  selectedBlocks.forEach((block, index) => {
    const qNum = index + 1;
    const question = block.querySelector("summary .q")?.textContent.trim() || `Question ${qNum}`;
    const source = block.dataset.source || "";
    const answer = block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";

    preview += `${qNum}. ${answer}\n`;

    if (source === "keyword") {
      preview += `______________________\nAnswer: ${question}\n\n`;
    } else {
      const options = Array.from(block.querySelectorAll("ul li")).map((li, i) => {
        let text = li.textContent.trim();
        return `${String.fromCharCode(65 + i)}) ${text}`;
      }).join("\n");
      preview += `${options}\nAnswer: ${answer}\n\n`;
    }
  });

  document.getElementById("previewContent").textContent = preview;
  document.getElementById("exportPreviewModal").style.display = "block";
  window.pendingExportType = type; // store pending type
}

function closePreviewModal() {
  document.getElementById("exportPreviewModal").style.display = "none";
  window.pendingExportType = null;
}

function confirmExport(type) {
  closePreviewModal();
  if (type === "txt") exportAsTXT();
  else if (type === "docx") exportAsWord();
}
