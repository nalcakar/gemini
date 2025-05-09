


function getCurrentSectionText() {
  const lastSection = localStorage.getItem("lastSection");

  // 🧠 Priority 1: If RECENT section active, check radio selection
  if (lastSection === "recent") {
    const selected = document.querySelector('input[name="recentTextChoice"]:checked');
    if (selected) {
      return decodeURIComponent(selected.value);
    }
  }

  // 🧠 Priority 2: If active topicInput
  if (lastSection === "topic") {
    const topicInput = document.getElementById("topicInput");
    if (topicInput && topicInput.value.trim().length > 0) {
      return topicInput.value.trim();
    }
  }

  // 🧠 Priority 3: Other general inputs
  const ids = [
    "textManualInput",
    "textOutput",
    "imageTextOutput",
    "audioTextOutput",
    "topicInput",
    "recentTextInput"
  ];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.offsetHeight > 0 && el.offsetWidth > 0 && el.value.trim().length > 0) {
      return el.value.trim();
    }
  }

  return ""; // nothing found
}


document.addEventListener("DOMContentLoaded", () => {
  const savedLang = localStorage.getItem("questionLangPref");
  if (savedLang) {
    const langSelect = document.getElementById("languageSelect");
    if (langSelect) langSelect.value = savedLang;
  }
});

function expandAllDetails(open = true) {
  document.querySelectorAll(".quiz-preview").forEach(d => d.open = open);
}


function showVisitorSaveUI(containerId, questions, isKeyword = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const saveUI = document.createElement("div");
  saveUI.style = "margin-top: 30px; text-align: center;";

  saveUI.innerHTML = `
    <div style="margin-bottom: 10px;">
      <input id="visitorTitleInput" type="text" placeholder="Enter a title to save..." 
        style="padding: 10px; width: 80%; max-width: 400px; border-radius: 8px; border: 1px solid #ccc; font-size: 15px;" />
    </div>
    <button id="visitorSaveButton" style="padding: 10px 20px; font-size: 15px; border-radius: 6px; background: #2563eb; color: white; border: none; cursor: pointer;">
      💾 Save Title
    </button>
  `;

  container.appendChild(saveUI);

  document.getElementById("visitorSaveButton").onclick = () => {
    const title = document.getElementById("visitorTitleInput").value.trim();
    if (!title) return alert("⚠️ Please enter a title.");

    const saved = saveCurrentVisitorQuestions(title, questions, isKeyword);
    if (saved) {
      renderVisitorSavedContent();
      saveUI.innerHTML = `<p style="color:green; font-weight:500;">✅ Saved as "<b>${title}</b>"</p>`;
    } else {
      alert("⚠️ You’ve reached your daily visitor limit (4 titles).");
    }
  };
}


async function generateFullQuiz() {
  const output = document.getElementById("quizOutput");
  if (output) output.innerHTML = "";

  const saveBox = document.getElementById("saveQuizSection");
  if (saveBox) {
    saveBox.style.display = "none";
    saveBox.style.opacity = "0";
    saveBox.dataset.loaded = "";
  }

  let extractedText = getCurrentSectionText();
  const lastSection = localStorage.getItem("lastSection");

  if (!extractedText || (lastSection !== "topic" && extractedText.trim().length < 10)) {
    alert("⚠️ Please paste or upload some text first.");
    return;
  }

  const button = event?.target || document.querySelector("#generateQuizButton");
  button.disabled = true;
  button.textContent = "⏳ Generating...";

  try {
    const accessToken = localStorage.getItem("accessToken") || "";
    const isLoggedIn = !!accessToken;

    const selectedLang = document.getElementById("languageSelect")?.value || "";
    const topicFocus = document.getElementById("topicFocus")?.value.trim() || "";
    const difficulty = document.getElementById("difficultySelect")?.value || "";

    localStorage.setItem("questionLangPref", selectedLang);

    const res = await fetch("https://gemini-j8xd.onrender.com/generate-questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({
        mycontent: extractedText,
        userLanguage: selectedLang,
        userFocus: topicFocus,
        difficulty
      }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.questions)) throw new Error("Invalid response from AI");

    const parsedQuestions = data.questions;

    const createControls = () => {
      const box = document.createElement("div");
      box.style = "margin: 10px 0; text-align: center;";
      box.innerHTML = `
        <button onclick="selectAllQuestions(true)">✅ Select All</button>
        <button onclick="selectAllQuestions(false)">❌ Clear Selections</button>
        <button onclick="expandAllDetails(true)">📖 Show All</button>
        <button onclick="expandAllDetails(false)">🔽 Collapse All</button>
      `;
      return box;
    };

    output.innerHTML = `<h3 style="text-align:center;">🎯 Generated Questions:</h3>`;
    const topControls = createControls();
    const bottomControls = createControls();
    output.appendChild(topControls);

    parsedQuestions.forEach((q, i) => {
      const details = document.createElement("details");
      details.className = "quiz-preview";
      details.style.maxWidth = "700px";
      details.style.margin = "15px auto";
      details.dataset.index = i;
      details.dataset.difficulty = q.difficulty;

      const badge = q.difficulty === "easy" ? "🟢 Easy" : q.difficulty === "hard" ? "🔴 Hard" : "🟡 Medium";

      details.innerHTML = `
        <summary style="display: flex; justify-content: space-between;">
          <div><b>Q${i + 1}:</b> ${q.question}</div>
          ${isLoggedIn ? `<label><input type="checkbox" class="qcheck" onchange="toggleHighlight(this)"> ✅</label>` : ""}
        </summary>
        <div style="padding: 8px;">
          <ul>${q.options.map(opt => `<li>${opt}</li>`).join("")}</ul>
          <p><strong>✅ Answer:</strong> ${q.answer}</p>
          <p><strong>💡 Explanation:</strong> ${q.explanation}</p>
          <p><strong>Difficulty:</strong> ${badge}</p>
          <div>
            <button onclick="editQuestion(this)">✏️ Edit</button>
            <button onclick="deleteQuestion(this)">🗑️ Delete</button>
          </div>
        </div>
      `;

      output.appendChild(details);
    });

    const newTitleInput = document.getElementById("newTitleInput");
    if (newTitleInput) newTitleInput.style.display = "none";

    output.appendChild(bottomControls);

    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise().catch(console.error);
    }

    if (isLoggedIn && saveBox) {
      saveBox.style.display = "block";
      saveBox.style.opacity = "1";

      if (!document.getElementById("saveInstructions")) {
        const msg = document.createElement("p");
        msg.id = "saveInstructions";
        msg.textContent = "🎉 Continue to save the questions you selected below.";
        msg.style = "font-weight: 500; font-size: 14px;";
        saveBox.insertBefore(msg, saveBox.firstChild);
      }

      if (!saveBox.dataset.loaded) {
        await loadMainTopics();
        saveBox.dataset.loaded = "true";
      }
    }

    // ✅ Always show save input/button for visitors
    if (!isLoggedIn) {
      setTimeout(() => showVisitorSaveUI("quizOutput", parsedQuestions, false), 300);
    }

  } catch (err) {
    console.error("❌ Error:", err);
    alert(`❌ Failed to generate questions.\\n${err.message}`);
  }

  button.disabled = false;
  button.textContent = "Generate Multiple Choice Questions";
  if (typeof updateFloatingButtonVisibility === "function") updateFloatingButtonVisibility();
}





// keywords***********
async function generateKeywords() {
  const output = document.getElementById("quizOutput");
  if (output) output.innerHTML = "";

  const saveBox = document.getElementById("saveQuizSection");
  if (saveBox) {
    saveBox.style.display = "none";
    saveBox.style.opacity = "0";
    saveBox.dataset.loaded = "";
  }

  const button = document.getElementById("generateKeywordsButton");
  button.disabled = true;
  button.textContent = "⏳ Generating Keywords...";

  let extractedText = getCurrentSectionText();
  if (!extractedText || extractedText.trim().length < 2) {
    alert("⚠️ Please paste or upload some text first.");
    button.disabled = false;
    button.textContent = "✨ Generate Keywords and Explanations";
    return;
  }

  try {
    const accessToken = localStorage.getItem("accessToken") || "";
    const isLoggedIn = !!accessToken;
    const selectedLang = document.getElementById("languageSelect")?.value || "";

    localStorage.setItem("questionLangPref", selectedLang);

    const res = await fetch("https://gemini-j8xd.onrender.com/generate-keywords", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`
      },
      body: JSON.stringify({ mycontent: extractedText, userLanguage: selectedLang }),
    });

    if (!res.ok) throw new Error(`Server error: ${res.status}`);
    const data = await res.json();

    const keywordEntries = (data.keywords || "")
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("-"))
      .map(line => {
        const [keyword, ...explanationParts] = line.substring(1).split(":");
        return {
          question: (keyword || "").trim(),
          answer: (explanationParts.join(":") || "").trim()
        };
      });

    output.innerHTML = `<h3 style="text-align:center;">🔑 Generated Keywords:</h3>`;

    const createControls = () => {
      const box = document.createElement("div");
      box.style = "margin: 10px 0; text-align: center;";
      box.innerHTML = `
        <button onclick="selectAllQuestions(true)">✅ Select All</button>
        <button onclick="selectAllQuestions(false)">❌ Clear Selections</button>
        <button onclick="expandAllDetails(true)">📖 Show All</button>
        <button onclick="expandAllDetails(false)">🔽 Collapse All</button>
      `;
      return box;
    };

    output.appendChild(createControls());

    keywordEntries.forEach((item, i) => {
      const details = document.createElement("details");
      details.className = "quiz-preview";
      details.style.maxWidth = "700px";
      details.style.margin = "15px auto";
      details.dataset.index = i;

      details.innerHTML = `
        <summary><b>Keyword ${i + 1}:</b> ${item.question}</summary>
        <div style="padding: 8px;">
          <p><strong>💬 Explanation:</strong> ${item.answer}</p>
        </div>
      `;
      output.appendChild(details);
    });

    output.appendChild(createControls());

    if (window.MathJax?.typesetPromise) {
      window.MathJax.typesetPromise().catch(console.error);
    }

    if (isLoggedIn && saveBox) {
      saveBox.style.display = "block";
      saveBox.style.opacity = "1";

      if (!document.getElementById("saveInstructions")) {
        const msg = document.createElement("p");
        msg.id = "saveInstructions";
        msg.textContent = "🎯 Select the keywords you want to save.";
        msg.style = "font-weight: 500; font-size: 14px;";
        saveBox.insertBefore(msg, saveBox.firstChild);
      }

      if (!saveBox.dataset.loaded) {
        await loadMainTopics();
        saveBox.dataset.loaded = "true";
      }
    }

    // ✅ Always show save input/button for visitors
    if (!isLoggedIn) {
      setTimeout(() => showVisitorSaveUI("quizOutput", keywordEntries, true), 300);
    }

  } catch (err) {
    console.error("❌ Error:", err);
    alert(`❌ Failed to generate keywords.\\n${err.message}`);
  }

  button.disabled = false;
  button.textContent = "✨ Generate Keywords and Explanations";
  if (typeof updateFloatingButtonVisibility === "function") updateFloatingButtonVisibility();
}






function toggleHighlight(checkbox) {
  const details = checkbox.closest("details");
  if (!details) return;

  if (checkbox.checked) {
    details.style.backgroundColor = "#dbeafe"; // light blue
  } else {
    details.style.backgroundColor = ""; // remove highlight
  }
}



  
  // Düzenle: soruları input haline getir
  // Eklenmiş MathJax güncellemesi ile tam editQuestion ve saveQuestionEdits fonksiyonları

// Güncellenmiş editQuestion — MathJax formüllerini data-latex ile korur

window.editQuestion = function (btn) {
  const block = btn.closest("details");
  if (block.querySelector("textarea")) return;

  // 🆕 Eski halini sakla
  if (!block.dataset.originalHTML) {
    block.dataset.originalHTML = block.innerHTML;
  }

  const summary = block.querySelector("summary");
  const questionSpan = summary.querySelector(".q[data-key='question']");
  const questionText = questionSpan?.dataset.latex || summary.textContent.replace(/^Q\d+\.\s*/, "").trim();
  questionSpan.style.fontWeight = "bold";

  const enableAutoResize = (textarea) => {
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    };
    textarea.addEventListener("input", resize);
    requestAnimationFrame(() => resize());
  };

  // ✅ Soru textarea
  const qTextarea = document.createElement("textarea");
  qTextarea.value = questionText;
  qTextarea.className = "q-edit";
  qTextarea.dataset.key = "question";
  qTextarea.style.cssText = `
    width: 100%; margin-top: 8px; padding: 8px; font-size: 15px;
    border-radius: 6px; overflow: hidden; resize: none; line-height: 1.1;
    height: 1.1em; min-height: 1.1em;
  `;
  summary.insertAdjacentElement("afterend", qTextarea);
  enableAutoResize(qTextarea);

  // ✅ Yazdıkça üst soru değişsin
  qTextarea.addEventListener("input", () => {
    if (questionSpan) {
      const newText = qTextarea.value.trim();
      questionSpan.textContent = newText;
      questionSpan.dataset.latex = newText;
      if (window.MathJax?.typesetPromise) MathJax.typesetPromise([questionSpan]);
    }
  });

  // ✅ Şıklar, cevap, açıklama
  const elements = block.querySelectorAll(".q, li[data-key]");
  elements.forEach(el => {
    const key = el.dataset.key;
    if (key === "question") return;
    const val = el.dataset.latex || el.textContent.trim();

    const textarea = document.createElement("textarea");
    textarea.value = val;
    textarea.className = "q-edit";
    textarea.dataset.key = key;
    textarea.style.cssText = `
      width: 100%; margin-top: 6px; padding: 6px;
      font-size: 14px; border-radius: 6px; overflow: hidden;
      resize: none; line-height: 1.1;
      height: 1.1em; min-height: 1.1em;
    `;
    el.insertAdjacentElement("afterend", textarea);
    enableAutoResize(textarea);
  });

  // ✅ Difficulty seçimi
  let difficulty = "medium";
  const diffText = block.querySelector(".difficulty-line")?.innerText?.toLowerCase() || "";
  if (diffText.includes("easy")) difficulty = "easy";
  else if (diffText.includes("hard")) difficulty = "hard";

  const select = document.createElement("select");
  select.className = "q-difficulty";
  select.style.cssText = "margin-top: 6px; padding: 6px 10px; border-radius: 6px; font-size: 14px;";
  ["easy", "medium", "hard"].forEach(level => {
    const opt = document.createElement("option");
    opt.value = level;
    opt.textContent = {
      easy: "🟢 Easy",
      medium: "🟡 Medium",
      hard: "🔴 Hard"
    }[level];
    if (level === difficulty) opt.selected = true;
    select.appendChild(opt);
  });

  const diffLine = block.querySelector(".difficulty-line");
  if (diffLine) diffLine.insertAdjacentElement("afterend", select);
  else block.appendChild(select);

  // ✅ Save ve Cancel butonları
  const btnRow = document.createElement("div");
  btnRow.style.marginTop = "10px";

  const saveBtn = document.createElement("button");
  saveBtn.textContent = "✅ Save";
  saveBtn.onclick = () => saveQuestionEdits(block);
  saveBtn.style.marginRight = "8px";

  const cancelBtn = document.createElement("button");
  cancelBtn.textContent = "❌ Cancel";
  cancelBtn.onclick = () => cancelEdit(block);

  btnRow.appendChild(saveBtn);
  btnRow.appendChild(cancelBtn);
  block.appendChild(btnRow);

  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise().catch(console.error);
  }
};
window.cancelEdit = function (block) {
  if (block?.dataset?.originalHTML) {
    block.innerHTML = block.dataset.originalHTML;
    delete block.dataset.originalHTML;
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([block]);
    }
  }
};









function saveQuestionEdits(block) {
  const edits = block.querySelectorAll(".q-edit");
  const selectedDiff = block.querySelector(".q-difficulty")?.value || "medium";

  const newDetails = document.createElement("details");
  newDetails.className = "quiz-preview";
  newDetails.style.maxWidth = "700px";
  newDetails.style.margin = "15px auto";
  newDetails.dataset.index = block.dataset.index;
  newDetails.dataset.difficulty = selectedDiff;

  const difficultyIcon = selectedDiff === "easy" ? "🟢 Easy"
                        : selectedDiff === "hard" ? "🔴 Hard"
                        : "🟡 Medium";

  let questionText = "";
  let answerHTML = "";
  let explanationHTML = "";
  let optionsHTML = "";

  edits.forEach(input => {
    const key = input.dataset.key;
    const val = input.value.trim();

    if (key === "question") {
      questionText = val;
    } else if (key === "answer") {
      answerHTML = `<p><strong>✅ Answer:</strong> <span class="q" data-key="answer" data-latex="${val}">${val}</span></p>`;
    } else if (key === "explanation") {
      explanationHTML = `<p><strong>💡 Explanation:</strong> <span class="q" data-key="explanation" data-latex="${val}">${val}</span></p>`;
    } else if (key.startsWith("option")) {
      if (!optionsHTML) optionsHTML += "<ul>";
      optionsHTML += `<li class="q" data-key="${key}" data-latex="${val}">${val}</li>`;
    }
  });
  if (optionsHTML) optionsHTML += "</ul>";

  // 🔁 summary tek satır ve temiz şekilde yapılsın
  const summaryHTML = `
  <summary style="display: flex; justify-content: space-between; align-items: center;">
    <div style="flex-grow:1;">
      <b>Q${parseInt(newDetails.dataset.index) + 1}.</b> 
      <span class="q" data-key="question" data-latex="${questionText}">${questionText}</span>
    </div>
    ${localStorage.getItem("userEmail") ? `<label style="margin-left:8px;"><input type="checkbox" class="qcheck" onchange="toggleHighlight(this)"> ✅</label>` : ""}
  </summary>
`;

  const difficultyHTML = `<p><strong>Difficulty:</strong> ${difficultyIcon}</p>`;
  const checkboxHTML = localStorage.getItem("userEmail")
  ? `<label><input type="checkbox" class="qcheck"> ✅ Save</label>` : "";

const buttonsHTML = `
  <div style="margin-top: 8px;">
    <button onclick="editQuestion(this)">✏️ Edit</button>
    <button onclick="deleteQuestion(this)">🗑️ Delete</button>
  </div>
`;



  newDetails.innerHTML = `
    ${summaryHTML}
    ${optionsHTML}
    ${answerHTML}
    ${explanationHTML}
    ${difficultyHTML}
    ${checkboxHTML}
    ${buttonsHTML}
  `;

  // ✨ Eski bloğun yerine temiz yeni bloğu koy
  block.replaceWith(newDetails);
  newDetails.open = true; // kullanıcı güncellemeyi hemen görsün

  // ✅ MathJax yeniden çalışsın
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise().catch(console.error);
  }
}


  
  
  window.deleteQuestion = function (btn) {
    const block = btn.closest(".quiz-preview");
    block.remove();
  
    const all = document.querySelectorAll(".quiz-preview");
    all.forEach((el, i) => {
      const label = el.querySelector("b");
      if (label) label.innerText = `Q${i + 1}.`;
    });
  };
 
  

  // ==== 🆕 Declare globals at top ====
let currentTitleId = null;
let currentTitleName = "";

// ==== Utility ====


async function saveSelectedQuestions() {
  const token = localStorage.getItem("accessToken");
  const email = localStorage.getItem("userEmail");
  if (!token || !email) return alert("❌ Please log in.");

  let titleName = "";
  const dropdown = document.getElementById("titleDropdown");
  const input = document.getElementById("newTitleInput");

  if (dropdown?.value === "__new__") {
    titleName = input?.value.trim();
    if (!titleName) return alert("⚠️ Please enter a new title.");
  } else {
    titleName = dropdown?.value;
    if (!titleName) return alert("⚠️ Please select a title.");
  }

  const categoryId = document.getElementById("categorySelect")?.value;
  if (!categoryId) return alert("⚠️ Please select a category.");

  const selectedBlocks = Array.from(document.querySelectorAll(".quiz-preview"))
    .filter(block => block.querySelector("input[type='checkbox']")?.checked);

  if (selectedBlocks.length === 0) {
    alert("⚠️ You must select at least one question to save.");
    return;
  }

  const questions = selectedBlocks.map(block => {
    const questionText = block.querySelector("[data-key='question']")?.dataset.latex?.trim() || "";
    const explanation = block.querySelector("[data-key='explanation']")?.dataset.latex?.trim() || "";
    const difficulty = block.querySelector(".difficulty-line")?.dataset.level || "medium";

    const optionElems = block.querySelectorAll("[data-key^='option']");
    const options = Array.from(optionElems)
      .map(opt => opt.dataset.latex?.trim())
      .filter(Boolean);

    // ✅ Robust answer extraction
    let answer = "";
    const answerSpan = block.querySelector("[data-key='answer']");
    if (answerSpan) {
      answer = answerSpan.dataset.latex?.trim() || answerSpan.textContent.trim();
    } else {
      const answerP = Array.from(block.querySelectorAll("p"))
        .find(p => p.textContent.startsWith("✅ Answer:"));
      if (answerP) {
        const parts = answerP.textContent.split("✅ Answer:");
        if (parts[1]) answer = parts[1].trim();
      }
    }

    return {
      question: questionText,
      options,
      answer,
      explanation,
      difficulty,
      source: "mcq"
    };
  }).filter(q => q.question && q.answer && q.options.length > 0);

  try {
    const res = await fetch("https://gemini-j8xd.onrender.com/save-questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        titleName,
        categoryId,
        questions
      })
    });

    const data = await res.json();

    if (res.ok && data.titleId) {
      // ✅ Save to recent_texts with title_id
      await fetch("https://gemini-j8xd.onrender.com/save-recent-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title_name: titleName,
          title_id: data.titleId,
          extracted_text: getCurrentSectionText()
        })
      });

      alert("✅ Questions saved successfully!");
    } else {
      alert("❌ Failed to save questions: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Save questions error:", err);
    alert(`❌ Failed to save questions.\n${err.message}`);
  }
}


async function saveSelectedKeywords() {
  const token = localStorage.getItem("accessToken");
  const email = localStorage.getItem("userEmail");
  if (!token || !email) return alert("❌ Please log in.");

  let titleName = "";
  const dropdown = document.getElementById("titleDropdown");
  const input = document.getElementById("newTitleInput");

  if (dropdown?.value === "__new__") {
    titleName = input?.value.trim();
    if (!titleName) return alert("⚠️ Please enter a new title.");
  } else {
    titleName = dropdown?.value;
    if (!titleName) return alert("⚠️ Please select a title.");
  }

  const categoryId = document.getElementById("categorySelect")?.value;
  if (!categoryId) return alert("⚠️ Please select a category.");

  const selectedBlocks = Array.from(document.querySelectorAll(".quiz-preview"))
    .filter(block => block.querySelector("input[type='checkbox']")?.checked);

  if (selectedBlocks.length === 0) {
    alert("⚠️ You must select at least one keyword to save.");
    return;
  }

  const questions = selectedBlocks.map(block => {
    let keyword = "";
    let definition = "";

    const summaryDiv = block.querySelector("summary div");
    if (summaryDiv) {
      keyword = summaryDiv.innerText.replace(/^Keyword \d+:\s*/, "").trim();
    }

    const pTags = block.querySelectorAll("div > p");
    if (pTags.length > 0) {
      const strongNode = pTags[0].querySelector("strong");
      if (strongNode && strongNode.nextSibling) {
        definition = strongNode.nextSibling.textContent.trim();
      }
    }

    return {
      question: keyword || "Placeholder Keyword",
      options: [],
      answer: definition || "Placeholder Answer",
      explanation: "",
      difficulty: "medium",
      source: "keyword"
    };
  }).filter(q => q.question && q.answer);

  try {
    const res = await fetch("https://gemini-j8xd.onrender.com/save-questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        titleName,
        categoryId,
        questions
      })
    });

    const data = await res.json();

    if (res.ok && data.titleId) {
      // ✅ Save recent text with real title_id
      await fetch("https://gemini-j8xd.onrender.com/save-recent-text", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          title_name: titleName,
          title_id: data.titleId,
          extracted_text: getCurrentSectionText()
        })
      });

      alert("✅ Keywords saved as questions successfully!");
    } else {
      alert("❌ Failed to save keywords: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Save keywords error:", err);
    alert(`❌ Failed to save keywords.\n${err.message}`);
  }
}





// ==== Load Titles with data-id ====
async function loadTitles(categoryId) {
  const token = localStorage.getItem("accessToken");
  const email = localStorage.getItem("userEmail");

  if (!token || !email || !categoryId) return;

  try {
    const res = await fetch(`https://gemini-j8xd.onrender.com/list-titles?category_id=${categoryId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    const dropdown = document.getElementById("titleDropdown");

    if (dropdown) {
      dropdown.innerHTML = `<option value="">-- Select Title --</option><option value="__new__">➕ Add New Title</option>`;
      data.titles.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.name;
        opt.textContent = t.name;
        opt.dataset.id = t.id;   // 🆕 Add title ID here
        dropdown.appendChild(opt);
      });
    }
  } catch (err) {
    console.error("❌ Failed to load titles:", err);
  }
}

// (rest of your generateFullQuiz and other utility functions stay the same)


  
  async function loadRecentTextsDropdown() {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
  
    const res = await fetch("https://gemini-j8xd.onrender.com/list-recent-texts", {
      headers: { Authorization: `Bearer ${token}` }
    });
  
    if (!res.ok) {
      console.error("❌ Failed to load recent texts");
      return;
    }
  
    const data = await res.json();
    const dropdown = document.getElementById("recentTextsDropdown");
    dropdown.innerHTML = `<option value="">🔽 Load a previous text...</option>`;
  
    data.texts.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.extracted_text;
      opt.textContent = t.title_name.length > 50 ? t.title_name.slice(0, 50) + "..." : t.title_name;
      dropdown.appendChild(opt);
    });
  }
  
  function restoreRecentText() {
    const dropdown = document.getElementById("recentTextsDropdown");
    const selectedText = dropdown.value;
    if (!selectedText) {
      alert("⚠️ Please select a text to restore.");
      return;
    }
  
    const lastSection = localStorage.getItem("lastSection");
  
    if (lastSection === "topic") {
      const topicInput = document.getElementById("topicInput");
      if (topicInput) topicInput.value = selectedText;
    } else {
      const ids = ["textManualInput", "textOutput", "imageTextOutput", "audioTextOutput"];
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.offsetHeight > 0 && el.offsetWidth > 0) {
          el.value = selectedText;
          break;
        }
      }
    }
  
    alert("✅ Text restored.");
  }

  

  
  
  
  
  
  
  async function loadMainTopics() {
    const token = localStorage.getItem("accessToken");
    if (!token) return;
  
    const res = await fetch("https://gemini-j8xd.onrender.com/list-main-topics", {
      headers: { Authorization: `Bearer ${token}` }
    });
  
    if (!res.ok) {
      console.error("❌ Main topic fetch error:", res.status);
      return;
    }
  
    const data = await res.json();
    const select = document.getElementById("mainTopicSelect");
    if (!select || !data.topics) return;
  
    select.innerHTML = "";
    data.topics.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.id;
      opt.textContent = t.name;
      select.appendChild(opt);
    });
  
    if (select.value) loadCategories(select.value);
    select.onchange = () => loadCategories(select.value);
  }
  
  
  async function loadCategories(mainTopicId) {
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`https://gemini-j8xd.onrender.com/list-categories?main_topic_id=${mainTopicId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const select = document.getElementById("categorySelect");
    select.innerHTML = "";
    data.categories.forEach(c => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.name;
      select.appendChild(opt);
    });
    if (select.value) loadTitles(select.value);
    select.onchange = () => loadTitles(select.value);
  }
  
  async function loadTitles(categoryId) {
    const token = localStorage.getItem("accessToken");
    const email = localStorage.getItem("userEmail");
  
    if (!token || !email || !categoryId) return;
  
    try {
      const res = await fetch(`https://gemini-j8xd.onrender.com/list-titles?category_id=${categoryId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
  
      const data = await res.json();
  
      const list = document.getElementById("titleSuggestions");
      if (list) {
        list.innerHTML = "";
        data.titles.forEach(t => {
          const opt = document.createElement("option");
          opt.value = t.name;
          list.appendChild(opt);
        });
      }
  
      const dropdown = document.getElementById("titleDropdown");
      if (dropdown) {
        dropdown.innerHTML = `<option value="">-- Select Title --</option><option value="__new__">➕ Add New Title</option>`;
        data.titles.forEach(t => {
          const opt = document.createElement("option");
          opt.value = t.name;
          opt.textContent = t.name;
          dropdown.appendChild(opt);
        });
      }
  
      // 🎯 Bu kısmı güncel sistemle uyumlu hale getiriyoruz:
      updateFloatingButtonVisibility();
  
    } catch (err) {
      console.error("❌ Failed to load titles:", err);
    }
  }
  
  
  
  // 🔁 Ayrıca kullanıcı manuel yazarsa da butonu kontrol et
  document.getElementById("quizTitle")?.addEventListener("input", () => {
    updateFloatingButtonVisibility();
  
    const title = document.getElementById("quizTitle")?.value.trim();
    const token = localStorage.getItem("accessToken");
    const suggestions = Array.from(document.querySelectorAll("#titleSuggestions option")).map(opt => opt.value);
    const viewBtn = document.getElementById("viewQuestionsWrapper");
  
    if (token && suggestions.includes(title)) {
      viewBtn.style.display = "block";
    } else {
      viewBtn.style.display = "none";
    }
  });
  
  
  
  function updateFloatingButtonVisibility() {
    const dropdown = document.getElementById("titleDropdown");
    const input = document.getElementById("newTitleInput");
    const token = localStorage.getItem("accessToken");
  
    let title = "";
    if (dropdown?.value === "__new__") {
      title = input?.value?.trim() || "";
    } else {
      title = dropdown?.value || "";
    }
  
    const suggestions = Array.from(document.querySelectorAll("#titleSuggestions option")).map(opt => opt.value);
    const isValid = token && title.length > 0 && suggestions.includes(title);
  
    const viewBtnWrapper = document.getElementById("viewQuestionsWrapper");
    const mobileBtn = document.getElementById("openModalBtn");
    const fixedBtn = document.getElementById("fixedQuestionsToggle");
  
    if (viewBtnWrapper) viewBtnWrapper.style.display = isValid ? "block" : "none";
    if (mobileBtn) mobileBtn.style.display = isValid && window.innerWidth < 768 ? "block" : "none";
    if (fixedBtn) fixedBtn.classList.toggle("show", isValid);
  }
  
  
  
  document.addEventListener("DOMContentLoaded", () => {
    updateFloatingButtonVisibility(); // ✅ başlangıçta buton gizli kalır
  });  
  document.getElementById("quizTitle")?.addEventListener("input", () => {
    const title = document.getElementById("quizTitle")?.value.trim();
    const token = localStorage.getItem("accessToken");
    const suggestions = Array.from(document.querySelectorAll("#titleSuggestions option")).map(opt => opt.value);
    const viewBtn = document.getElementById("viewQuestionsWrapper");
  
    // Masaüstü buton görünürlüğü
    if (token && title.length > 0 && suggestions.includes(title)) {
      viewBtn.style.display = "block";
    } else {
      viewBtn.style.display = "none";
    }
  
    // Mobil floating buton görünürlüğü
    updateFloatingButtonVisibility();
  });
  
  document.getElementById("titleDropdown")?.addEventListener("change", (e) => {
    const value = e.target.value;
    const newInput = document.getElementById("newTitleInput");
  
    if (value === "__new__") {
      newInput.style.display = "inline-block";
      newInput.focus();
    } else {
      newInput.style.display = "none";
    }
  
    updateFloatingButtonVisibility(); // 🧾 Mevcut soruları göster butonu kontrolü
  });
  async function loadTitles(categoryId) {
    const token = localStorage.getItem("accessToken");
    const email = localStorage.getItem("userEmail");
  
    if (!token || !email || !categoryId) return;
  
    try {
      const res = await fetch(`https://gemini-j8xd.onrender.com/list-titles?category_id=${categoryId}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
  
      const data = await res.json();
  
      // 🟡 Datalist için (autocomplete önerileri)
      const list = document.getElementById("titleSuggestions");
      if (list) {
        list.innerHTML = "";
        data.titles.forEach(t => {
          const opt = document.createElement("option");
          opt.value = t.name;
          list.appendChild(opt);
        });
      }
  
      // 🔵 Yeni sistem: dropdown
      const dropdown = document.getElementById("titleDropdown");
      if (dropdown) {
        dropdown.innerHTML = `<option value="">-- Select Title --</option><option value="__new__">➕ Add New Title</option>`;
        data.titles.forEach(t => {
          const opt = document.createElement("option");
          opt.value = t.name;
          opt.textContent = t.name;
          dropdown.appendChild(opt);
        });
      }
  
      // 📂 Mevcut sorular için görünürlük kontrolü
      const titleInput = document.getElementById("quizTitle")?.value.trim();
      const matches = data.titles.map(t => t.name);
      const viewBtnWrapper = document.getElementById("viewQuestionsWrapper");
  
      if (titleInput && matches.includes(titleInput)) {
        viewBtnWrapper.style.display = "block";
      } else {
        viewBtnWrapper.style.display = "none";
      }
  
      updateFloatingButtonVisibility();
  
    } catch (err) {
      console.error("❌ Failed to load titles:", err);
    }
  }
  function openModal() {
    const dropdown = document.getElementById("titleDropdown");
    const input = document.getElementById("newTitleInput");
    const token = localStorage.getItem("accessToken");
    const email = localStorage.getItem("userEmail");
    const modal = document.getElementById("questionModal");
    const container = document.getElementById("modalQuestionList");
  
    modal.classList.add("show");
  
    if (!token || !email) {
      container.innerHTML = "<p style='color:red;'>❌ You are not logged in. Please log in.</p>";
      return;
    }
  
    let titleName = "";
    if (dropdown?.value === "__new__") {
      titleName = input?.value?.trim();
    } else {
      titleName = dropdown?.value;
    }
  
    if (!titleName) {
      container.innerHTML = "<p style='color:red;'>❌ Please select or enter a title.</p>";
      return;
    }
  
    if (!shouldReloadQuestions && currentTitle === titleName) return;
  
    container.innerHTML = "<p style='text-align:center;'>⏳ Loading...</p>";
  
    fetch(`https://gemini-j8xd.onrender.com/get-questions-by-name?title=${encodeURIComponent(titleName)}&email=${encodeURIComponent(email)}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.questions || data.questions.length === 0) {
          container.innerHTML = "<p style='color:gray;'>⚠️ No questions found under this title.</p>";
          return;
        }
  
        container.innerHTML = `<p>📌 Total Questions: <strong>${data.questions.length}</strong></p>`;
  
        data.questions.forEach((q, i) => {
          const block = document.createElement("details");
          block.dataset.difficulty = (q.difficulty || "medium").toLowerCase();
          // Başlangıçta kapalı kalsın diye open vermiyoruz (append sonrası da ayrıca kapatacağız)
  
          let badge = "";
          if (q.difficulty === "easy") {
            badge = "🟢 Easy";
          } else if (q.difficulty === "medium") {
            badge = "🟡 Medium";
          } else if (q.difficulty === "hard") {
            badge = "🔴 Hard";
          }
  
          block.innerHTML = `
  <summary>
    <b>Q${i + 1}.</b> <span class="q" data-key="question" data-latex="${q.question}">${q.question}</span>
  </summary>
  <ul>
    ${q.options.map((opt, idx) => `
      <li class="q" data-key="option${idx + 1}" data-latex="${opt}">${opt}</li>
    `).join("")}
  </ul>
  <p><strong>✅ Answer:</strong>
    <span class="q" data-key="answer" data-latex="${q.answer}">${q.answer}</span>
  </p>
  <p><strong>💡 Explanation:</strong>
    <span class="q" data-key="explanation" data-latex="${q.explanation}">${q.explanation}</span>
  </p>
  <p class="difficulty-line" data-level="${q.difficulty}">
    <strong>Difficulty:</strong> ${badge}
  </p>
  <div style="margin-top: 8px;">
    <button onclick="editExistingQuestion(${q.id})">✏️ Edit</button>
    <button onclick="deleteExistingQuestion(${q.id}, this)">🗑️ Delete</button>
  </div>
`;

  
          container.appendChild(block);
        });
  
        currentTitle = titleName;
        shouldReloadQuestions = false;
  
        if (window.MathJax) MathJax.typesetPromise?.();
  
        updateStats?.();
        filterByDifficulty('');
  
        // 🛠️ Tüm sorular eklenip MathJax bitince detayları collapse yap (tam garanti!)
        setTimeout(() => {
          document.querySelectorAll("#modalQuestionList details").forEach(d => d.open = false);
        }, 100);
      })
      .catch(err => {
        container.innerHTML = "<p style='color:red;'>❌ Failed to retrieve questions.</p>";
        console.error("get-questions error:", err);
      });
  }
  
  
  

  let suggestTimeout;

document.addEventListener("input", function (e) {
  if (e.target.id === "topicInput") {
    clearTimeout(suggestTimeout);

    const value = e.target.value.trim();
    if (value.length < 4) return;

    suggestTimeout = setTimeout(() => {
      const lang = document.getElementById("languageSelect")?.value || "";

      fetch("https://gemini-j8xd.onrender.com/suggest-topic-focus", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic: value, language: lang })
      })
        .then(res => res.json())
        .then(data => {
          const wrapper = document.getElementById("focusSuggestions");
          if (!wrapper || !Array.isArray(data.suggestions)) return;

          const container = wrapper.querySelector("div");
          container.innerHTML = ""; // önceki önerileri temizle
          
          data.suggestions.forEach(txt => {
            const span = document.createElement("span");
            span.className = "focus-suggestion";
            span.textContent = txt; // innerHTML değil, textContent!
            container.appendChild(span);
          });
          
        })
        .catch(err => {
          console.error("❌ Otomatik öneri hatası:", err);
        });
    }, 1000); // 1 saniye sonra tetikle
  }
});
document.addEventListener("click", function (e) {
  if (e.target.classList.contains("focus-suggestion")) {
    const input = document.getElementById("topicFocus");
    if (!input) return;

    const tag = e.target;
    const newVal = tag.textContent.trim();
    const current = input.value.trim();

    // Zaten seçilmişse → kaldır (sil)
    if (tag.classList.contains("selected")) {
      tag.classList.remove("selected");
      const updated = current.split(",").map(s => s.trim()).filter(t => t !== newVal).join(", ");
      input.value = updated;
    } else {
      // Yeni seçim
      tag.classList.add("selected");
      input.value = current.length ? `${current}, ${newVal}` : newVal;
    }

    input.dispatchEvent(new Event("input"));
  }

  // 🧹 Temizleme butonuna tıklandıysa
  if (e.target.id === "clearFocusButton") {
    document.getElementById("topicFocus").value = "";
    document.querySelectorAll(".focus-suggestion.selected").forEach(el => el.classList.remove("selected"));
  }
});

function filterByDifficulty(level) {
  const questions = document.querySelectorAll("#modalQuestionList details");

  questions.forEach(item => {
    const difficulty = (item.dataset.difficulty || "").toLowerCase();
    const match = !level || difficulty === level;
    item.style.display = match ? "block" : "none";
    item.open = match;
  });

  if (typeof updateStats === "function") updateStats();
  document.getElementById("modalQuestionList")?.scrollIntoView({ behavior: "smooth" });
}


function selectAllQuestions(selectAll) {
  document.querySelectorAll(".qcheck").forEach(checkbox => {
    checkbox.checked = selectAll;
    toggleHighlight(checkbox); // ✅ highlight'ı da güncelle
  });
}
async function loadRecentTextsList() {
  const token = localStorage.getItem("accessToken");
  if (!token) return;

  const container = document.getElementById("recentTextsList");
  if (!container) return;

  container.innerHTML = "⏳ Loading...";

  try {
    const res = await fetch("https://gemini-j8xd.onrender.com/list-recent-texts", {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!res.ok) throw new Error("Failed to fetch");

    const data = await res.json();
    container.innerHTML = "";

    if (data.texts.length === 0) {
      container.innerHTML = "<p>⚠️ No recent texts found.</p>";
      return;
    }

    data.texts.forEach(item => {
      const div = document.createElement("div");
      div.style.cssText = "padding:12px; margin-bottom:10px; background:#f9fafb; border-radius:10px; border:1px solid #ddd;";

      div.innerHTML = `
        <div style="font-weight:bold; margin-bottom:6px;">📘 ${item.title_name}</div>
        <div style="font-size:14px; color:#555; margin-bottom:8px; max-height:80px; overflow:auto;">${item.extracted_text.slice(0, 200)}...</div>
        <button onclick="restoreRecentTextFromList(\`${encodeURIComponent(item.extracted_text)}\`)" 
                style="padding:6px 12px; background:#3b82f6; color:white; border:none; border-radius:8px; font-size:14px; cursor:pointer;">
          ♻️ Restore this text
        </button>
      `;
      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p>❌ Could not load recent texts.</p>";
  }
}

function restoreRecentTextFromList(encodedText) {
  const text = decodeURIComponent(encodedText);

  const input = document.getElementById("recentTextInput");
  if (input) {
    input.value = text;
    input.scrollIntoView({ behavior: "smooth", block: "center" });

    // ✨ Add glow animation
    input.classList.remove("highlight-glow"); // remove if already exists
    void input.offsetWidth; // trigger reflow
    input.classList.add("highlight-glow");

    alert("✅ Text restored!");
  } else {
    alert("❌ Could not find input field.");
  }
}


async function loadLatestRecentTexts() {
  const output = document.getElementById("section-content");
  if (!output) return;

  output.innerHTML = `
    <h2 style="text-align:center;">🕒 Your 10 Most Recent Texts</h2>
    <div id="recentTextsList" style="margin-top:20px;"></div>
  `;

  const list = document.getElementById("recentTextsList");

  try {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      list.innerHTML = "<p style='color:red;'>❌ You must log in to view recent texts.</p>";
      return;
    }

    const res = await fetch("https://gemini-j8xd.onrender.com/list-latest-recent-texts", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();
    if (!res.ok || !data.recent_texts) {
      list.innerHTML = "<p style='color:red;'>❌ Failed to load recent texts.</p>";
      return;
    }

    if (data.recent_texts.length === 0) {
      list.innerHTML = "<p style='color:gray;'>⚠️ No recent texts found.</p>";
      return;
    }

    list.innerHTML = "";

    data.recent_texts.forEach(text => {
      const card = document.createElement("div");
      card.className = "recent-text-card";
      card.id = `recentCard-${text.id}`;
      card.style = `
        padding:14px; 
        margin:16px auto; 
        max-width:800px; 
        background:#f9fafb; 
        border-radius:12px; 
        border:1px solid #ddd; 
        box-shadow:0 2px 6px rgba(0,0,0,0.05);
      `;

      card.innerHTML = `
      <label style="display:flex; align-items:flex-start; gap:10px;">
        <input type="radio" name="recentTextChoice" value="${encodeURIComponent(text.extracted_text)}" style="margin-top:8px;">
        <div style="flex-grow:1;">
          <div style="font-weight:bold; margin-bottom:6px; color:#374151;">📘 ${text.title_name || "(Untitled)"}</div>
          <div style="font-size:12px; color:#666;">Saved on ${new Date(text.created_at).toLocaleString()}</div>
          <textarea id="recentText-${text.id}" readonly 
            style="width:100%; min-height:120px; padding:10px; border-radius:8px; border:1px solid #ccc; margin-top:8px; resize:vertical;">${text.extracted_text}</textarea>
          <div style="margin-top:10px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
            <button onclick="openRecentTextModal(${text.id})">👁️ View / Edit</button>
          </div>
        </div>
      </label>
    `;

      list.appendChild(card);
    });

  } catch (err) {
    console.error("loadLatestRecentTexts error:", err);
    list.innerHTML = "<p style='color:red;'>❌ Server error</p>";
  }
}




function viewUserRecentText(id) {
  const card = document.getElementById(`recentCard-${id}`);
  const textarea = document.getElementById(`recentText-${id}`);
  if (!card || !textarea) return;
  
  card.scrollIntoView({ behavior: "smooth", block: "center" });
  textarea.focus();
}


function editUserRecentText(id) {
  const card = document.getElementById(`recentCard-${id}`);
  const textarea = document.getElementById(`recentText-${id}`);
  const saveButton = document.getElementById(`saveUserBtn-${id}`);
  if (!card || !textarea || !saveButton) return;

  textarea.removeAttribute("readonly");
  textarea.focus();
  saveButton.style.display = "inline-block";
  card.classList.add("editing");
}


async function saveUserRecentText(id) {
  const card = document.getElementById(`recentCard-${id}`);
  const textarea = document.getElementById(`recentText-${id}`);
  const saveButton = document.getElementById(`saveUserBtn-${id}`);
  if (!textarea || !saveButton || !card) return;

  const newText = textarea.value.trim();
  if (!newText) {
    showUserToast("⚠️ Text cannot be empty!");
    return;
  }

  try {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      showUserToast("⚠️ You must log in!");
      return;
    }

    const res = await fetch(`https://gemini-j8xd.onrender.com/update-recent-text/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ extracted_text: newText })
    });

    const data = await res.json();
    if (res.ok) {
      showUserToast("✅ Text updated successfully!");
      textarea.setAttribute("readonly", true);
      saveButton.style.display = "none";
      card.classList.remove("editing");
    } else {
      showUserToast("❌ Update failed: " + (data.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Save user recent text error:", err);
    showUserToast("❌ Server connection error.");
  }
}


function showUserToast(message = "✅ Action completed!") {
  const toast = document.getElementById("user-toast");
  if (!toast) return;

  toast.textContent = message;
  toast.style.opacity = "1";

  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2000);
}

let currentRecentTextId = null; // Global for modal save

function openRecentTextModal(id) {
  const textarea = document.getElementById(`recentText-${id}`);
  const modal = document.getElementById("recentTextModal");
  const modalTextarea = document.getElementById("recentModalTextarea");
  const editBtn = document.getElementById("recentModalEditButton");
  const saveBtn = document.getElementById("recentModalSaveButton");

  if (!textarea || !modal || !modalTextarea) return;

  currentRecentTextId = id;
  modalTextarea.value = textarea.value;
  modalTextarea.setAttribute("readonly", true);
  editBtn.style.display = "inline-block";
  saveBtn.style.display = "none";

  modal.style.display = "flex";
}

function closeRecentTextModal() {
  const modal = document.getElementById("recentTextModal");
  if (modal) {
    modal.style.display = "none";
  }
}

function editModalRecentText() {
  const modalTextarea = document.getElementById("recentModalTextarea");
  const editBtn = document.getElementById("recentModalEditButton");
  const saveBtn = document.getElementById("recentModalSaveButton");

  if (!modalTextarea) return;

  modalTextarea.removeAttribute("readonly");
  modalTextarea.focus();
  editBtn.style.display = "none";
  saveBtn.style.display = "inline-block";
}

async function saveModalRecentText() {
  const modalTextarea = document.getElementById("recentModalTextarea");
  const editBtn = document.getElementById("recentModalEditButton");
  const saveBtn = document.getElementById("recentModalSaveButton");

  if (!modalTextarea || !currentRecentTextId) return;

  const newText = modalTextarea.value.trim();
  if (!newText) {
    showUserToast("⚠️ Text cannot be empty!");
    return;
  }

  try {
    const token = localStorage.getItem("accessToken");
    if (!token) {
      showUserToast("⚠️ You must log in!");
      return;
    }

    const res = await fetch(`https://gemini-j8xd.onrender.com/update-recent-text/${currentRecentTextId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ extracted_text: newText })
    });

    const data = await res.json();
    if (res.ok) {
      showUserToast("✅ Recent text updated!");

      // ✅ Lock textarea again
      modalTextarea.setAttribute("readonly", true);
      editBtn.style.display = "inline-block";
      saveBtn.style.display = "none";

      // ✅ Update the card textarea
      const cardTextarea = document.getElementById(`recentText-${currentRecentTextId}`);
      if (cardTextarea) {
        cardTextarea.value = newText;
      }

      // ✅ Update the saved date/time
      const cardDiv = document.getElementById(`recentCard-${currentRecentTextId}`);
      if (cardDiv) {
        const dateDiv = cardDiv.querySelector("div");
        if (dateDiv) {
          const now = new Date();
          dateDiv.textContent = `Updated on ${now.toLocaleString()}`;
        }
      }

    } else {
      showUserToast("❌ Update failed: " + (data?.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Save error:", err);
    showUserToast("❌ Server error.");
  }
}




///keywordsssss









function smartSaveSelected() {
  const output = document.getElementById("quizOutput");
  if (!output) return;

  const hasKeyword = Array.from(output.querySelectorAll(".quiz-preview summary")).some(s => s.innerText.includes("Keyword"));
  const hasQuestion = Array.from(output.querySelectorAll(".quiz-preview summary")).some(s => s.innerText.includes("Q"));

  if (hasKeyword) {
    saveSelectedKeywords();
  } else if (hasQuestion) {
    saveSelectedQuestions();
  } else {
    alert("⚠️ No questions or keywords found.");
  }
}



async function generateTopicKeywords() {
  const topic = document.getElementById("topicInput")?.value.trim();
  const focus = document.getElementById("topicFocus")?.value.trim();
  const lang = document.getElementById("languageSelect")?.value;
  const diff = document.getElementById("difficultySelect")?.value;
  const output = document.getElementById("quizOutput");
  const saveBox = document.getElementById("saveQuizSection");

  if (output) output.innerHTML = "";
  if (saveBox) {
    saveBox.style.display = "none";
    saveBox.style.opacity = "0";
    saveBox.dataset.loaded = "";
  }

  if (!topic || topic.length < 2) {
    alert("⚠️ Please enter a topic.");
    return;
  }

  const btn = document.getElementById("generateKeywordsButton");
  btn.disabled = true;
  btn.textContent = "⏳ Generating Keywords...";

  try {
    const token = localStorage.getItem("accessToken") || "";
    const res = await fetch("https://gemini-j8xd.onrender.com/generate-keywords-topic", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        topic,
        focus,
        userLanguage: lang,
        difficulty: diff
      })
    });

    const data = await res.json();
    if (!res.ok || !data.keywords || typeof data.keywords !== "string") {
      throw new Error("❌ Invalid response from AI");
    }

    const keywordsRaw = data.keywords;
    const keywordEntries = keywordsRaw
      .split("\n")
      .map(line => line.trim())
      .filter(line => line.startsWith("-"))
      .map(line => {
        const [keyword, ...explanationParts] = line.substring(1).split(":");
        return {
          keyword: (keyword || "").trim(),
          explanation: (explanationParts.join(":") || "").trim()
        };
      });

    output.innerHTML = `<h3 style="text-align:center;">🧠 Topic-based Keywords:</h3>`;

    const createControls = () => {
      const box = document.createElement("div");
      box.style = "margin: 10px 0; text-align: center;";
      box.innerHTML = `
        <button onclick="selectAllQuestions(true)" style="margin:4px; padding:6px 12px;">✅ Select All</button>
        <button onclick="selectAllQuestions(false)" style="margin:4px; padding:6px 12px;">❌ Clear Selections</button>
        <button onclick="expandAllDetails(true)" style="margin:4px; padding:6px 12px;">📖 Show All</button>
        <button onclick="expandAllDetails(false)" style="margin:4px; padding:6px 12px;">🔽 Collapse All</button>
      `;
      return box;
    };

    const topControls = createControls();
    output.appendChild(topControls);

    keywordEntries.forEach((item, i) => {
      const details = document.createElement("details");
      details.className = "quiz-preview";
      details.style.maxWidth = "700px";
      details.style.margin = "15px auto";
      details.dataset.index = i;

      details.innerHTML = `
        <summary style="display: flex; justify-content: space-between; align-items: center;">
          <div><b>Keyword ${i + 1}:</b> ${item.keyword}</div>
          <label style="margin-left:8px;"><input type="checkbox" class="qcheck" onchange="toggleHighlight(this)"> ✅</label>
        </summary>
        <div style="margin-top: 8px; padding: 8px;">
          <p><strong>💬 Explanation:</strong> ${item.explanation}</p>
        </div>
      `;

      output.appendChild(details);
    });

    const bottomControls = createControls();
    output.appendChild(bottomControls);

    if (window.MathJax?.typesetPromise) {
      await window.MathJax.typesetPromise().catch(err => console.error("MathJax render error:", err));
    }

    if (saveBox && token) {
      saveBox.style.display = "block";
      saveBox.style.opacity = "1";

      if (!document.getElementById("saveInstructions")) {
        const msg = document.createElement("p");
        msg.id = "saveInstructions";
        msg.textContent = "🎯 Select the keywords you want to save.";
        msg.style = "font-weight: 500; font-size: 14px;";
        saveBox.insertBefore(msg, saveBox.firstChild);
      }

      if (!saveBox.dataset.loaded) {
        await loadMainTopics();
        saveBox.dataset.loaded = "true";
      }
    }

  } catch (err) {
    console.error("❌ Error:", err);
    alert(`❌ Failed to generate topic keywords.\n${err.message}`);
  }

  btn.disabled = false;
  btn.textContent = "✨ Generate Keywords and Explanations";

  if (typeof updateFloatingButtonVisibility === "function") {
    updateFloatingButtonVisibility();
  }
}


function showVisitorSaveUI(containerId, questions, isKeyword = false) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const saveUI = document.createElement("div");
  saveUI.style = "margin-top: 30px; text-align: center;";

  saveUI.innerHTML = `
    <div style="margin-bottom: 10px;">
      <input id="visitorTitleInput" type="text" placeholder="Enter a title to save..." 
        style="padding: 10px; width: 80%; max-width: 400px; border-radius: 8px; border: 1px solid #ccc; font-size: 15px;" />
    </div>
    <button id="visitorSaveButton" style="padding: 10px 20px; font-size: 15px; border-radius: 6px; background: #2563eb; color: white; border: none; cursor: pointer;">
      💾 Save Title
    </button>
  `;

  container.appendChild(saveUI);

  document.getElementById("visitorSaveButton").onclick = () => {
    const title = document.getElementById("visitorTitleInput").value.trim();
    if (!title) return alert("⚠️ Please enter a title.");

    // ✅ Save without checking limit
    saveCurrentVisitorQuestions(title, questions, isKeyword);
    renderVisitorSavedContent();

    saveUI.innerHTML = `<p style="color:green; font-weight:500;">✅ Saved as "<b>${title}</b>"</p>`;
  };
}
