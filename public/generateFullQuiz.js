async function generateFullQuiz() {
    let extractedText = window.extractedText || "";
  
    if (!extractedText) {
      const idsToCheck = ["textManualInput", "textOutput", "imageTextOutput", "audioTextOutput"];
      for (const id of idsToCheck) {
        const el = document.getElementById(id);
        if (el && el.value.trim().length > 0) {
          extractedText = el.value.trim();
          break;
        }
      }
    }
  
    if (!extractedText || extractedText.trim().length < 10) {
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
  
      const res = await fetch("https://gemini-j8xd.onrender.com/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({ mycontent: extractedText })
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
            explanation: explanationMatch ? explanationMatch[1].trim() : ""
          };
        });
  
      const output = document.getElementById("quizOutput");
      output.innerHTML = `<h3 style="text-align:center;">🎯 Generated Questions:</h3>`;
  
      parsedQuestions.forEach((q, i) => {
        const div = document.createElement("div");
        div.className = "quiz-preview";
        div.dataset.index = i;
  
        div.innerHTML = `
          <b>Q${i + 1}.</b> <span class="q" data-key="question">${q.question}</span>
          <ul>${q.options.map((opt, j) =>
            `<li class="q" data-key="option${j + 1}">${opt}</li>`).join("")}</ul>
          <p><strong>✅ Answer:</strong> <span class="q" data-key="answer">${q.answer}</span></p>
          <p><strong>💡 Explanation:</strong> <span class="q" data-key="explanation">${q.explanation}</span></p>
          ${isLoggedIn ? `<label><input type="checkbox" class="qcheck"> ✅ Kaydet</label>` : ""}
          <div style="margin-top: 8px;">
            <button onclick="editQuestion(this)">✏️ Düzenle</button>
            <button onclick="deleteQuestion(this)">🗑️ Sil</button>
          </div>
        `;
        output.appendChild(div);
      });
  
      // ✅ Kaydetme alanı sadece giriş yapan ve soru oluşturanlar için
      const saveBox = document.getElementById("saveQuizSection");
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
  
  // Düzenle: soruları input haline getir
  window.editQuestion = function (btn) {
    const block = btn.closest(".quiz-preview");
    const elements = block.querySelectorAll(".q");
  
    elements.forEach(el => {
      const val = el.innerText;
      const input = document.createElement("textarea");
      input.value = val;
      input.className = "q-edit";
      input.dataset.key = el.dataset.key;
      input.style = `
        width: 100%;
        min-height: 28px;
        font-size: 15px;
        margin-bottom: 6px;
        padding: 2px 4px;
        resize: none;
        overflow: hidden;
        line-height: 1.4;
      `;
  
      const autoResize = () => {
        input.style.height = "auto";
        input.style.height = input.scrollHeight + "px";
      };
  
      input.addEventListener("input", autoResize);
      autoResize();
      el.replaceWith(input);
    });
  
    btn.textContent = "✅ Güncelle";
    btn.onclick = () => saveQuestionEdits(block);
  };
  
  // Güncelle: textarea'yı geri yaz
  function saveQuestionEdits(block) {
    const edits = block.querySelectorAll(".q-edit");
    block.innerHTML = "";
    let html = `<b>Q${block.dataset.index * 1 + 1}.</b> `;
  
    edits.forEach((input, i) => {
      const key = input.dataset.key;
      const span = `<span class="q" data-key="${key}">${input.value.trim()}</span>`;
      if (key.startsWith("option")) {
        if (i === 1) html += `<ul>`;
        html += `<li class="q" data-key="${key}">${input.value.trim()}</li>`;
        if (i === 4) html += `</ul>`;
      } else if (key === "question") {
        html += span;
      } else if (key === "answer") {
        html += `<p><strong>✅ Answer:</strong> ${span}</p>`;
      } else if (key === "explanation") {
        html += `<p><strong>💡 Explanation:</strong> ${span}</p>`;
      }
    });
  
    const userEmail = localStorage.getItem("userEmail");
    if (userEmail) html += `<label><input type="checkbox" class="qcheck"> ✅ Kaydet</label>`;
  
    html += `
      <div style="margin-top: 8px;">
        <button onclick="editQuestion(this)">✏️ Düzenle</button>
        <button onclick="deleteQuestion(this)">🗑️ Sil</button>
      </div>`;
    block.innerHTML = html;
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
  async function saveSelectedQuestions() {
    const token = localStorage.getItem("accessToken");
    const email = localStorage.getItem("userEmail");
    if (!token || !email) return alert("❌ Lütfen giriş yapın.");
  
    const title = document.getElementById("quizTitle")?.value.trim();
    const categoryId = document.getElementById("categorySelect")?.value;
  
    if (!title || !categoryId) {
      alert("⚠️ Lütfen başlık ve kategori seçiniz.");
      return;
    }
  
    // 🔍 Kullanıcının yazdığı başlık daha önce var mı kontrolü (autocomplete listesi ile)
    const titleList = Array.from(document.querySelectorAll("#titleSuggestions option")).map(opt => opt.value);
    const isExistingTitle = titleList.includes(title);
  
    if (isExistingTitle) {
      const confirmOverwrite = confirm(
        `📘 "${title}" başlığı zaten var.\nYeni sorular bu başlığa eklenecek.\nDevam edilsin mi?`
      );
      if (!confirmOverwrite) return;
    }
  
    // ✅ Seçili soruları topla
    const questions = [];
    document.querySelectorAll(".quiz-preview").forEach(block => {
      const check = block.querySelector(".qcheck");
      if (check?.checked) {
        const q = {};
        block.querySelectorAll(".q").forEach(s => {
          const key = s.dataset.key;
          const val = s.innerText.trim();
          if (key.startsWith("option")) {
            q.options = q.options || [];
            q.options.push(val);
          } else {
            q[key] = val;
          }
        });
        questions.push(q);
      }
    });
  
    if (questions.length === 0) {
      alert("⚠️ Kaydetmek için en az bir soru seçmelisiniz.");
      return;
    }
  
    // 🚀 API'ye gönder
    try {
      const res = await fetch("https://gemini-j8xd.onrender.com/save-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          titleName: title,
          categoryId,
          questions
        })
      });
  
      const data = await res.json();
      if (res.ok) {
        alert("✅ Sorular başarıyla kaydedildi.");
      } else {
        alert("❌ Kaydedilemedi: " + (data?.error || "Sunucu hatası"));
      }
    } catch (err) {
      console.error("❌ Kayıt hatası:", err);
      alert("❌ Sunucuya bağlanılamadı.");
    }
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
      list.innerHTML = "";
  
      // Başlıkları datalist'e ekle
      data.titles.forEach(t => {
        const opt = document.createElement("option");
        opt.value = t.name;
        list.appendChild(opt);
      });
  
      // View Questions butonunu göster/gizle
      const titleInput = document.getElementById("quizTitle")?.value.trim();
      const matches = data.titles.map(t => t.name);
      const viewBtnWrapper = document.getElementById("viewQuestionsWrapper");
  
      if (titleInput && matches.includes(titleInput)) {
        viewBtnWrapper.style.display = "block";
      } else {
        viewBtnWrapper.style.display = "none";
      }
  
      // ✅ Mobil floating buton kontrolü
      updateFloatingButtonVisibility();
  
    } catch (err) {
      console.error("Failed to load titles:", err);
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
    const title = document.getElementById("quizTitle")?.value.trim();
    const suggestions = Array.from(document.querySelectorAll("#titleSuggestions option")).map(opt => opt.value);
    const token = localStorage.getItem("accessToken");
  
    const mobileBtn = document.getElementById("floatingMobileQuestionsBtn");
    const fixedBtn = document.getElementById("fixedQuestionsToggle");
  
    const valid = token && title.length > 0 && suggestions.includes(title);
  
    if (mobileBtn) mobileBtn.style.display = (valid && window.innerWidth < 768) ? "flex" : "none";
    if (fixedBtn) fixedBtn.classList.toggle("show", valid);
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
  
  /// edit
  function editSavedQuestion(button) {
    const block = button.closest(".question-block");
    const spans = block.querySelectorAll("[data-key]");
    spans.forEach(span => {
      const key = span.dataset.key;
      const val = span.textContent.trim();
      const input = document.createElement("textarea");
      input.value = val;
      input.dataset.key = key;
      input.className = "q-edit";
      input.style = "width:100%; margin-bottom:6px; padding:6px;";
      span.replaceWith(input);
    });
  
    button.textContent = "💾 Save";
    button.onclick = () => saveEditedQuestion(block.dataset.id, button);
  }

  
  async function saveEditedQuestion(questionId, button) {
    const block = button.closest(".question-block");
    const inputs = block.querySelectorAll("textarea.q-edit");
    const updated = { options: [] };
  
    inputs.forEach(input => {
      const key = input.dataset.key;
      const value = input.value.trim();
  
      if (key.startsWith("option")) {
        updated.options.push(value);
      } else {
        updated[key] = value;
      }
    });
  
    const token = localStorage.getItem("accessToken");
    const res = await fetch(`https://gemini-j8xd.onrender.com/update-question/${questionId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + token
      },
      body: JSON.stringify(updated)
    });
  
    if (res.ok) {
      alert("✅ Question updated.");
      loadQuestionsFromSelectedTitle(); // veya refresh modal
    } else {
      alert("❌ Failed to update.");
    }
  }

  async function deleteSavedQuestion(id, button) {
    const email = localStorage.getItem("userEmail");
    if (!confirm("❌ Are you sure you want to delete this question?")) return;
  
    const res = await fetch(`https://gemini-j8xd.onrender.com/delete-question/${id}?email=${email}`, {
      method: "DELETE"
    });
  
    if (res.ok) {
      alert("🗑️ Deleted successfully");
      button.closest(".question-block").remove();
      renumberQuestions(); // numaraları güncelle
    } else {
      alert("❌ Failed to delete");
    }
  }

  function renumberQuestions() {
    const blocks = document.querySelectorAll(".question-block");
    blocks.forEach((block, i) => {
      const title = block.querySelector("summary, b");
      if (title) title.innerHTML = `Q${i + 1}.`;
    });
  }