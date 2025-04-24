let lastDeletedQuestion = null;
let currentTitle = "";
let shouldReloadQuestions = false;


  
  
  function closeModal() {
    document.getElementById("questionModal").classList.remove("show");
  }
  
  // Silme fonksiyonu
  function deleteExistingQuestion(id, btn) {
    if (!confirm("Bu soruyu silmek istediğinizden emin misiniz?")) return;
  
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
          alert("❌ Silinemedi.");
        }
      })
      .catch(err => {
        console.error("❌ Server error:", err);
        alert("❌ Sunucu hatası");
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
          location.reload(); // reloads the modal content
        } else {
          alert("❌ Update failed.");
        }
      })
      .catch(() => alert("❌ Server error"));
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
    const details = btn?.closest("details");
    if (!details) return;
  
    // ❌ Cancel all other edits
    document.querySelectorAll("details").forEach(d => {
      const original = d.dataset.originalHTML;
      if (original) {
        d.innerHTML = original;
        delete d.dataset.originalHTML;
      }
    });
  
    document.querySelectorAll('button[onclick^="editExistingQuestion"]').forEach(b => b.disabled = true);
    document.querySelectorAll('button[onclick^="deleteExistingQuestion"]').forEach(b => b.disabled = true);
  
    // ✅ Get original question from <summary>
    const summary = details.querySelector("summary");
    const originalText = summary?.innerText || "";
    const match = originalText.match(/^Q\d+\.\s*(.+)$/);
    const question = match ? match[1].trim() : "";
  
    // ✅ Get options from <li>
    const listItems = details.querySelectorAll("ul li");
    const options = Array.from(listItems).map(li => li.innerText.trim());
  
    // ✅ Get explanation (with fallback logic)
    let explanation = "";
    const explanationSpan = details.querySelector("span.q[data-key='explanation']");
    if (explanationSpan) {
      explanation = explanationSpan.innerText.trim();
    } else {
      const explanationP = Array.from(details.querySelectorAll("p")).find(p =>
        p.innerText.toLowerCase().includes("explanation") || p.innerText.toLowerCase().includes("açıklama")
      );
      if (explanationP) {
        explanation = explanationP.innerText.replace(/💡?\s*(Explanation|Açıklama):?\s*/i, "").trim();
      }
    }
  
    // ✅ Store original HTML to support cancel
    details.dataset.originalHTML = details.innerHTML;
  
    // 📝 Edit banner
    const label = document.createElement("div");
    label.innerHTML = `<span style="display:inline-block; background:#fcd34d; color:#78350f; padding:4px 10px; border-radius:6px; font-size:13px; font-weight:500; margin-bottom:10px;">📝 Editing mode</span>`;
  
    // ✅ Question textarea
    const qTextarea = createAutoResizingTextarea(question);
    qTextarea.dataset.key = "question";
    const summaryText = document.createElement("div");
    summaryText.innerHTML = "<strong>Question:</strong>";
    summaryText.appendChild(qTextarea);
  
    // ✅ Options
    const optionTextareas = options.map((opt, index) => {
      const t = createAutoResizingTextarea(opt);
      t.dataset.key = `option${index + 1}`;
      return t;
    });
  
    // ✅ Explanation
    const explanationDiv = document.createElement("div");
    explanationDiv.innerHTML = "<p><strong>💡 Explanation:</strong></p>";
    const explanationTextarea = createAutoResizingTextarea(explanation);
    explanationTextarea.dataset.key = "explanation";
    explanationDiv.appendChild(explanationTextarea);
  
    // ✅ Difficulty select dropdown
    const difficultySelectWrapper = document.createElement("div");
    difficultySelectWrapper.style.margin = "10px 0";
    difficultySelectWrapper.innerHTML = `
      <label><strong>Difficulty:</strong>
        <select id="difficulty-${id}" style="margin-left:8px; padding:6px; border-radius:6px;">
          <option value="">(None)</option>
          <option value="easy">🟢 Easy</option>
          <option value="medium">🟡 Medium</option>
          <option value="hard">🔴 Hard</option>
        </select>
      </label>
    `;
    const currentDifficulty = details.dataset.difficulty || "";
    difficultySelectWrapper.querySelector("select").value = currentDifficulty;
  
    // ✅ Buttons
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "💾 Save";
    saveBtn.style = "padding:8px 16px; margin-right:10px; background-color:#10b981; color:white; border:none; border-radius:8px; cursor:pointer;";
    saveBtn.onclick = () => saveExistingQuestion(id, saveBtn);
  
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "❌ Cancel";
    cancelBtn.style = "padding:8px 16px; background-color:#ef4444; color:white; border:none; border-radius:8px; cursor:pointer;";
    cancelBtn.onclick = () => {
      details.innerHTML = details.dataset.originalHTML || "";
      delete details.dataset.originalHTML;
      document.querySelectorAll('button[onclick^="editExistingQuestion"]').forEach(b => b.disabled = false);
      document.querySelectorAll('button[onclick^="deleteExistingQuestion"]').forEach(b => b.disabled = false);
    };
  
    const btnWrapper = document.createElement("div");
    btnWrapper.style.marginTop = "10px";
    btnWrapper.appendChild(saveBtn);
    btnWrapper.appendChild(cancelBtn);
  
    // ✅ Assemble everything
    details.innerHTML = "";
    details.appendChild(label);
    details.appendChild(summaryText);
    optionTextareas.forEach(t => details.appendChild(t));
    details.appendChild(explanationDiv);
    details.appendChild(difficultySelectWrapper);
    details.appendChild(btnWrapper);
  };
  
  
  
  
  async function saveExistingQuestion(id, btn) {
    const details = btn.closest("details");
    const textareas = details.querySelectorAll("textarea");
  
    const question = textareas[0]?.value.trim();
    const options = Array.from(textareas).slice(1, 5).map(t => t.value.trim());
    const explanation = textareas[5]?.value.trim();
    const difficulty = document.getElementById(`difficulty-${id}`)?.value || "";
  
    const token = localStorage.getItem("accessToken");
    const email = localStorage.getItem("userEmail");
  
    const res = await fetch(`https://gemini-j8xd.onrender.com/update-question/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ question, options, explanation, difficulty, answer: "placeholder" })
    });
  
    if (res.ok) {
      alert("✅ Updated");
  
      // ❗ Orijinal Qx. numarasını summary'den al
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
  
      if (window.MathJax) {
        MathJax.typesetPromise?.();
      }
    } else {
      alert("❌ Update failed.");
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
  
  function showToast(message = "İşlem tamamlandı") {
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