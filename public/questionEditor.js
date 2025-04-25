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
        location.reload();
      } else {
        alert("❌ Update failed.");
      }
    })
    .catch(() => alert("❌ Server error"))
    .finally(() => {
      // ✅ Butonları tekrar aktif et
      document.querySelectorAll('button[onclick^="editExistingQuestion"]').forEach(b => b.disabled = false);
      document.querySelectorAll('button[onclick^="deleteExistingQuestion"]').forEach(b => b.disabled = false);
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
  
  
  
  window.editExistingQuestion = function (id) {
    const btn = document.querySelector(`button[onclick="editExistingQuestion(${id})"]`);
    const block = btn?.closest("details");
    if (!block) return;
    if (block.querySelector("textarea")) return;
  
    const summary = block.querySelector("summary");
    let questionSpan = summary.querySelector(".q[data-key='question']");
    let questionText = "";
  
    if (questionSpan) {
      questionText = questionSpan.dataset.latex || questionSpan.textContent.trim();
    } else {
      const match = summary.textContent.match(/^Q\d+\.\s*(.*)$/);
      questionText = match?.[1] || summary.textContent.trim();
  
      questionSpan = document.createElement("span");
      questionSpan.className = "q";
      questionSpan.dataset.key = "question";
      questionSpan.dataset.latex = questionText;
      questionSpan.textContent = questionText;
      summary.innerHTML = `Q${id}. `;
      summary.appendChild(questionSpan);
    }
  
    const enableAutoUpdate = (textarea, targetEl) => {
      const resize = () => {
        textarea.style.height = "auto";
        textarea.style.height = textarea.scrollHeight + "px";
      };
      const applyResize = () => {
        if (document.body.contains(textarea)) resize();
      };
      textarea.addEventListener("input", () => {
        const val = textarea.value.trim();
        if (targetEl) {
          targetEl.textContent = val;
          targetEl.dataset.latex = val;
          if (window.MathJax?.typesetPromise) MathJax.typesetPromise([targetEl]).then(resize);
        }
        resize();
      });
      setTimeout(resize, 30);
    };
  
    const qTextarea = document.createElement("textarea");
    qTextarea.value = questionText;
    qTextarea.className = "q-edit";
    qTextarea.dataset.key = "question";
    qTextarea.style.cssText = `
      width: 100%; margin-top: 8px; padding: 8px; font-size: 15px;
      border-radius: 6px; overflow: hidden; resize: none; line-height: 1.1; height: 1.1em; min-height: 1.1em;
    `;
    summary.insertAdjacentElement("afterend", qTextarea);
    enableAutoUpdate(qTextarea, questionSpan);
  
    // 📌 Şıklar (li elemanları varsa al, yoksa gösterme)
    const options = Array.from(block.querySelectorAll("ul li"));
    if (options.length > 0) {
      options.forEach((li, i) => {
        const val = li.dataset.latex || li.textContent.trim();
        const textarea = document.createElement("textarea");
        textarea.className = "q-edit";
        textarea.dataset.key = `option${i}`;
        textarea.value = val;
        textarea.style.cssText = `
          width: 100%; margin-top: 6px; padding: 6px;
          font-size: 14px; border-radius: 6px; resize: none; line-height: 1.1; height: 1.1em; min-height: 1.1em;
        `;
        li.insertAdjacentElement("afterend", textarea);
        enableAutoUpdate(textarea, li);
      });
    }
  
    // 📌 Açıklama
    const expSpan = block.querySelector(".q[data-key='explanation']");
    if (expSpan) {
      const val = expSpan.dataset.latex || expSpan.textContent.trim();
      const textarea = document.createElement("textarea");
      textarea.className = "q-edit";
      textarea.dataset.key = "explanation";
      textarea.value = val;
      textarea.style.cssText = `
        width: 100%; margin-top: 6px; padding: 6px;
        font-size: 14px; border-radius: 6px; resize: none; line-height: 1.4; height: 1.1em; min-height: 1.1em;
      `;
      expSpan.insertAdjacentElement("afterend", textarea);
      enableAutoUpdate(textarea, expSpan);
    }
  
    // 🎯 Zorluk seviyesi
    const difficultyText = block.querySelector(".difficulty-line")?.innerText.toLowerCase() || "";
    let difficulty = "medium";
    if (difficultyText.includes("easy")) difficulty = "easy";
    else if (difficultyText.includes("hard")) difficulty = "hard";
  
    const select = document.createElement("select");
    select.className = "q-difficulty";
    select.style.cssText = "margin-top: 6px; padding: 6px 10px; font-size: 14px; border-radius: 6px;";
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
  
    btn.textContent = "✅ Save";
    btn.onclick = () => saveExistingQuestion(id, btn);
  
    if (window.MathJax?.typesetPromise) {
      MathJax.typesetPromise();
    }
  };
  
  
  
  
  
  
  
  
  
  function saveExistingQuestion(id, btn) {
    const details = btn.closest("details");
    const textareas = details.querySelectorAll("textarea");
  
    const question = textareas[0]?.value.trim();
    const options = Array.from(textareas).slice(1, 5).map(t => t.value.trim());
    const explanation = textareas[5]?.value.trim();
    const difficulty = document.getElementById(`difficulty-${id}`)?.value || "";
  
    const token = localStorage.getItem("accessToken");
    const email = localStorage.getItem("userEmail");
  
    fetch(`https://gemini-j8xd.onrender.com/update-question/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ question, options, explanation, difficulty, answer: "placeholder" })
    })
      .then(res => {
        if (res.ok) {
          alert("✅ Updated");
  
          const oldSummary = details.querySelector("summary")?.innerText || "";
          const match = oldSummary.match(/^Q\d+\./);
          const prefix = match ? match[0] : "";
  
          let badge = "";
          if (difficulty === "easy") badge = `<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:6px;font-size:12px;">🟢 Easy</span>`;
          if (difficulty === "medium") badge = `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:6px;font-size:12px;">🟡 Medium</span>`;
          if (difficulty === "hard") badge = `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:6px;font-size:12px;">🔴 Hard</span>`;
  
          details.innerHTML = `
            <summary>${prefix} ${question}</summary>
            <p class="difficulty-line" data-level="${difficulty}">
              <strong>Difficulty:</strong> ${badge}
            </p>
            <ul>${options.map(opt => `<li>${opt}</li>`).join("")}</ul>
            <p><strong>💡 Explanation:</strong> ${explanation}</p>
            <div style="margin-top: 8px;">
              <button onclick="editExistingQuestion(${id})">✏️ Edit</button>
              <button onclick="deleteExistingQuestion(${id}, this)">🗑️ Delete</button>
            </div>
          `;
          details.dataset.difficulty = difficulty;
  
          document.querySelectorAll('button[onclick^="editExistingQuestion"]').forEach(b => b.disabled = false);
          document.querySelectorAll('button[onclick^="deleteExistingQuestion"]').forEach(b => b.disabled = false);
  
          shouldReloadQuestions = true;
          currentTitle = "";
  
          refreshMath();
        } else {
          alert("❌ Update failed.");
        }
      });
  }
  
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