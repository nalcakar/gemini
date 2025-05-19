let quizBlocks = [];
let selectedAnswers = [];
let correctAnswers = [];
let currentIndex = 0;
let quizBox;
let inRetryMode = false;

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
    const source = block.dataset.source || "";

    const questionSpan = block.querySelector("summary .q[data-key='question']") || block.querySelector("summary");
    const questionText = questionSpan?.textContent.replace(/^Q\d+\.\s*/, "").trim() || `Question ${qNumber}`;

    const answerText = block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";

    let explanationText = "No explanation.";
    const explanationEl = block.querySelector("p:nth-of-type(2)") || block.querySelector(".q[data-key='explanation']");
    if (explanationEl) {
      explanationText = explanationEl.textContent.replace(/^💡 Explanation:\s*/, "").trim();
    }

    let answerLetter = "";
    if (source !== "keyword") {
      const options = Array.from(block.querySelectorAll("ul li"));
      const foundIndex = options.findIndex(li => li.textContent.trim() === answerText);
      if (foundIndex >= 0) {
        answerLetter = ` (${String.fromCharCode(65 + foundIndex)})`;
      }
    }

    if (source === "keyword") {
  questionsPart += `${qNumber}. ${answerText}\n______________________\n\n`;
answersPart += `${qNumber}. ✅ Answer: ${questionText}`;
if (explanationText && explanationText.toLowerCase() !== "no explanation.") {
  answersPart += `\n💡 ${explanationText}`;
}
answersPart += `\n\n`;
}
 else {
      questionsPart += `${qNumber}. ${questionText}\n`;
      const options = Array.from(block.querySelectorAll("ul li")).map((li, idx) => {
        let cleanText = li.textContent.trim().replace(/^[A-D]\)\s*/, '');
        return `${String.fromCharCode(65 + idx)}) ${cleanText}`;
      }).join("\n");
      questionsPart += `${options}\n\n`;

      answersPart += `${qNumber}. ✅ Correct Answer: ${answerText}${answerLetter}\n💡 Explanation: ${explanationText}\n\n`;
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

    const questionSpan = block.querySelector("summary .q[data-key='question']") || block.querySelector("summary");
    const questionText = questionSpan?.textContent.replace(/^Q\d+\.\s*/, "").trim() || `Question ${index + 1}`;

    const answerParagraph = Array.from(block.querySelectorAll("p")).find(p => p.textContent.includes("Answer"));
    const answerTextRaw = answerParagraph?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";

    let explanationText = "";
    const explanationEl = block.querySelector("p:nth-of-type(2)") || block.querySelector(".q[data-key='explanation']");
    if (explanationEl) {
      explanationText = explanationEl.textContent.replace(/^💡 Explanation:\s*/, "").trim();
    }

    let a = "", b = "", c = "", d = "";
    let answerLetter = "";

    if (!isKeyword) {
      const options = Array.from(block.querySelectorAll("ul li")).map((li) => li.textContent.trim());
      a = options[0] || "";
      b = options[1] || "";
      c = options[2] || "";
      d = options[3] || "";

      const foundIndex = options.findIndex(opt => opt === answerTextRaw);
      if (foundIndex >= 0) {
        answerLetter = ` (${String.fromCharCode(65 + foundIndex)})`;
      }
    }

    const answerFinal = answerTextRaw + answerLetter;

    if (isKeyword) {
      questions.push({
        index: index + 1,
        question: `${answerTextRaw}`,
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
        answer: answerFinal,
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
  flashcards[currentFlashcardIndex].wasKnown = knewIt;  // ✅ new flag

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

  // ✅ Set button visibility instead of injecting HTML
  const reviewBtn = document.getElementById("reviewUnknownBtn");
  const hasUnknown = flashcards.some(card => !card.wasKnown);
  reviewBtn.style.display = hasUnknown ? "inline-block" : "none";

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
    const source = block.dataset.source || "";
    
    const questionSpan = block.querySelector("summary .q[data-key='question']") || block.querySelector("summary");
    const questionText = questionSpan?.textContent.replace(/^Q\d+\.\s*/, "").trim() || `Question ${qNum}`;

    const answer = block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim() || "No answer";

    let explanation = "No explanation.";
    const explanationEl = block.querySelector("p:nth-of-type(2)") || block.querySelector(".q[data-key='explanation']");
    if (explanationEl) {
      explanation = explanationEl.textContent.replace(/^💡 Explanation:\s*/, "").trim();
    }

    if (source === "keyword") {
  preview += `${qNum}. ${answer}\n______________________\n✅ Answer: ${questionText}`;
if (explanation && explanation.toLowerCase() !== "no explanation.") {
  preview += `\n💡 ${explanation}`;
}
preview += `\n\n`;
}
 else {
      const options = Array.from(block.querySelectorAll("ul li")).map((li, i) => {
        let text = li.textContent.trim();
        return `${String.fromCharCode(65 + i)}) ${text}`;
      }).join("\n");

      preview += `${qNum}. ${questionText}\n${options}\n✅ Answer: ${answer}\n💡 ${explanation}\n\n`;
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


function reviewUnknownFlashcards() {
  const unknownCards = flashcards.filter(card => !card.isAnswered || !card.wasKnown);

  if (unknownCards.length === 0) {
    alert("🎉 You've marked all flashcards as known!");
    return;
  }

  flashcards = unknownCards.map(card => ({
    ...card,
    isAnswered: false
  }));

  currentFlashcardIndex = 0;
  knownCount = 0;
  answeredCount = 0;

  document.getElementById("flashcardGameSection").style.display = "block";
  document.getElementById("flashcardResultSection").style.display = "none";

  renderFlashcard();
}


function startQuizMode() {
  // ✅ Sync checkbox states from main UI to modal copy
  syncVisitorSelections();

  // 🧠 Use modal (which is used by export/preview) for selected questions
  quizBlocks = Array.from(document.querySelectorAll("#modalQuestionList .question-card"))
    .filter(block => block.querySelector("input[type='checkbox']")?.checked)
    .filter(block => block.dataset.source !== "keyword");

  if (quizBlocks.length === 0) {
    alert("⚠️ No MCQ questions selected for the quiz.");
    return;
  }

  selectedAnswers = new Array(quizBlocks.length).fill(null);
  correctAnswers = quizBlocks.map(block =>
    block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim()
  );
  currentIndex = 0;
  inRetryMode = false;

  const quizContainer = document.createElement("div");
  quizContainer.id = "quizModal";
  quizContainer.style.cssText = `
    position:fixed; top:0; left:0; width:100%; height:100%;
    background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center;
    z-index:9999;
  `;

  quizBox = document.createElement("div");
  quizBox.id = "quizBox";
  quizBox.style.cssText = `
    background:white; padding:20px; border-radius:12px; width:95%; max-width:700px;
    max-height:90vh; overflow:auto; position:relative;
  `;

  quizContainer.appendChild(quizBox);
  document.body.appendChild(quizContainer);

  renderQuestion();

  // ✅ Ensure MathJax renders any LaTeX content
  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise([quizBox]);
  }
}


function renderQuestion() {
  const block = quizBlocks[currentIndex];
  const questionText = block.querySelector("summary .q[data-key='question']")?.dataset.latex?.trim()
    || block.querySelector("summary .q[data-key='question']")?.textContent.trim()
    || `Question ${currentIndex + 1}`;

  const options = Array.from(block.querySelectorAll("ul li")).map(li =>
    li.dataset.latex?.trim() || li.textContent.trim().replace(/^[A-D]\)\s*/, "")
  );

  const savedAnswer = selectedAnswers[currentIndex];

  quizBox.innerHTML = `
    <button onclick="document.body.removeChild(document.getElementById('quizModal'))"
            style="position:absolute; top:10px; right:10px; background:#ef4444; color:white; border:none; padding:6px 10px; border-radius:6px;">✖️ Exit</button>
    ${inRetryMode ? `<p style="font-size:14px; color:#6366f1; font-weight:bold;">🔁 Retry Mode</p>` : ""}
    <p style="font-size:14px; color:#6b7280;">Question ${currentIndex + 1} of ${quizBlocks.length}</p>
    <h3 style="font-size:20px; margin-bottom:16px;">${questionText}</h3>

    <div id="quizOptions" style="display:flex; flex-direction:column; gap:10px; margin-bottom:20px;">
      ${options.map((opt, i) => `
        <button class="quiz-option" data-value="${opt.replace(/"/g, '&quot;')}" style="
          padding:10px; border:1px solid #ccc; border-radius:8px;
          text-align:left; background:white; color:black; font-size:16px;">
          ${String.fromCharCode(65 + i)}) ${opt}
        </button>
      `).join("")}
    </div>
    <div style="text-align:center;">
      <button id="prevBtn" ${currentIndex === 0 ? 'disabled' : ''} style="margin:10px; padding:10px 14px;">⬅️ Previous</button>
      <button id="nextBtn" ${savedAnswer ? '' : 'disabled'} style="margin:10px; padding:10px 14px;">${currentIndex === quizBlocks.length - 1 ? '✅ Finish' : '➡️ Next'}</button>
    </div>
  `;

  const optionButtons = quizBox.querySelectorAll(".quiz-option");
  optionButtons.forEach(btn => {
    const value = btn.dataset.value;
    if (value === savedAnswer) {
      btn.style.background = "#dbeafe";
      btn.style.color = "#1e3a8a";
    }

    btn.onclick = () => {
      selectedAnswers[currentIndex] = value;
      optionButtons.forEach(b => {
        b.style.background = "white";
        b.style.color = "black";
      });
      btn.style.background = "#dbeafe";
      btn.style.color = "#1e3a8a";
      document.getElementById("nextBtn").disabled = false;
    };
  });

  document.getElementById("prevBtn").onclick = () => {
    if (currentIndex > 0) {
      currentIndex--;
      renderQuestion();
    }
  };

  document.getElementById("nextBtn").onclick = () => {
    if (currentIndex < quizBlocks.length - 1) {
      currentIndex++;
      renderQuestion();
    } else {
      showQuizResult();
    }
  };

  // ✅ Re-render LaTeX
  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise([quizBox]);
  }
}


function showQuizResult() {
  let correct = 0;
  const resultsHtml = [];
  const incorrectIndices = [];

  selectedAnswers.forEach((userAns, i) => {
    const block = quizBlocks[i];

    const question = block.querySelector("summary .q[data-key='question']")?.dataset.latex?.trim()
      || block.querySelector("summary .q[data-key='question']")?.textContent?.trim()
      || `Question ${i + 1}`;

    const correctAns = correctAnswers[i];

    const explanationEl = block.querySelector("p:nth-of-type(2)") || block.querySelector(".q[data-key='explanation']");
    const explanation = explanationEl?.dataset.latex?.trim()
      || explanationEl?.textContent?.replace(/^💡 Explanation:\s*/, "")
      || "No explanation provided.";

    const isCorrect = userAns === correctAns;
    if (!isCorrect) incorrectIndices.push(i);
    if (isCorrect) correct++;

    resultsHtml.push(`
      <div class="mcq-result-card" style="opacity:0; transform:translateY(20px); transition:all 0.4s ease; margin-bottom:16px; padding:14px; border-radius:10px; background:${isCorrect ? '#e0ffe0' : '#ffe0e0'};">
        <strong>Q${i + 1}:</strong> ${question}<br/>
        <strong>Your Answer:</strong> ${userAns || "<em>No answer</em>"}<br/>
        <strong>Correct Answer:</strong> ${correctAns}<br/>
        <strong>💡 Explanation:</strong> ${explanation}
      </div>
    `);
  });

  const score = Math.round((correct / quizBlocks.length) * 100);

  quizBox.innerHTML = `
    <h2 style="font-size:28px;">🎉 Quiz Completed</h2>
    <p style="font-size:20px;">✅ Correct: ${correct} / ${quizBlocks.length}</p>
    <p style="font-size:22px; margin-top:12px;">Your Score: <strong>${score}%</strong></p>
    <div id="mcqResultScroll" style="max-height:50vh; overflow:auto; margin-top:20px;">${resultsHtml.join("")}</div>
    <div style="text-align:center; margin-top:20px;">
      ${incorrectIndices.length > 0 ? `
        <button onclick='retryIncorrectMCQQuiz(${JSON.stringify(incorrectIndices)})'
                style="margin-right:10px; padding:10px 18px; background:#6366f1; color:white; border:none; border-radius:8px;">🔁 Retry Incorrect</button>
      ` : ""}
      <button onclick="document.body.removeChild(document.getElementById('quizModal')); setTimeout(startQuizMode, 100);" 
              style="padding:10px 18px; background:#10b981; color:white; border:none; border-radius:8px;">🔁 Restart All</button>
      <button onclick="document.body.removeChild(document.getElementById('quizModal'))"
              style="margin-left:10px; padding:10px 18px; background:#ef4444; color:white; border:none; border-radius:8px;">✖️ Close</button>
    </div>
  `;

  // 🌀 Animate cards + scroll to first incorrect
  setTimeout(() => {
    const cards = quizBox.querySelectorAll(".mcq-result-card");
    let firstWrongCard = null;
    cards.forEach((card, i) => {
      setTimeout(() => {
        card.style.opacity = 1;
        card.style.transform = "translateY(0)";
        if (incorrectIndices.includes(i) && !firstWrongCard) {
          firstWrongCard = card;
        }
      }, i * 60);
    });

    if (firstWrongCard) {
      const scrollBox = document.getElementById("mcqResultScroll");
      scrollBox.scrollTop = firstWrongCard.offsetTop - scrollBox.offsetTop;
    }
  }, 100);

  // ✅ Re-render LaTeX after DOM content inserted
  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise([quizBox]);
  }
}



function retryIncorrectQuiz(indices) {
  quizBlocks = indices.map(i => quizBlocks[i]);
  selectedAnswers = indices.map(i => selectedAnswers[i]);
  correctAnswers = quizBlocks.map(block =>
    block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim()
  );
  currentIndex = 0;
  inRetryMode = true;

  renderQuestion();
}

function retryIncorrectMCQQuiz(indices) {
  quizBlocks = indices.map(i => quizBlocks[i]);
  selectedAnswers = new Array(quizBlocks.length).fill(null);
  correctAnswers = quizBlocks.map(block =>
    block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim()
  );
  currentIndex = 0;
  inRetryMode = true;

  renderQuestion();
}

// fillin

function FillQuiz() {
  let blocks = Array.from(document.querySelectorAll("#modalQuestionList .question-card"))
    .filter(block => block.querySelector("input[type='checkbox']")?.checked)
    .filter(block => block.dataset.source === "keyword");

  if (blocks.length === 0) {
    alert("⚠️ No flashcard-style questions selected.");
    return;
  }

  // Shuffle blocks
  for (let i = blocks.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
  }

  let currentIndex = 0;
  let fillAnswers = new Array(blocks.length).fill("");
  let answered = new Array(blocks.length).fill(false);
  let hintStates = new Array(blocks.length).fill(0);
  let incorrectIndices = [];
  let score = 0;

  const container = document.createElement("div");
  container.id = "fillQuizModal";
  container.style.cssText = "position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.5); display:flex; justify-content:center; align-items:center; z-index:9999;";
  const inner = document.createElement("div");
  inner.style.cssText = "background:white; padding:24px; border-radius:12px; width:90%; max-width:700px; max-height:90vh; overflow:auto; position:relative;";
  container.appendChild(inner);
  document.body.appendChild(container);

  function normalize(str) {
    return str.toLowerCase().trim();
  }

  function levenshtein(a, b) {
    const dp = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
        else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
    return dp[a.length][b.length];
  }

  function isCloseEnough(input, correct) {
    const normInput = normalize(input);
    const normCorrect = normalize(correct);
    return normInput === normCorrect || levenshtein(normInput, normCorrect) <= 2;
  }

  function getHintDisplay(answer, hintCount) {
    let visible = 0;
    return answer
      .split('')
      .map(ch => {
        if (ch === ' ') return '/';
        if (visible < hintCount) {
          visible++;
          return `<span style="color:#16a34a; font-weight:bold;">${ch}</span>`;
        }
        return '_';
      })
      .join(' ');
  }

  function renderFillQuestion() {
    const block = blocks[currentIndex];
    const keywordRaw = block.querySelector("summary .q[data-key='question']")?.textContent.trim() || "";
    const correct = keywordRaw.replace(/^(\d+\.\s*)?(✅\s*)?(Answer|Cevap):\s*/i, "").trim();
    const explanationRaw = block.querySelector("p:nth-of-type(1)")?.textContent || "";
    const explanation = explanationRaw.replace(/^(\d+\.\s*)?(✅\s*)?(Answer|Cevap):\s*/i, "").replace(/^💡\s*Explanation:\s*/i, "").trim();
    const prevAnswer = fillAnswers[currentIndex];
    const hintCount = hintStates[currentIndex];
    const isAnswered = answered[currentIndex];

    inner.innerHTML = `
      <button onclick="document.body.removeChild(document.getElementById('fillQuizModal'))"
              style="position:absolute; top:10px; right:10px; background:#ef4444; color:white; padding:6px 10px; border-radius:6px;">✖️ Exit</button>
      <p style="font-size:14px; color:#6b7280; margin-bottom:8px;">Question ${currentIndex + 1} of ${blocks.length}</p>
      <h3 style="font-size:20px;">${explanation}</h3>
      <p style="margin-top:8px; color:#64748b;">💡 Hint: <span id="hintLetters">${getHintDisplay(correct, hintCount)}</span></p>
      <input type="text" id="fillInput" value="${prevAnswer}" placeholder="Type your answer..." 
             ${isAnswered ? "readonly" : ""} 
             style="margin-top:12px; padding:10px; width:100%; font-size:16px; border-radius:8px; border:1px solid #ccc;" />
      <div id="feedbackArea" style="margin-top:12px; font-size:16px;">
        ${isAnswered ? `
          <p><strong>${correct}</strong></p>
          <p style="color:${isCloseEnough(prevAnswer, correct) ? 'green' : 'red'}; font-weight:bold;">
            ${isCloseEnough(prevAnswer, correct) ? '✔️ Correct!' : '❌ Incorrect'}
          </p>` : ""}
      </div>
      <div style="margin-top:20px; text-align:center;">
        ${currentIndex > 0 ? `<button id="prevFillBtn" style="padding:10px 16px; margin-right:10px;">⬅️ Previous</button>` : ""}
        <button id="hintBtn" style="padding:10px 16px; background:#f59e0b; color:white; border:none; border-radius:8px;">💬 Hint</button>
        <button id="checkFillBtn" style="padding:10px 16px; background:#3b82f6; color:white; border:none; border-radius:8px;">✅ Check</button>
        <button id="nextFillBtn" ${isAnswered ? "" : "disabled"} style="padding:10px 16px; margin-left:10px;">
          ${currentIndex === blocks.length - 1 ? "✅ Finish" : "➡️ Next"}
        </button>
      </div>
    `;

    if (document.getElementById("prevFillBtn")) {
      document.getElementById("prevFillBtn").onclick = () => {
        currentIndex--;
        renderFillQuestion();
      };
    }

    document.getElementById("nextFillBtn").onclick = () => {
      if (currentIndex < blocks.length - 1) {
        currentIndex++;
        renderFillQuestion();
      } else {
        renderFillResults();
      }
    };

    document.getElementById("hintBtn").onclick = () => {
      if (hintStates[currentIndex] < correct.replace(/ /g, '').length) {
        hintStates[currentIndex]++;
        document.getElementById("hintLetters").innerHTML = getHintDisplay(correct, hintStates[currentIndex]);
      } else {
        document.getElementById("hintBtn").disabled = true;
      }
    };

    document.getElementById("checkFillBtn").onclick = () => {
      const inputVal = document.getElementById("fillInput").value.trim();
      if (inputVal === "") {
        alert("✏️ Please type something before checking.");
        document.getElementById("fillInput").focus();
        return;
      }

      fillAnswers[currentIndex] = inputVal;
      const isCorrect = isCloseEnough(inputVal, correct);
      if (!isCorrect && !incorrectIndices.includes(currentIndex)) {
        incorrectIndices.push(currentIndex);
      }
      if (isCorrect && !answered[currentIndex]) {
        score++;
      }

      answered[currentIndex] = true;
      renderFillQuestion();
    };
  }

  function renderFillResults() {
    let resultCards = "";
    let firstWrongIndex = -1;

    blocks.forEach((block, i) => {
      const userAns = fillAnswers[i]?.trim() || "<em>no answer</em>";
      const correctAns = block.querySelector("summary .q[data-key='question']")?.textContent.replace(/^(\d+\.\s*)?(✅\s*)?(Answer|Cevap):\s*/i, "").trim();
      const explanation = (block.querySelector("p:nth-of-type(1)") || block.querySelector(".q[data-key='explanation']"))?.textContent.replace(/^💡\s*Explanation:\s*/i, "").trim() || "No explanation.";
      const isCorrect = isCloseEnough(userAns, correctAns);
      const bgColor = isCorrect ? "#e0ffe0" : "#ffe0e0";

      if (!isCorrect && firstWrongIndex === -1) firstWrongIndex = i;

      resultCards += `
        <div class="result-card" style="opacity:0; transform:translateY(20px); transition:all 0.4s ease; margin-bottom:14px; padding:12px 14px; border-radius:8px; background:${bgColor};">
          <p><strong>Q${i + 1}:</strong> ${explanation}</p>
          <p><strong>Your Answer:</strong> ${userAns}</p>
          <p><strong>Correct Answer:</strong> ${correctAns}</p>
        </div>
      `;
    });

    inner.innerHTML = `
      <h2 style="font-size:26px;">🎉 Fill-in Quiz Completed</h2>
      <p style="font-size:20px;">✅ Score: ${score} / ${blocks.length}</p>
      <div id="resultScrollBox" style="max-height:50vh; overflow:auto; margin-top:20px; padding-right:10px;">
        ${resultCards}
      </div>
    <div style="text-align:center; margin-top:20px;">
  ${incorrectIndices.length > 0 ? `<button onclick="retryIncorrectMCQQuiz(${JSON.stringify(incorrectIndices)})"
    style="margin-right:10px; padding:10px 18px; background:#6366f1; color:white; border:none; border-radius:8px;">🔁 Retry Incorrect</button>` : ""}
  <button onclick="startQuizMode()" style="padding:10px 18px; background:#10b981; color:white; border:none; border-radius:8px;">🔁 Restart All</button>
  <button onclick="document.body.removeChild(document.getElementById('quizModal'))"
          style="margin-left:10px; padding:10px 18px; background:#ef4444; color:white; border:none; border-radius:8px;">✖️ Close</button>
</div>
    `;

    setTimeout(() => {
      const cards = inner.querySelectorAll(".result-card");
      cards.forEach((card, i) => {
        setTimeout(() => {
          card.style.opacity = 1;
          card.style.transform = "translateY(0)";
        }, i * 60);
      });

      if (firstWrongIndex >= 0) {
        const scrollBox = document.getElementById("resultScrollBox");
        const targetCard = cards[firstWrongIndex];
        if (targetCard) scrollBox.scrollTop = targetCard.offsetTop - scrollBox.offsetTop;
      }
    }, 100);
  }

  window.retryIncorrectFillQuiz = function () {
    const retryBlocks = incorrectIndices.map(i => blocks[i]);
    document.body.removeChild(document.getElementById("fillQuizModal"));
    setTimeout(() => FillQuizRetry(retryBlocks), 100);
  };

  renderFillQuestion();
}

function FillQuizRetry(retryBlocks) {
  const fakeCheckboxes = new Set(retryBlocks);
  document.querySelectorAll("#modalQuestionList .question-card input[type='checkbox']").forEach(checkbox => {
    checkbox.checked = fakeCheckboxes.has(checkbox.closest(".question-card"));
  });
  FillQuiz();
}


function enhanceQuestionCardBadges() {
  const cards = document.querySelectorAll(".question-card");

  cards.forEach(card => {
    const source = card.dataset.source;
    const icon = document.createElement("div");
    icon.style.position = "absolute";
    icon.style.top = "8px";
    icon.style.right = "8px";
    icon.style.fontSize = "14px";
    icon.style.padding = "2px 6px";
    icon.style.borderRadius = "6px";
    icon.style.fontWeight = "bold";
    icon.style.zIndex = "2";

    if (source === "keyword") {
      icon.textContent = "🔑";
      icon.style.background = "#fef3c7";
      icon.style.color = "#92400e";
    } else {
      icon.textContent = "📝";
      icon.style.background = "#dbeafe";
      icon.style.color = "#1e3a8a";
    }

    card.style.position = "relative";
    card.appendChild(icon);
  });
}

function addQuestionTypeFilter() {
  const panel = document.getElementById("questionControlPanel");
  if (!panel || document.getElementById("typeFilterContainer")) return;

  const filterDiv = document.createElement("div");
  filterDiv.id = "typeFilterContainer";
  filterDiv.style.marginTop = "10px";
  filterDiv.innerHTML = `
    <label><input type="radio" name="qtype" value="all" checked> Show All</label>
    <label style="margin-left:10px;"><input type="radio" name="qtype" value="keyword"> 🔑 Keyword-Based</label>
    <label style="margin-left:10px;"><input type="radio" name="qtype" value="mcq"> 📝 Multiple Choice</label>
  `;

  panel.appendChild(filterDiv);

filterDiv.querySelectorAll("input[name='qtype']").forEach(radio => {
  radio.addEventListener("change", () => {
    const value = document.querySelector("input[name='qtype']:checked").value;

    document.querySelectorAll(".question-card").forEach(card => {
      const type = card.dataset.source;
      const show = value === "all" || value === type;

      card.style.display = show ? "" : "none";

      // ✅ Select visible, unselect hidden
      const checkbox = card.querySelector("input[type='checkbox']");
      if (checkbox) checkbox.checked = show;
    });
  });
});

}

// 🧩 Run this after loading questions (e.g. after loadQuestionsByTitleName)
function enhanceQuestionViewAfterLoad() {
  enhanceQuestionCardBadges();
  addQuestionTypeFilter();
}
function syncVisitorSelections() {
  const outputCards = document.querySelectorAll("#quizOutput .question-card");
  const modalCards = document.querySelectorAll("#modalQuestionList .question-card");

  outputCards.forEach((outputCard, i) => {
    const outputCheck = outputCard.querySelector("input.qcheck");
    const modalCheck = modalCards[i]?.querySelector("input.qcheck");

    if (outputCheck && modalCheck) {
      modalCheck.checked = outputCheck.checked;
    }
  });
}

function printPreviewContent() {
    syncVisitorSelections();
  const container = document.getElementById("modalQuestionList");
  const selectedBlocks = Array.from(container.querySelectorAll("details")).filter(block =>
    block.querySelector("input[type='checkbox']")?.checked
  );

  if (selectedBlocks.length === 0) {
    alert("⚠️ No questions selected.");
    return;
  }

  // ✅ Title detection from various places
  const title =
    window.currentTitleName ||
    document.querySelector("#titleList .selected")?.textContent?.trim() ||
    document.querySelector(".title-item.selected")?.textContent?.trim() ||
    "Quiz";

  let questionHTML = `<h1 style="text-align:center; margin-bottom:40px;">📝 ${title}</h1>`;
  let answerHTML = `<h2 style="margin-top:60px; text-align:center; page-break-before: always;">=== ANSWERS ===</h2>`;

  selectedBlocks.forEach((block, index) => {
    const qNum = index + 1;

    const questionSpan = block.querySelector("summary .q[data-key='question']") || block.querySelector("summary");
    const questionText = questionSpan?.dataset.latex || questionSpan?.textContent.trim() || `Question ${qNum}`;

    const optionsList = Array.from(block.querySelectorAll("ul li"));
    const options = optionsList.map((li, i) => {
      const text = li.dataset.latex || li.textContent.trim();
      return `<div>${String.fromCharCode(65 + i)}) <span class="math">${text}</span></div>`;
    }).join("");

    // ✅ Get the answer from <p>
    const answerText = block.querySelector("p:nth-of-type(1)")?.dataset.latex ||
                       block.querySelector("p:nth-of-type(1)")?.textContent.replace(/^✅ Answer:\s*/, "").trim() ||
                       "No answer";

    // ✅ Find which option matches the answer
    let correctLetter = "?";
    let matchedAnswer = answerText;

    for (let i = 0; i < optionsList.length; i++) {
      const opt = optionsList[i];
      const optText = opt.dataset.latex || opt.textContent.replace(/^✅\s*/, "").trim();
      if (optText === answerText) {
        correctLetter = String.fromCharCode(65 + i);
        matchedAnswer = optText;
        break;
      }
    }

    // ✅ Get explanation
    let explanation = "No explanation.";
    const explanationEl = block.querySelector("p:nth-of-type(2)") || block.querySelector(".q[data-key='explanation']");
    if (explanationEl) {
      explanation = explanationEl.dataset.latex || explanationEl.textContent.replace(/^💡 Explanation:\s*/, "").trim();
    }

    // Add to question section
    questionHTML += `
      <div class="question-block" style="margin-bottom:24px; page-break-inside: avoid;">
        <strong>${qNum}.</strong> <span class="math">${questionText}</span>
        <div style="margin-left:16px; margin-top:6px;">${options}</div>
      </div>
    `;

    // Add to answer section
    answerHTML += `
      <div class="answer-block" style="margin-bottom:18px; page-break-inside: avoid;">
        <strong>${qNum}.</strong> ✅ <span class="math">${correctLetter}) ${matchedAnswer}</span><br/>
        ${explanation !== "No explanation." ? `💡 <span class="math">${explanation}</span>` : ""}
      </div>
    `;
  });

  const finalHTML = `
    <div id="print-content">
      ${questionHTML}
      ${answerHTML}
    </div>
  `;

  // 📄 Render in iframe and print
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.right = "100%";
  iframe.style.width = "0";
  iframe.style.height = "0";

  iframe.onload = () => {
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Preview</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 40px;
              line-height: 1.6;
            }
            h1, h2 {
              text-align: center;
            }
            .question-block, .answer-block {
              page-break-inside: avoid;
            }
          </style>
          <script>
            window.MathJax = {
              tex: { inlineMath: [['$', '$'], ['\\\\(', '\\\\)']] },
              svg: { fontCache: 'global' },
              startup: {
                ready: () => {
                  MathJax.startup.defaultReady();
                  MathJax.typesetPromise().then(() => {
                    setTimeout(() => window.print(), 300);
                  });
                }
              }
            };
          </script>
          <script src="https://cdn.jsdelivr.net/npm/mathjax@3/es5/tex-mml-chtml.js"></script>
        </head>
        <body>
          ${finalHTML}
        </body>
      </html>
    `);
    doc.close();
  };

  document.body.appendChild(iframe);
}




