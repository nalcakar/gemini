

// 🧠 Ensure a stable anonymous visitor ID is created and stored
if (!localStorage.getItem("visitorId")) {
  const id = "v_" + Math.random().toString(36).substring(2, 12);
  localStorage.setItem("visitorId", id);
}
const VISITOR_ID = localStorage.getItem("visitorId");


async function generateVisitorQuestions() {
  const extractedText = getCurrentSectionText();
  if (!extractedText || extractedText.length < 3) {
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

   if (res.status === 429) {
  showPatreonUpgradePrompt(data.usage?.max || 30);
  return;
}
if (!res.ok) throw new Error(data.error || "Unknown error");


    displayGeneratedQuestions(data.questions);
    updateVisitorUsageBadge(data.usage);
  } catch (err) {
    alert("❌ " + err.message);
  }
  document.getElementById("visitorOutputOptions").style.display = "block";
document.getElementById("visitorAdvantages").style.display = "block";

}

async function generateVisitorKeywords() {
  const extractedText = getCurrentSectionText();
  if (!extractedText || extractedText.length < 3) {
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

    if (res.status === 429) {
  showPatreonUpgradePrompt(data.usage?.max || 30);
  return;
}
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

  const modalList = document.getElementById("modalQuestionList");
  if (modalList) modalList.innerHTML = "";

  questions.forEach((q, i) => {
    const details = document.createElement("details");
    details.className = "quiz-preview question-card";
    details.style.maxWidth = "700px";
    details.style.margin = "15px auto";
    details.dataset.source = "mcq";
    details.dataset.index = i;

    const badge = q.difficulty === "easy" ? "🟢 Easy"
                : q.difficulty === "hard" ? "🔴 Hard"
                : "🟡 Medium";

    const questionHTML = `<span class="q" data-key="question">${q.question}</span>`;
    const optionsHTML = q.options.map((opt, j) =>
      `<li class="q" data-key="option${j + 1}">${opt}</li>`
    ).join("");
    const answerHTML = `<span class="q" data-key="answer">${q.answer}</span>`;
    const explanationHTML = `<span class="q" data-key="explanation">${q.explanation}</span>`;

    details.innerHTML = `
      <summary style="display:flex; justify-content: space-between; align-items:center;">
        <div style="flex-grow:1;"><b>Q${i + 1}.</b> ${questionHTML}</div>
        <label style="margin-left:10px;"><input type="checkbox" class="qcheck" checked /> ✅</label>
      </summary>
      <div style="margin-top: 8px; padding: 8px;">
        <ul>${optionsHTML}</ul>
        <p><strong>✅ Answer:</strong> ${answerHTML}</p>
        <p><strong>💡 Explanation:</strong> ${explanationHTML}</p>
        <p class="difficulty-line" data-level="${q.difficulty}"><strong>Difficulty:</strong> ${badge}</p>
      </div>
    `;

    output.appendChild(details);

    // ✅ Also clone for export/flashcard modal
    if (modalList) {
      const clone = details.cloneNode(true);
      modalList.appendChild(clone);
    }
  });

  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise();
  }

  // ✅ Show export/flashcard buttons
  const exportBox = document.getElementById("visitorOutputOptions");
  if (exportBox) exportBox.style.display = "block";
}



function updateVisitorUsageBadge(usage) {
  const badge = document.getElementById("visitorUsageBadge");
  if (badge && usage?.count != null) {
    badge.textContent = `🎯 Visitor Usage: ${usage.count} / ${usage.max}`;
  }
}


function showPatreonUpgradePrompt(maxLimit) {
  const badge = document.getElementById("visitorUsageBadge");
  if (!badge) return;

  badge.innerHTML = `
    🚫 Daily Limit of ${maxLimit} questions reached.<br>
    <span style="margin-top:6px; display:inline-block;">
      👉 <a href="https://www.patreon.com/bePatron?u=YOUR_PATREON_USER_ID" target="_blank"
        style="padding: 6px 12px; background: #ec4899; color: white; font-weight: bold; border-radius: 8px; text-decoration: none;">
        💎 Join Patreon for Unlimited Access
      </a>
    </span>
  `;
}


function showVisitorPreviewModal(type) {
  const container = document.getElementById("modalQuestionList");
  if (!container) return alert("⚠️ No questions loaded.");

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
      preview += `${qNum}. ${questionText}\n______________________\n✅ Answer: ${answer}\n💡 ${explanation}\n\n`;
    } else {
      const options = Array.from(block.querySelectorAll("ul li")).map((li, i) => {
        let text = li.textContent.trim();
        return `${String.fromCharCode(65 + i)}) ${text}`;
      }).join("\n");

      preview += `${qNum}. ${questionText}\n${options}\n✅ Answer: ${answer}\n💡 ${explanation}\n\n`;
    }
  });

  document.getElementById("previewContent").textContent = preview;
  document.getElementById("exportPreviewModal").style.display = "block";
  window.pendingExportType = type;
}


function exportVisitorAsTXT() {
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
      questionsPart += `${qNumber}. ${questionText}\n______________________\n\n`;
      answersPart += `${qNumber}. ✅ Answer: ${answerText}\n💡 ${explanationText}\n\n`;
    } else {
      questionsPart += `${qNumber}. ${questionText}\n`;
      const options = Array.from(block.querySelectorAll("ul li")).map((li, idx) => {
        return `${String.fromCharCode(65 + idx)}) ${li.textContent.trim()}`;
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
  a.download = "visitor_questions.txt";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


function openVisitorFlashcards() {
  const blocks = document.querySelectorAll("#modalQuestionList .question-card");

  const selected = Array.from(blocks).filter(block => {
    const checkbox = block.querySelector("input[type='checkbox']");
    return checkbox?.checked;
  });

  if (selected.length === 0) {
    alert("⚠️ No flashcards selected.");
    return;
  }

  window.flashcards = selected.map((block, i) => {
    const source = block.dataset.source || "mcq";
    const question = block.querySelector("summary .q[data-key='question']")?.textContent.trim() || `Q${i + 1}`;
    const rawAnswer = block.querySelector("p:nth-of-type(1)")?.textContent || "Answer not found.";
    const answer = rawAnswer.replace(/^✅?\s*Answer:\s*/i, "").trim();

    return source === "keyword"
      ? { front: answer, back: question, isAnswered: false }
      : { front: question, back: answer, isAnswered: false };
  });

  window.currentFlashcardIndex = 0;
  window.knownCount = 0;
  window.answeredCount = 0;

  document.getElementById("flashcardModal").style.display = "block";
  renderFlashcard(); // assumes renderFlashcard() is defined globally
}

function confirmExport(type) {
  document.getElementById("exportPreviewModal").style.display = "none";
  if (type === "txt") {
    exportVisitorAsTXT();
  } else {
    alert("❌ Only TXT export is supported for visitors currently.");
  }
}

function renderFlashcard() {
  const card = window.flashcards[window.currentFlashcardIndex];
  if (!card) return;

  const inner = document.getElementById("flashcardInner");
  inner.style.transform = "rotateY(0deg)";

  document.getElementById("flashcardFrontContent").innerHTML = `<b>${card.front}</b>`;
  document.getElementById("flashcardBackContent").innerHTML = `<i>${card.back}</i>`;

  document.getElementById("flashcardFrontContent").style.display = "block";
  document.getElementById("flashcardBackContent").style.display = "none";

  document.getElementById("flashcardCounter").textContent =
    `🃏 Card ${window.currentFlashcardIndex + 1} of ${window.flashcards.length}`;
  document.getElementById("flashcardScore").textContent =
    `✅ Knew: ${window.knownCount} / ❌ Didn't Know: ${window.answeredCount - window.knownCount}`;
}


function flipFlashcard() {
  const inner = document.getElementById("flashcardInner");
  const front = document.getElementById("flashcardFrontContent");
  const back = document.getElementById("flashcardBackContent");

  const isFlipped = inner.style.transform === "rotateY(180deg)";
  inner.style.transform = isFlipped ? "rotateY(0deg)" : "rotateY(180deg)";

  if (isFlipped) {
    front.style.display = "block";
    back.style.display = "none";
  } else {
    front.style.display = "none";
    back.style.display = "block";
  }
}



function nextFlashcard() {
  if (window.currentFlashcardIndex < window.flashcards.length - 1) {
    window.currentFlashcardIndex++;
    renderFlashcard();
  } else {
    alert("🎉 You’ve reached the last card!");
  }
}

function prevFlashcard() {
  if (window.currentFlashcardIndex > 0) {
    window.currentFlashcardIndex--;
    renderFlashcard();
  } else {
    alert("⏮ This is the first card.");
  }
}

function markKnown(knewIt) {
  const index = window.currentFlashcardIndex;
  if (!window.flashcards[index].isAnswered) {
    window.answeredCount++;
    if (knewIt) window.knownCount++;
    window.flashcards[index].isAnswered = true;
  }
  nextFlashcard();
}

window.confirmExport = confirmExport;
window.flipFlashcard = flipFlashcard;
window.prevFlashcard = prevFlashcard;
window.nextFlashcard = nextFlashcard;
window.markKnown = markKnown;
window.renderFlashcard = renderFlashcard;
window.exportVisitorAsWord = exportVisitorAsWord;


async function exportVisitorAsWord() {
  const container = document.getElementById("modalQuestionList");
  if (!container) return alert("⚠️ No questions loaded.");

  const selectedBlocks = Array.from(container.querySelectorAll("details")).filter(block =>
    block.querySelector("input[type='checkbox']")?.checked
  );

  if (selectedBlocks.length === 0) {
    alert("⚠️ No questions selected.");
    return;
  }

  const docxLib = window.docx || window.DOCX || {};
const { Document, Packer, Paragraph, TextRun } = docxLib;

if (!Document || !Packer) {
  alert("❌ DOCX library failed to load. Please check your internet or try again later.");
  return;
}

  const doc = new Document();
  const questionParagraphs = [];
  const answerParagraphs = [];

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

      // Add question and options
      questionParagraphs.push(new Paragraph({ text: `${qNumber}. ${questionText}`, spacing: { after: 120 } }));
      options.forEach((li, idx) => {
        questionParagraphs.push(new Paragraph({ text: `${String.fromCharCode(65 + idx)}) ${li.textContent.trim()}` }));
      });
      questionParagraphs.push(new Paragraph("")); // spacing

      // Add answer and explanation
      answerParagraphs.push(new Paragraph({
        children: [
          new TextRun({ text: `${qNumber}. ✅ Correct Answer: ${answerText}${answerLetter}`, bold: true }),
        ]
      }));
      answerParagraphs.push(new Paragraph({ text: `💡 Explanation: ${explanationText}` }));
      answerParagraphs.push(new Paragraph(""));
    } else {
      // Keyword format
      questionParagraphs.push(new Paragraph({ text: `${qNumber}. ${questionText}`, spacing: { after: 120 } }));
      questionParagraphs.push(new Paragraph({ text: "______________________" }));
      questionParagraphs.push(new Paragraph(""));

      answerParagraphs.push(new Paragraph({ text: `${qNumber}. ✅ Answer: ${answerText}`, bold: true }));
      answerParagraphs.push(new Paragraph({ text: `💡 ${explanationText}` }));
      answerParagraphs.push(new Paragraph(""));
    }
  });

  doc.addSection({
    children: [
      new Paragraph({ text: "=== QUESTIONS ===", heading: "Heading1" }),
      ...questionParagraphs,
      new Paragraph({ text: "=== ANSWERS ===", heading: "Heading1", spacing: { before: 400 } }),
      ...answerParagraphs
    ]
  });

  const blob = await Packer.toBlob(doc);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "visitor_questions.docx";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}


function displayGeneratedKeywords(rawKeywords) {
  const output = document.getElementById("quizOutput");
  output.innerHTML = `<h3 style="text-align:center;">🧠 Extracted Keywords:</h3>`;

  const modalList = document.getElementById("modalQuestionList");
  if (modalList) modalList.innerHTML = "";

  // 🔍 Normalize input (string or array)
  let keywords = [];
  if (Array.isArray(rawKeywords)) {
    keywords = rawKeywords;
  } else if (typeof rawKeywords === "string") {
    const lines = rawKeywords.trim().split(/\n+/);
    for (const line of lines) {
      const cleaned = line.replace(/^[-*]\s*/, ""); // remove dash
      const [keyword, explanation] = cleaned.split(":").map(s => s.trim());
      if (keyword && explanation) {
        keywords.push({ keyword, explanation });
      }
    }
  } else {
    alert("⚠️ Unexpected keyword format.");
    return;
  }

  // ✅ Render each keyword block
  keywords.forEach((kw, i) => {
    const details = document.createElement("details");
    details.className = "quiz-preview question-card";
    details.style.maxWidth = "700px";
    details.style.margin = "15px auto";
    details.dataset.source = "keyword";
    details.dataset.index = i;

    const keywordHTML = `<span class="q" data-key="question">${kw.keyword}</span>`;
    const explanationHTML = `<span class="q" data-key="explanation">${kw.explanation}</span>`;

    details.innerHTML = `
      <summary style="display:flex; justify-content: space-between; align-items:center;">
        <div style="flex-grow:1;"><b>Q${i + 1}.</b> ${keywordHTML}</div>
        <label style="margin-left:10px;"><input type="checkbox" class="qcheck" checked /> ✅</label>
      </summary>
      <div style="margin-top: 8px; padding: 8px;">
        <p><strong>💡 Explanation:</strong> ${explanationHTML}</p>
      </div>
    `;

    output.appendChild(details);

    // ✅ Also add to export/flashcard modal
    if (modalList) {
      const clone = details.cloneNode(true);
      modalList.appendChild(clone);
    }
  });

  if (window.MathJax?.typesetPromise) {
    MathJax.typesetPromise();
  }

  const exportBox = document.getElementById("visitorOutputOptions");
  if (exportBox) exportBox.style.display = "block";
}

window.displayGeneratedKeywords = displayGeneratedKeywords;

function closeFlashcardModal() {
  const modal = document.getElementById("flashcardModal");
  if (modal) {
    modal.style.display = "none";
  }
}
window.closeFlashcardModal = closeFlashcardModal;

function handleDocxExport() {
  const tier = localStorage.getItem("membershipType");
  const isVisitor = !localStorage.getItem("accessToken");

  // ❌ Block if visitor or Bronze or Free
  if (isVisitor || tier === "Free" || tier === "25539224") {
    showSilverPromptModal(); // show the modal defined above
    return;
  }

  // ✅ Allow Silver and Gold
  exportVisitorAsWord();
}


window.handleDocxExport = handleDocxExport;

function triggerPremiumFeature(fileInputId) {
  const userTier = localStorage.getItem("membershipType");
  const paidTiers = ["25539224", "25296810", "25669215"];
  const isProUser = paidTiers.includes(userTier);

  if (isProUser) {
    document.getElementById(fileInputId)?.click();
  } else {
    const modal = document.getElementById("patreonJoinModal");
    if (modal) modal.style.display = "flex";
  }
}


window.triggerPremiumFeature = triggerPremiumFeature;


function showSilverPromptModal() {
  const modal = document.getElementById("silverUpgradeModal");
  if (modal) modal.style.display = "flex";
}

function closeSilverPromptModal() {
  const modal = document.getElementById("silverUpgradeModal");
  if (modal) modal.style.display = "none";
}