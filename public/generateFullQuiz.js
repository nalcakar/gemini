
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

async function generateFullQuiz() {
  const output = document.getElementById("quizOutput");
  if (output) {
    output.innerHTML = "";
  }

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
    const userEmail = localStorage.getItem("userEmail") || "";
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
    if (!data.questions || typeof data.questions !== "string") {
      throw new Error("Invalid response from AI");
    }

    const raw = data.questions;
    const parsedQuestions = raw
      .split("***")
      .map(q => q.trim())
      .filter(Boolean)
      .map(block => {
        const question = block.split("///")[0].trim();
        const answerMatch = block.match(/~~Cevap:\s*(.+)/i);
        const explanationMatch = block.match(/&&Açıklama:\s*([\s\S]*)/i);

        const options = [];
        const optionsMatch = block.match(/(\/\/\/.*)/gi);
        if (optionsMatch?.length === 1 && optionsMatch[0].includes("///")) {
          optionsMatch[0]
            .split("///")
            .map(opt => opt.replace("///", "").trim())
            .filter(opt => opt.length > 0)
            .forEach(opt => options.push(opt));
        } else if (optionsMatch?.length > 1) {
          optionsMatch.forEach(optLine => {
            options.push(optLine.replace("///", "").trim());
          });
        }

        return {
          question,
          options,
          answer: answerMatch ? answerMatch[1].trim() : "",
          explanation: explanationMatch ? explanationMatch[1].trim() : "",
          difficulty: difficulty || "medium"
        };
      });

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

      const badge = q.difficulty === "easy" ? "🟢 Easy"
                  : q.difficulty === "hard" ? "🔴 Hard"
                  : "🟡 Medium";

      const questionHTML = `<span class="q" data-key="question" data-latex="${q.question.replace(/"/g, '&quot;')}">${q.question}</span>`;
      const optionsHTML = q.options.map((opt, j) =>
        `<li class="q" data-key="option${j + 1}" data-latex="${opt.replace(/"/g, '&quot;')}">${opt}</li>`
      ).join("");
      const answerHTML = `<span class="q" data-key="answer" data-latex="${q.answer.replace(/"/g, '&quot;')}">${q.answer}</span>`;
      const explanationHTML = `<span class="q" data-key="explanation" data-latex="${q.explanation.replace(/"/g, '&quot;')}">${q.explanation}</span>`;

      details.innerHTML = `
        <summary style="display: flex; justify-content: space-between; align-items: center;">
          <div style="flex-grow:1;"><b>Q${i + 1}.</b> ${questionHTML}</div>
          ${isLoggedIn ? `<label style="margin-left:8px;"><input type="checkbox" class="qcheck" onchange="toggleHighlight(this)"> ✅</label>` : ""}
        </summary>
        <div style="margin-top: 8px; padding: 8px;">
          <ul>${optionsHTML}</ul>
          <p><strong>✅ Answer:</strong> ${answerHTML}</p>
          <p><strong>💡 Explanation:</strong> ${explanationHTML}</p>
          <p class="difficulty-line" data-level="${q.difficulty}"><strong>Difficulty:</strong> ${badge}</p>
          <div style="margin-top: 8px;">
            <button onclick="editQuestion(this)">✏️ Edit</button>
            <button onclick="deleteQuestion(this)">🗑️ Delete</button>
          </div>
        </div>
      `;

      output.appendChild(details);
    });

    const newTitleInput = document.getElementById("newTitleInput");
    if (newTitleInput) {
      newTitleInput.style.display = "none"; // ✅ Hide after generation
    }

    output.appendChild(bottomControls);

    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(err => console.error("MathJax render error:", err));
    }

    if (saveBox && isLoggedIn) {
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

  } catch (err) {
    console.error("❌ Error:", err);
    alert(`❌ Failed to generate questions.\n${err.message}`);
  }

  button.disabled = false;
  button.textContent = "Generate Multiple Choice Questions";
  if (typeof updateFloatingButtonVisibility === "function") {
    updateFloatingButtonVisibility();
  }
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

    currentTitleId = null;
    currentTitleName = titleName;

  } else {
    titleName = dropdown?.value;
    if (!titleName) return alert("⚠️ Please select a title.");

    const selectedOption = dropdown.selectedOptions[0];
    currentTitleId = selectedOption?.dataset?.id ? parseInt(selectedOption.dataset.id) : null;
    currentTitleName = titleName;
  }

  const categoryId = document.getElementById("categorySelect")?.value;
  if (!categoryId) {
    alert("⚠️ Please select a category.");
    return;
  }

  const questions = [];

  document.querySelectorAll(".quiz-preview").forEach(block => {
    const check = block.querySelector(".qcheck");
    if (check?.checked) {
      const q = {};

      block.querySelectorAll(".q").forEach(s => {
        const key = s.dataset.key;
        const val = s.dataset.latex?.trim() || s.innerText.trim();
        if (key?.startsWith("option")) {
          q.options = q.options || [];
          q.options.push(val);
        } else {
          q[key] = val;
        }
      });

      const diffText = block.querySelector(".difficulty-line")?.innerText?.toLowerCase() || "";
      if (diffText.includes("easy")) q.difficulty = "easy";
      else if (diffText.includes("hard")) q.difficulty = "hard";
      else q.difficulty = "medium";

      q.options = q.options || [];
      q.answer = q.answer || "placeholder";
      q.explanation = q.explanation || "";

      questions.push(q);
    }
  });

  if (questions.length === 0) {
    alert("⚠️ You must select at least one question to save.");
    return;
  }

  try {
    const res = await fetch("https://gemini-j8xd.onrender.com/save-questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        titleName: titleName,
        categoryId,
        questions
      })
    });

    const data = await res.json();
    if (res.ok) {
      alert("✅ Questions saved successfully.");

      const realTitleId = data.titleId || currentTitleId || null;  // 🆕 Get the real titleId!

      // ✅ Save the recent input text
      const extractedText = getCurrentSectionText();
      if (extractedText.trim().length > 0) {
        const recentSavePayload = {
          extracted_text: extractedText,
          title_id: realTitleId,
          title_name: currentTitleName || titleName
        };

        const recentRes = await fetch("https://gemini-j8xd.onrender.com/save-recent-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify(recentSavePayload)
        });

        const recentData = await recentRes.json();
        if (!recentRes.ok) {
          console.error("❌ Failed to save recent text:", recentData);
        } else {
          console.log("✅ Recent text saved successfully.");
        }
      }

    } else {
      alert("❌ Could not save questions: " + (data?.error || "Server error"));
    }
  } catch (err) {
    console.error("❌ Save error:", err);
    alert("❌ Could not connect to the server.");
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
      headers: {
        Authorization: `Bearer ${token}`
      }
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
      <div style="font-weight:bold; margin-bottom:6px; color:#374151;">📘 ${text.title_name || "(Untitled)"}</div>
      <div style="font-size:12px; color:#666;">Saved on ${new Date(text.created_at).toLocaleString()}</div>
      <textarea id="recentText-${text.id}" readonly style="width:100%; min-height:120px; padding:10px; border-radius:8px; border:1px solid #ccc; resize:vertical;">${text.extracted_text}</textarea>
      <div style="margin-top:10px; display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">
        <button onclick="openRecentTextModal(${text.id})">👁️ View / Edit</button>
      </div>
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

