

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

  let questionsPart = "=== QUESTIONS ===\n\n";
  let answersPart = "=== ANSWERS ===\n\n";

  questionBlocks.forEach((block, index) => {
    const qNumber = index + 1;
    const questionText = block.querySelector("summary .q")?.textContent.trim() || `Question ${qNumber}`;
    const answerText = block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";
    const source = block.dataset.source || "";

    questionsPart += `${qNumber}. ${questionText}\n`;

    if (source === "keyword") {
      questionsPart += `______________________\n\n`;
    } else {
      const options = Array.from(block.querySelectorAll("ul li")).map((li, idx) => {
        let cleanText = li.textContent.trim().replace(/^[A-D]\)\s*/, '');
        return `${String.fromCharCode(65 + idx)}) ${cleanText}`;
      }).join("\n");
      questionsPart += `${options}\n\n`;

      const explanationSpan = block.querySelector(".q[data-key='explanation']") || block.querySelector("p:nth-of-type(2) span");
      const explanationText = explanationSpan?.textContent.trim() || "No explanation.";
      answersPart += `${qNumber}. Correct Answer: ${answerText}\nExplanation: ${explanationText}\n\n`;
      return;
    }

    answersPart += `${qNumber}. Correct Answer: ${answerText}\n\n`;
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
  const container = document.getElementById("modalQuestionList");
  if (!container) return alert("⚠️ No questions loaded.");

  const questionBlocks = container.querySelectorAll("details");
  if (questionBlocks.length === 0) {
    alert("⚠️ No questions found to export.");
    return;
  }

  const questions = Array.from(questionBlocks).map((block, index) => {
    const question = block.querySelector("summary .q")?.textContent.trim() || `Question ${index + 1}`;
    const answer = block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";
    const explanationSpan = block.querySelector(".q[data-key='explanation']") || block.querySelector("p:nth-of-type(2) span");
    const explanation = explanationSpan?.textContent.trim() || "";
    const source = (block.dataset.source || "").trim().toLowerCase();

    if (source === "flash" || source === "keyword") {
      return {
        index: index + 1,
        question,
        a: "______________________",
        b: "",
        c: "",
        d: "",
        answer,
        explanation: ""
      };
    } else {
      const options = Array.from(block.querySelectorAll("ul li")).map(li =>
        li.textContent.trim().replace(/^[A-Da-d]\)\s*/, '')
      );
      return {
        index: index + 1,
        question,
        a: options[0] || "",
        b: options[1] || "",
        c: options[2] || "",
        d: options[3] || "",
        answer,
        explanation
      };
    }
  });

  // Load template.docx from server or local URL
  fetch("/template-updated.docx")
    .then(res => res.arrayBuffer())
    .then(content => {
      const zip = new PizZip(content);
      const doc = new window.docxtemplater().loadZip(zip);

      doc.setData({
        title: currentTitleName || "Untitled",
        questions
      });

      try {
        doc.render();
      } catch (error) {
        console.error("Render Error:", error);
        alert("❌ Failed to generate Word document.");
        return;
      }

      const out = doc.getZip().generate({
        type: "blob",
        mimeType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(out);
      link.download = (currentTitleName || "questions") + ".docx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
}



async function exportAsWord() {
  const container = document.getElementById("modalQuestionList");
  if (!container) return alert("⚠️ No questions loaded.");

  const questionBlocks = container.querySelectorAll("details");
  if (questionBlocks.length === 0) {
    alert("⚠️ No questions found to export.");
    return;
  }

  // Prepare question data
  const questions = Array.from(questionBlocks).map((block, index) => {
    const question = block.querySelector("summary .q")?.textContent.trim() || `Question ${index + 1}`;
    const answer = block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";
    const source = (block.dataset.source || "").trim().toLowerCase();
    const isKeyword = source === "flash" || source === "keyword";

    if (isKeyword) {
      return {
        index: index + 1,
        question,
        answer,
        a: "", b: "", c: "", d: "",
        explanation: "",
        isKeyword: true
      };
    } else {
      const options = Array.from(block.querySelectorAll("ul li")).map(li =>
        li.textContent.trim().replace(/^[A-Da-d]\)\s*/, '')
      );
      const explanationSpan = block.querySelector(".q[data-key='explanation']") || block.querySelector("p:nth-of-type(2) span");
      const explanation = explanationSpan?.textContent.trim() || "";

      return {
        index: index + 1,
        question,
        answer,
        a: options[0] || "",
        b: options[1] || "",
        c: options[2] || "",
        d: options[3] || "",
        explanation,
        isKeyword: false
      };
    }
  });

  // Load and use the Word template
  const templateUrl = "/template-keyword-compatible.docx"; // Replace with actual path if hosted

  fetch(templateUrl)
    .then(res => res.arrayBuffer())
    .then(content => {
      const zip = new PizZip(content);
      const doc = new window.docxtemplater().loadZip(zip);

      doc.setData({
        title: currentTitleName || "Untitled",
        questions
      });

      try {
        doc.render();
      } catch (error) {
        console.error("❌ Word render error:", error);
        alert("❌ Failed to generate Word document.");
        return;
      }

      const out = doc.getZip().generate({
        type: "blob",
        mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      });

      const link = document.createElement("a");
      link.href = URL.createObjectURL(out);
      link.download = (currentTitleName || "questions") + ".docx";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
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
  // Load saved preference from localStorage
  const toggle = document.getElementById("flashcardFlipToggle");
  if (toggle) {
    toggle.checked = localStorage.getItem("flashcardFlipMode") === "answerFirst";
  }

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

  // Determine flip mode
  const isAnswerFirst = toggle?.checked;

  // Save current setting
  localStorage.setItem("flashcardFlipMode", isAnswerFirst ? "answerFirst" : "questionFirst");

  // Build flashcards
  flashcards = Array.from(blocks)
    .filter(block => block.querySelector("input[type='checkbox']")?.checked)
    .map((block, i) => {
      const questionSpan = block.querySelector("summary .q[data-key='question']");
      const answerText = block.querySelector("p:nth-of-type(1)")?.textContent?.replace(/^✅ Answer:\s*/, "").trim() || "Answer not found.";

      return isAnswerFirst
        ? {
            front: `<strong>✅ Answer:</strong> ${answerText}`,
            back: questionSpan?.textContent?.trim() || `Q${i + 1}`,
            isAnswered: false
          }
        : {
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
