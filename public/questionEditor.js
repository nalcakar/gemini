let lastDeletedQuestion = null;
let currentTitle = "";
let shouldReloadQuestions = false;


  
  
  function closeModal() {
    document.getElementById("questionModal").classList.remove("show");
  }
  
  // Silme fonksiyonu
  function deleteExistingQuestion(id, btn) {
    if (!confirm("Are you sure you want to delete this question?")) return;
  
    const details = btn.closest("details");
    if (!details) return;
  
    // Soruyu geçici olarak sakla
    lastDeletedQuestion = {
      html: details.outerHTML,
      index: Array.from(document.querySelectorAll("#modalQuestionList details")).indexOf(details),
    };
  
    fetch(`https://gemini-j8xd.onrender.com/delete-question/${id}?email=${encodeURIComponent(localStorage.getItem("userEmail"))}`, {
      method: "DELETE"
    })
      .then(res => {
        if (res.ok) {
          details.remove();
          shouldReloadQuestions = true;
          currentTitle = "";
  
          // Güncelle numaralar
          document.querySelectorAll("#modalQuestionList details").forEach((d, i) => {
            const summary = d.querySelector("summary");
            if (summary) {
              const content = summary.innerText.replace(/^Q\d+\.\s*/, "").trim();
              summary.innerText = `Q${i + 1}. ${content}`;
            }
          });
  
         
  
          // ✅ Geri Al kutusunu göster
          try {
            showUndoButton();
          } catch (e) {
            console.error("⚠️ Undo button error:", e);
          }
        } else {
          console.warn("⚠️ Silme başarılı ama sunucu 200 dönmedi.");
          alert("❌ Could not be deleted.");
        }
      })
      .catch(err => {
        console.error("❌ Server error:", err);
        alert("❌ Server error");
      });
  }
  
  

  
  // Placeholder edit fonksiyonu
  
  
  
  function saveEditedQuestion(id, btn) {
  const details = btn.closest("details");
  const inputs = details.querySelectorAll("input");
  const textarea = details.querySelector("textarea");

  const updated = {
    question: inputs[0].value,
    options: Array.from(inputs).slice(1, 5).map(i => i.value),
    answer: inputs[5].value,
    explanation: textarea.value
  };

  // 🔒 Lock buttons + show spinner
  disableAllButtons();

  fetch(`https://gemini-j8xd.onrender.com/update-question/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(updated)
  })
  .then(res => {
    if (res.ok) {
      shouldReloadQuestions = true;
      currentTitle = "";
      location.reload(); // ✅ Page will reload, spinner will vanish naturally
    } else {
      alert("❌ Update failed.");
    }
  })
  .catch(() => alert("❌ Server error"))
  .finally(() => {
    // ✅ Only re-enable buttons if page is not reloading
    enableAllButtons();
  });
}

  

  
  
  function createAutoResizingTextarea(value) {
    const textarea = document.createElement("textarea");
    textarea.value = value;
  
    textarea.style.width = "100%";
    textarea.style.fontSize = "14px";
    textarea.style.padding = "4px 6px";
    textarea.style.lineHeight = "1.3";
    textarea.style.border = "1px solid #ccc";
    textarea.style.borderRadius = "6px";
    textarea.style.resize = "none";
    textarea.style.overflow = "hidden";
    textarea.style.minHeight = "1px";
  
    const adjustHeight = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    };
  
    textarea.addEventListener("input", adjustHeight);
  
    // ✅ DOM'a EKLENDİĞİNDE çalışsın
    setTimeout(() => {
      requestAnimationFrame(() => {
        if (document.body.contains(textarea)) {
          adjustHeight();
        }
      });
    }, 10); // küçük bir gecikmeyle
  
    return textarea;
  }
  
  
  
 
  
  
  
  
  
  
  window.cancelExistingEdit = function (block) {
    if (block?.dataset?.originalHTML) {
      block.innerHTML = block.dataset.originalHTML;
      delete block.dataset.originalHTML;
  
      if (window.MathJax) {
        MathJax.startup.document.clear();
        MathJax.startup.document.updateDocument();
        MathJax.typesetPromise([block]).catch(console.error);
      }
    }
    // 🆕 Cancel edince arka planı temizle
    block.style.backgroundColor = "";
  };
  
  
  
  
  
  
  
  
 window.saveExistingQuestion = async function (id, btn) {
  const block = btn.closest("details");
  if (!block) return;

  const textareas = block.querySelectorAll("textarea.q-edit");
  const difficultySelect = block.querySelector("select.q-difficulty");

  const newContent = {};
  textareas.forEach(t => {
    const key = t.dataset.key;
    newContent[key] = t.value.trim();
  });

  const updatedQuestion = {
    question: newContent.question || "",
    options: [
      newContent.option0 || "",
      newContent.option1 || "",
      newContent.option2 || "",
      newContent.option3 || ""
    ],
    answer: newContent.answer || "",
    explanation: newContent.explanation || "",
    difficulty: difficultySelect?.value || "medium"
  };

  try {
    disableAllButtons(); // 🔒 Lock the interface
    const token = localStorage.getItem("accessToken");
    if (!token) throw new Error("No token found.");

    const response = await fetch(`https://gemini-j8xd.onrender.com/update-question/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({
        question: updatedQuestion.question,
        options: updatedQuestion.options,
        explanation: updatedQuestion.explanation,
        difficulty: updatedQuestion.difficulty,
        answer: "placeholder"
      })
    });

    if (!response.ok) throw new Error(`Server error ${response.status}`);

    const isModal = !!block.closest("#modalQuestionList");
    const oldSummary = block.querySelector("summary");
    let qNumberText = "Q?";
    const match = oldSummary?.innerText?.match(/^Q(\d+)/i);
    if (match) {
      qNumberText = `Q${match[1]}`;
    }

    block.innerHTML = `
      <summary style="display:flex; justify-content:space-between; align-items:center;">
        <div style="flex-grow:1;">
          <b>${qNumberText}.</b> 
          <span class="q" data-key="question" data-latex="${updatedQuestion.question}">${updatedQuestion.question}</span>
        </div>
        ${!isModal ? `
        <label style="margin-left:8px;">
          <input type="checkbox" class="qcheck" onchange="toggleHighlight(this)"> ✅
        </label>
        ` : ""}
      </summary>
      <ul>
        ${updatedQuestion.options.map(opt => `
          <li class="q" data-key="option" data-latex="${opt}">${opt}</li>
        `).join("")}
      </ul>
      <p><strong>✅ Answer:</strong> <span class="q" data-key="answer" data-latex="${updatedQuestion.answer}">${updatedQuestion.answer}</span></p>
      <p><strong>💡 Explanation:</strong> <span class="q" data-key="explanation" data-latex="${updatedQuestion.explanation}">${updatedQuestion.explanation}</span></p>
      <p class="difficulty-line" data-level="${updatedQuestion.difficulty}">
        <strong>Difficulty:</strong> ${
          updatedQuestion.difficulty === "easy" ? "🟢 Easy" :
          updatedQuestion.difficulty === "hard" ? "🔴 Hard" :
          "🟡 Medium"
        }
      </p>
      <div style="margin-top:8px;">
        <button onclick="editExistingQuestion(${id})">✏️ Edit</button>
        <button onclick="deleteExistingQuestion(${id}, this)">🗑️ Delete</button>
      </div>
    `;

    if (window.MathJax) {
      MathJax.startup.document.clear();
      MathJax.startup.document.updateDocument();
      await MathJax.typesetPromise([block]);
    }

    block.style.backgroundColor = "#dcfce7";
    setTimeout(() => {
      block.style.backgroundColor = "";
    }, 2000);

    const msg = document.createElement("div");
    msg.textContent = "✅ Saved successfully!";
    msg.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: #4ade80;
      color: #fff;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: bold;
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
      z-index: 10000;
      opacity: 0;
      transition: all 0.5s ease;
    `;
    document.body.appendChild(msg);
    setTimeout(() => { msg.style.opacity = 1; }, 100);
    setTimeout(() => { msg.style.opacity = 0; }, 2000);
    setTimeout(() => { msg.remove(); }, 2500);

  } catch (error) {
    console.error("❌ Save Error:", error);
    alert(`❌ Failed to save. ${error.message}`);
  } finally {
    enableAllButtons(); // ✅ Restore interface no matter what
  }
};

  
  
  
  
  function refreshMath() {
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(err => console.error("MathJax render error:", err));
    }
  }
  
  
  
  
  document.getElementById("quizTitle")?.addEventListener("input", () => {
    const newTitle = document.getElementById("quizTitle")?.value.trim();
    if (newTitle !== currentTitle) {
      shouldReloadQuestions = true;
    }
  });
  
  
  function showUndoButton() {
    const container = document.getElementById("modalQuestionList");
    if (!container || !lastDeletedQuestion) return;
  
    const existingUndo = document.getElementById("undoBox");
    if (existingUndo) existingUndo.remove();
  
    const box = document.createElement("div");
    box.id = "undoBox";
    box.style = "text-align:center; margin-top:10px;";
    box.innerHTML = `
      <button style="padding:6px 14px; background:#facc15; border:none; border-radius:8px; font-weight:600; cursor:pointer;">
        🔙 Geri Al Silinen Soruyu
      </button>
    `;
  
    box.querySelector("button").onclick = () => {
      if (!lastDeletedQuestion) return;
  
      const temp = document.createElement("div");
      temp.innerHTML = lastDeletedQuestion.html;
      const restored = temp.firstElementChild;
  
      const all = document.querySelectorAll("#modalQuestionList details");
      const targetIndex = lastDeletedQuestion.index;
  
      if (targetIndex >= 0 && targetIndex <= all.length) {
        container.insertBefore(restored, all[targetIndex]);
      } else {
        container.appendChild(restored);
      }
  
      // 🎯 Yeşil border ile belirginleştir
      restored.style.border = "2px solid #4ade80"; // yeşil
      restored.style.boxShadow = "0 0 6px rgba(34,197,94,0.4)";
      setTimeout(() => {
        restored.style.border = "";
        restored.style.boxShadow = "";
      }, 2500); // 2.5 saniyede normalleşir
  
      // numaraları güncelle
      document.querySelectorAll("#modalQuestionList details").forEach((d, i) => {
        const summary = d.querySelector("summary");
        if (summary) {
          const content = summary.innerText.replace(/^Q\d+\.\s*/, "").trim();
          summary.innerHTML = `Q${i + 1}. ${content}`;
        }
      });
  
     
      showToast("✅ Soru geri alındı");
      lastDeletedQuestion = null;
      box.remove();
    };
  
    container.appendChild(box);
  }
  
  function showToast(message = "Operation completed") {
    const toast = document.createElement("div");
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 10px 18px;
      border-radius: 8px;
      font-size: 14px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: fadein 0.3s, fadeout 0.5s 2.5s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
  
  function filterQuestions() {
    const val = document.getElementById("searchInput").value.toLowerCase();
    document.querySelectorAll("#modalQuestionList details").forEach(detail => {
      const text = detail.innerText.toLowerCase();
      detail.style.display = text.includes(val) ? "" : "none";
    });
  }
  function updateStats() {
    const total = document.querySelectorAll("#modalQuestionList details").length;
   
    let statBox = document.getElementById("statsBox");
    if (!statBox) {
      statBox = document.createElement("div");
      statBox.id = "statsBox";
      statBox.style = "padding:10px 16px; font-size:14px; font-weight:500;";
      document.getElementById("modalQuestionList").prepend(statBox);
    }
  
    statBox.innerHTML = `📊 Toplam Soru: ${total} `;
  }
  document.addEventListener("keydown", function (e) {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      if (lastDeletedQuestion) {
        e.preventDefault();
        const undoBtn = document.querySelector("#undoBox button");
        if (undoBtn) undoBtn.click();
      }
    }
  });
  
  
  

// === Fonksiyonları global scope'a aç ===


window.filterQuestions = filterQuestions;


window.deleteExistingQuestion = deleteExistingQuestion;
function expandAllModalDetails(open = true) {
  document.querySelectorAll("#modalQuestionList details").forEach(d => d.open = open);
}

window.editExistingQuestion = function (id) {
    const btn = document.querySelector(`button[onclick="editExistingQuestion(${id})"]`);
    const block = btn?.closest("details");
    if (!block) return;
    if (block.querySelector("textarea")) return;
  
    // 🆕 Edit başlarken eski HTML sakla
    if (!block.dataset.originalHTML) {
      block.dataset.originalHTML = block.innerHTML;
    }
  
    const summary = block.querySelector("summary");
    let questionSpan = summary.querySelector(".q[data-key='question']");
    let questionText = "";
  
    if (questionSpan) {
      questionText = questionSpan.dataset.latex || questionSpan.textContent.trim();
    } else {
      const match = summary?.textContent.match(/^Q\d+\.\s*(.*)$/);
      questionText = match?.[1] || summary?.textContent.trim() || "";
    }
  
    const createAutoResizingTextarea = (value, key) => {
      const textarea = document.createElement("textarea");
      textarea.className = "q-edit";
      textarea.dataset.key = key;
      textarea.value = value;
      textarea.style.cssText = `
        width: 100%; margin-top: 8px; padding: 8px; font-size: 15px;
        border-radius: 6px; overflow: hidden; resize: none; line-height: 1.2; height: 1.1em; min-height: 1.1em;
      `;
      textarea.addEventListener("input", () => {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      });
      setTimeout(() => {
        textarea.style.height = textarea.scrollHeight + "px";
      }, 30);
      return textarea;
    };
  
    const qTextarea = createAutoResizingTextarea(questionText, "question");
    summary.insertAdjacentElement("afterend", qTextarea);
  
    qTextarea.addEventListener("input", () => {
      if (questionSpan) {
        const newText = qTextarea.value.trim();
        questionSpan.textContent = newText;
        questionSpan.dataset.latex = newText;
        if (window.MathJax?.typesetPromise) MathJax.typesetPromise([questionSpan]);
      }
    });
  
    const options = block.querySelectorAll("ul li");
    options.forEach((li, i) => {
      const val = li.dataset.latex || li.textContent.trim();
      const textarea = createAutoResizingTextarea(val, `option${i}`);
      li.insertAdjacentElement("afterend", textarea);
    });
  const answerSpan = block.querySelector(".q[data-key='answer']");
if (answerSpan) {
  const val = answerSpan.dataset.latex || answerSpan.textContent.trim();
  const textarea = createAutoResizingTextarea(val, "answer");
  answerSpan.insertAdjacentElement("afterend", textarea);
}

    const expSpan = block.querySelector(".q[data-key='explanation']");
    if (expSpan) {
      const val = expSpan.dataset.latex || expSpan.textContent.trim();
      const textarea = createAutoResizingTextarea(val, "explanation");
      expSpan.insertAdjacentElement("afterend", textarea);
    }
  
    const diffText = block.querySelector(".difficulty-line")?.innerText.toLowerCase() || "";
    let difficulty = "medium";
    if (diffText.includes("easy")) difficulty = "easy";
    else if (diffText.includes("hard")) difficulty = "hard";
  
    const select = document.createElement("select");
    select.className = "q-difficulty";
    select.style.cssText = "margin-top: 8px; padding: 8px 10px; font-size: 14px; border-radius: 6px;";
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
    block.appendChild(select);
  
    // ✅ Save ve Cancel butonları
    const btnRow = document.createElement("div");
    btnRow.style.marginTop = "10px";
  
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "✅ Save";
    saveBtn.onclick = () => saveExistingQuestion(id, saveBtn);
    saveBtn.style.marginRight = "8px";
  
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "❌ Cancel";
    cancelBtn.onclick = () => cancelExistingEdit(block);
  
    btnRow.appendChild(saveBtn);
    btnRow.appendChild(cancelBtn);
    block.appendChild(btnRow);
  
    // 🆕 Edit sırasında arka planı sarı yap
    block.style.backgroundColor = "#fef9c3"; // light yellow
  
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([block]).catch(console.error);
    }
  };
  
  
  
  
  window.cancelExistingEdit = function (block) {
    if (block?.dataset?.originalHTML) {
      block.innerHTML = block.dataset.originalHTML;
      delete block.dataset.originalHTML;
  
      if (window.MathJax) {
        MathJax.startup.document.clear();
        MathJax.startup.document.updateDocument();
        MathJax.typesetPromise([block]).catch(console.error);
      }
    }
    // 🆕 Cancel edince arka planı temizle
    block.style.backgroundColor = "";
  };
