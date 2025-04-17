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
  
      const res = await fetch("https://gemini-j8xd.onrender.com/generate-questions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${accessToken}`
        },
        body: JSON.stringify({ mycontent: extractedText })
      });
  
      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }
  
      const data = await res.json();
      if (!data.questions || typeof data.questions !== "string") {
        throw new Error("Format error from AI response.");
      }
  
      const raw = data.questions;
  
      const parsedQuestions = raw
        .split("***")
        .map(q => q.trim())
        .filter(Boolean)
        .map(block => {
          const question = block.split("///")[0].trim();
          const options = block.match(/\/\/\/\s*(.+)/g)?.map(opt => opt.replace("///", "").trim()) || [];
          const answerMatch = block.match(/~~Cevap:\s*(.+)/i);
          const explanationMatch = block.match(/&&Açıklama:\s*([\s\S]*)/i);
          return {
            question,
            options,
            answer: answerMatch ? answerMatch[1].trim() : "",
            explanation: explanationMatch ? explanationMatch[1].trim() : ""
          };
        });
  
      const isLoggedIn = !!userEmail;
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
  
      // Title input alanı
      const titleBox = document.createElement("div");
      titleBox.innerHTML = `
        <div style="text-align:center; margin-top: 30px;">
          <input id="quizTitle" type="text" placeholder="📘 Başlık adı giriniz" 
                 style="padding: 10px; width: 300px; max-width: 90%; font-size: 16px; border: 1px solid #ccc; border-radius: 8px;" />
          <p style="font-size: 13px; color: #555;">Bu başlık, oluşturulan soruların kaydı için zorunludur.</p>
        </div>
      `;
      output.appendChild(titleBox);
  
    } catch (err) {
      console.error("❌ Error generating questions:", err.message);
      alert(`❌ Failed to generate questions.\n${err.message}`);
    }
  
    button.disabled = false;
    button.textContent = "Generate Multiple Choice Questions";
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
      input.style = "width:100%;margin-bottom:6px;";
      el.replaceWith(input);
    });
    btn.textContent = "✅ Güncelle";
    btn.onclick = () => saveQuestionEdits(block);
  };
  
  // Sil
  window.deleteQuestion = function (btn) {
    const block = btn.closest(".quiz-preview");
    block.remove();
  
    const all = document.querySelectorAll(".quiz-preview");
    all.forEach((el, i) => {
      const label = el.querySelector("b");
      if (label) label.innerText = `Q${i + 1}.`;
    });
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
  

  async function saveSelectedQuestions() {
    const token = localStorage.getItem("accessToken");
    const email = localStorage.getItem("userEmail");
    if (!token || !email) return alert("Lütfen giriş yapın.");
  
    const title = document.getElementById("quizTitle")?.value.trim();
    const categoryId = document.getElementById("categorySelect")?.value;
    if (!title || !categoryId) {
      alert("Başlık ve kategori seçimi zorunlu.");
      return;
    }
  
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
      alert("Lütfen kaydetmek istediğiniz soruları işaretleyin.");
      return;
    }
  
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
  }
  
  async function loadMainTopics() {
    const token = localStorage.getItem("accessToken");
    const res = await fetch("https://gemini-j8xd.onrender.com/list-main-topics", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const select = document.getElementById("mainTopicSelect");
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
    const res = await fetch(`https://gemini-j8xd.onrender.com/list-titles?category_id=${categoryId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    const list = document.getElementById("titleSuggestions");
    list.innerHTML = "";
    data.titles.forEach(t => {
      const opt = document.createElement("option");
      opt.value = t.name;
      list.appendChild(opt);
    });
  }
  
  document.getElementById("saveQuizSection").style.display = "block";
  loadMainTopics();        