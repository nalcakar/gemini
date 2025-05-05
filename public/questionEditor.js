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
  
      // ✅ Modal mı normal mi ayırt et
      const isModal = !!block.closest("#modalQuestionList");
  
      // ✅ Q numarasını eski summary'den yakala
      const oldSummary = block.querySelector("summary");
      let qNumberText = "Q?";
      const match = oldSummary?.innerText?.match(/^Q(\d+)/i);
      if (match) {
        qNumberText = `Q${match[1]}`;
      }
  
      // ✅ Kartı baştan güncelle
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
        <p><strong>✅ Answer:</strong> <span class="q" data-key="answer" data-latex="${answer}">${answer}</span></p>

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
  
      // ✅ MathJax sıfırla ve sadece bu blok için yeniden çalıştır
      if (window.MathJax) {
        MathJax.startup.document.clear();
        MathJax.startup.document.updateDocument();
        MathJax.typesetPromise([block]).catch(console.error);
      }
  
      // ✅ Save sonrası kartı yeşil yap, sonra eski haline dön
      block.style.backgroundColor = "#dcfce7"; // light green
      setTimeout(() => {
        block.style.backgroundColor = "";
      }, 2000);
  
      // ✅ Başarı mesajı (ufak toast)
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