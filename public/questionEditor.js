let lastDeletedQuestion = null;
let currentTitle = "";
let shouldReloadQuestions = false;

function openModal() {
    const titleName = document.getElementById("quizTitle")?.value.trim();
    const token = localStorage.getItem("accessToken");
    const email = localStorage.getItem("userEmail");
    const modal = document.getElementById("questionModal");
    const container = document.getElementById("modalQuestionList");
  
    modal.classList.add("show");
  
    if (!titleName || !token) {
      container.innerHTML = "<p style='color:red;'>Başlık veya oturum bilgisi eksik.</p>";
      return;
    }
  
    if (!shouldReloadQuestions && currentTitle === titleName) return;
  
    container.innerHTML = "<p style='text-align:center;'>Yükleniyor...</p>";
  
    fetch(`https://gemini-j8xd.onrender.com/get-questions-by-name?title=${encodeURIComponent(titleName)}&email=${encodeURIComponent(email)}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (!data.questions || data.questions.length === 0) {
          container.innerHTML = "<p style='color:gray;'>Bu başlığa ait hiç soru bulunamadı.</p>";
          return;
        }
  
        container.innerHTML = `<p>📌 Toplam Soru: <strong>${data.questions.length}</strong></p>`;
  
        data.questions.forEach((q, i) => {
          const block = document.createElement("details");
  
          // 🎨 Zorluk rozeti
          let badge = "";
          if (q.difficulty === "easy") {
            badge = `<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">🟢 Kolay</span>`;
          }
          if (q.difficulty === "medium") {
            badge = `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">🟡 Orta</span>`;
          }
          if (q.difficulty === "hard") {
            badge = `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">🔴 Zor</span>`;
          }
  
          block.innerHTML = `
            <summary>Q${i + 1}. ${q.question} ${badge}</summary>
            <ul>${q.options.map(opt => `<li>${opt}</li>`).join("")}</ul>
            <p><strong>💡 Açıklama:</strong> ${q.explanation}</p>
            <div style="margin-top: 8px;">
              <button onclick="editExistingQuestion(${q.id})">✏️ Düzenle</button>
              <button onclick="deleteExistingQuestion(${q.id}, this)">🗑️ Sil</button>
            </div>
          `;
          container.appendChild(block);
        });
  
        currentTitle = titleName;
        shouldReloadQuestions = false;
  
        // MathJax varsa render et
        if (window.MathJax) {
          MathJax.typesetPromise?.();
        }
  
        // Gerekirse istatistik vs. güncelle
        updateStats?.();
  
      })
      .catch(err => {
        container.innerHTML = "<p style='color:red;'>❌ Sorular alınamadı.</p>";
        console.error("get-questions error:", err);
      });
  }
  
  
  
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
  
          collapseAllDetails();
  
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
  
  
  function collapseAllDetails() {
    document.querySelectorAll("#modalQuestionList details").forEach(d => d.open = false);
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
    textarea.style.margin = "6px 0";
    textarea.style.fontSize = "15px";
    textarea.style.padding = "6px";
    textarea.style.lineHeight = "1.4";
    textarea.style.borderRadius = "6px";
    textarea.style.border = "1px solid #ccc";
    textarea.style.overflow = "hidden";
    textarea.style.resize = "none";
    textarea.style.minHeight = "32px";
  
    const adjustHeight = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    };
  
    textarea.addEventListener("input", adjustHeight);
  
    // 🛠 Modal gibi geç açılan yerlerde bekleyerek doğru ölçüm alıyoruz
    setTimeout(() => {
      adjustHeight();
    }, 30);
  
    return textarea;
  }
  
  function editExistingQuestion(id) {
    const btn = document.querySelector(`button[onclick="editExistingQuestion(${id})"]`);
    const details = btn?.closest("details");
    if (!details) return;
  
    // Diğer düzenlemeleri iptal et
    document.querySelectorAll("details").forEach(d => {
      const original = d.dataset.originalHTML;
      if (original) {
        d.innerHTML = original;
        delete d.dataset.originalHTML;
      }
    });
  
    // Diğer düzenle/sil butonlarını devre dışı bırak
    document.querySelectorAll('button[onclick^="editExistingQuestion"]').forEach(b => b.disabled = true);
    document.querySelectorAll('button[onclick^="deleteExistingQuestion"]').forEach(b => b.disabled = true);
  
    const summary = details.querySelector("summary");
    const listItems = details.querySelectorAll("ul li");
    const explanationP = Array.from(details.querySelectorAll("p")).find(p => p.innerHTML.includes("Açıklama"));
  
    const question = summary?.innerText.replace(/^Q\d+\.\s*/, "").replace(/(Kolay|Orta|Zor)/, "").trim();
    const options = Array.from(listItems).map(li => li.innerText);
    const explanation = explanationP?.innerText.replace("💡 Açıklama:", "").trim();
  
    // Orijinal HTML’i sakla
    details.dataset.originalHTML = details.innerHTML;
  
    const label = document.createElement("div");
    label.innerHTML = `<span style="display:inline-block; background:#fcd34d; color:#78350f; padding:4px 10px; border-radius:6px; font-size:13px; font-weight:500; margin-bottom:10px;">📝 Düzenleme modunda</span>`;
  
    const qTextarea = createAutoResizingTextarea(question);
    const summaryText = document.createElement("div");
    summaryText.innerHTML = "<strong>Soru:</strong>";
    summaryText.appendChild(qTextarea);
  
    const optionTextareas = options.map(opt => createAutoResizingTextarea(opt));
  
    const explanationDiv = document.createElement("div");
    explanationDiv.innerHTML = "<p><strong>💡 Açıklama:</strong></p>";
    const explanationTextarea = createAutoResizingTextarea(explanation);
    explanationDiv.appendChild(explanationTextarea);
  
    // 🎨 Zorluk seçimi
    const difficultySelectWrapper = document.createElement("div");
    difficultySelectWrapper.style.margin = "10px 0";
    difficultySelectWrapper.innerHTML = `
      <label><strong>Zorluk:</strong>
        <select id="difficulty-${id}" style="margin-left:8px; padding:6px; border-radius:6px;">
          <option value="">(Yok)</option>
          <option value="easy">🟢 Kolay</option>
          <option value="medium">🟡 Orta</option>
          <option value="hard">🔴 Zor</option>
        </select>
      </label>
    `;
  
    const currentDifficulty = summary?.innerText.includes("Kolay") ? "easy" :
                             summary?.innerText.includes("Orta") ? "medium" :
                             summary?.innerText.includes("Zor") ? "hard" : "";
    difficultySelectWrapper.querySelector("select").value = currentDifficulty;
  
    const saveBtn = document.createElement("button");
    saveBtn.textContent = "💾 Kaydet";
    saveBtn.style.padding = "8px 16px";
    saveBtn.style.marginRight = "10px";
    saveBtn.style.backgroundColor = "#10b981";
    saveBtn.style.color = "white";
    saveBtn.style.border = "none";
    saveBtn.style.borderRadius = "8px";
    saveBtn.style.cursor = "pointer";
    saveBtn.onclick = () => saveExistingQuestion(id, saveBtn);
  
    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "❌ İptal";
    cancelBtn.style.padding = "8px 16px";
    cancelBtn.style.backgroundColor = "#ef4444";
    cancelBtn.style.color = "white";
    cancelBtn.style.border = "none";
    cancelBtn.style.borderRadius = "8px";
    cancelBtn.style.cursor = "pointer";
  
    cancelBtn.onclick = () => {
      details.innerHTML = details.dataset.originalHTML || "";
      delete details.dataset.originalHTML;
  
      document.querySelectorAll('button[onclick^="editExistingQuestion"]').forEach(b => b.disabled = false);
      document.querySelectorAll('button[onclick^="deleteExistingQuestion"]').forEach(b => b.disabled = false);
    };
  
    details.innerHTML = "";
    details.appendChild(label);
    details.appendChild(summaryText);
    optionTextareas.forEach(t => details.appendChild(t));
    details.appendChild(explanationDiv);
    details.appendChild(difficultySelectWrapper);
  
    const btnWrapper = document.createElement("div");
    btnWrapper.style.marginTop = "10px";
    btnWrapper.appendChild(saveBtn);
    btnWrapper.appendChild(cancelBtn);
    details.appendChild(btnWrapper);
  }
  
  
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
      body: JSON.stringify({ question, options, explanation, difficulty, answer: "placeholder" })  // 👈 answer zorunlu, dummy değer gönderiyoruz
    });
  
    if (res.ok) {
      alert("✅ Güncellendi");
  
      const qIndex = Array.from(document.querySelectorAll("details")).indexOf(details);
      let badge = "";
      if (difficulty === "easy") badge = `<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:6px;font-size:12px;">🟢 Kolay</span>`;
      if (difficulty === "medium") badge = `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:6px;font-size:12px;">🟡 Orta</span>`;
      if (difficulty === "hard") badge = `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:6px;font-size:12px;">🔴 Zor</span>`;
  
      const newHTML = `
        <summary>Q${qIndex + 1}. ${question} ${badge}</summary>
        <ul>${options.map(opt => `<li>${opt}</li>`).join("")}</ul>
        <p><strong>💡 Açıklama:</strong> ${explanation}</p>
        <div style="margin-top: 8px;">
          <button onclick="editExistingQuestion(${id})">✏️ Düzenle</button>
          <button onclick="deleteExistingQuestion(${id}, this)">🗑️ Sil</button>
        </div>
      `;
      details.innerHTML = newHTML;
  
      document.querySelectorAll('button[onclick^="editExistingQuestion"]').forEach(b => b.disabled = false);
      document.querySelectorAll('button[onclick^="deleteExistingQuestion"]').forEach(b => b.disabled = false);
  
      shouldReloadQuestions = true;
      currentTitle = "";
  
      if (window.MathJax) {
        MathJax.typesetPromise?.();
      }
    } else {
      alert("❌ Güncelleme başarısız.");
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
  
      collapseAllDetails();
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
  function filterByDifficulty(level) {
    document.querySelectorAll("#modalQuestionList details").forEach(detail => {
      const summary = detail.querySelector("summary");
      const text = summary?.innerText || "";
      if (level === "") {
        detail.style.display = ""; // tümünü göster
      } else {
        detail.style.display = text.includes(level === "easy" ? "Kolay" :
                                             level === "medium" ? "Orta" :
                                             level === "hard" ? "Zor" : "")
                               ? "" : "none";
      }
    });
  }

// === Fonksiyonları global scope'a aç ===
window.openModal = openModal;
window.closeModal = closeModal;
window.collapseAllDetails = collapseAllDetails;
window.filterQuestions = filterQuestions;
window.filterByDifficulty = filterByDifficulty;
window.editExistingQuestion = editExistingQuestion;
window.deleteExistingQuestion = deleteExistingQuestion;
