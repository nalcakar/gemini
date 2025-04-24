
function getCurrentSectionText() {
  const lastSection = localStorage.getItem("lastSection");

  if (lastSection === "topic") {
    const topicInput = document.getElementById("topicInput");
    if (topicInput && topicInput.value.trim().length > 0) {
      return topicInput.value.trim();
    }
  }

  const ids = [
    "textManualInput",
    "textOutput",
    "imageTextOutput",
    "audioTextOutput"
  ];

  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && el.offsetHeight > 0 && el.offsetWidth > 0 && el.value.trim().length > 0) {
      return el.value.trim();
    }
  }

  return "";
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
  // 🎯 Önceki görünüm temizlenir
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

    output.innerHTML = `<h3 style="text-align:center;">🎯 Generated Questions:</h3>`;

    const createControls = () => {
      const box = document.createElement("div");
      box.style = "margin: 10px 0; text-align: center;";
      box.innerHTML = `
        <button onclick="selectAllQuestions(true)" style="margin:4px; padding:6px 12px;">✅ Tümünü Seç</button>
        <button onclick="selectAllQuestions(false)" style="margin:4px; padding:6px 12px;">❌ Seçimleri Temizle</button>
        <button onclick="expandAllDetails(true)" style="margin:4px; padding:6px 12px;">📖 Hepsini Göster</button>
        <button onclick="expandAllDetails(false)" style="margin:4px; padding:6px 12px;">🔽 Tümünü Kapat</button>
      `;
      return box;
    };

    
    
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
        <summary><b>Q${i + 1}.</b> ${questionHTML}</summary>
        <ul>${optionsHTML}</ul>
        <p><strong>✅ Answer:</strong> ${answerHTML}</p>
        <p><strong>💡 Explanation:</strong> ${explanationHTML}</p>
        <p class="difficulty-line" data-level="${q.difficulty}"><strong>Difficulty:</strong> ${badge}</p>
        ${isLoggedIn ? `<label><input type="checkbox" class="qcheck"> ✅ Kaydet</label>` : ""}
        <div style="margin-top: 8px;">
          <button onclick="editQuestion(this)">✏️ Düzenle</button>
          <button onclick="deleteQuestion(this)">🗑️ Sil</button>
        </div>
      `;
    
      output.appendChild(details);
    });
    
    output.appendChild(createControls());
    
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise().catch(err => console.error("MathJax render error:", err));
    }

    output.appendChild(createControls());
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise();
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

  
  // Düzenle: soruları input haline getir
  // Eklenmiş MathJax güncellemesi ile tam editQuestion ve saveQuestionEdits fonksiyonları

// Güncellenmiş editQuestion — MathJax formüllerini data-latex ile korur

window.editQuestion = function (btn) {
  const block = btn.closest("details");
  if (block.querySelector("textarea")) return;

  const summary = block.querySelector("summary");
  const questionSpan = summary.querySelector(".q[data-key='question']");
  const questionText = questionSpan?.dataset.latex || summary.textContent.replace(/^Q\d+\.\s*/, "").trim();

  // Soru metni görünür kalsın
  questionSpan.style.fontWeight = "bold";

  // 🎯 Auto-resize + MathJax + canlı yansıtma helper
  const enableAutoUpdate = (textarea, targetEl) => {
    const resize = () => {
      textarea.style.height = "auto";
      textarea.style.height = textarea.scrollHeight + "px";
    };

    const applyResize = () => {
      if (document.body.contains(textarea)) {
        resize();
      }
    };

    textarea.addEventListener("input", () => {
      const val = textarea.value.trim();
      if (targetEl) {
        targetEl.textContent = val;
        targetEl.dataset.latex = val;

        if (window.MathJax && window.MathJax.typesetPromise) {
          MathJax.typesetPromise([targetEl]).then(applyResize).catch(console.error);
        } else {
          applyResize();
        }
      } else {
        applyResize();
      }
    });

    // ✨ İlk açılışta MathJax render sonrası yüksekliği ayarla
    if (window.MathJax && window.MathJax.typesetPromise) {
      window.MathJax.typesetPromise([targetEl])
        .then(applyResize)
        .catch(console.error);
    } else {
      requestAnimationFrame(() => {
        setTimeout(applyResize, 20);
        setTimeout(applyResize, 100);
      });
    }
  };

  // ✅ Soru textarea
  const qTextarea = document.createElement("textarea");
  qTextarea.value = questionText;
  qTextarea.className = "q-edit";
  qTextarea.dataset.key = "question";
  qTextarea.style.cssText = `
    width: 100%; margin-top: 8px; padding: 8px; font-size: 15px;
    border-radius: 6px; overflow: hidden; resize: none; line-height: 1.4;
  `;
  summary.insertAdjacentElement("afterend", qTextarea);
  enableAutoUpdate(qTextarea, questionSpan);

  // ✅ Diğer alanlar (şıklar, cevap, açıklama)
  const elements = block.querySelectorAll(".q, li[data-key]");
  elements.forEach(el => {
    const key = el.dataset.key;
    if (key === "question") return;

    const value = el.dataset.latex || el.textContent.trim();
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.className = "q-edit";
    textarea.dataset.key = key;
    textarea.style.cssText = `
      width: 100%; margin-top: 6px; padding: 6px;
      font-size: 14px; border-radius: 6px; overflow: hidden;
      resize: none; line-height: 1.4;
    `;
    el.insertAdjacentElement("afterend", textarea);
    enableAutoUpdate(textarea, el);
  });

  // ✅ Zorluk seviyesi seçici
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

  // ✅ Buton güncelle
  btn.textContent = "✅ Güncelle";
  btn.onclick = () => saveQuestionEdits(block);

  // MathJax genel tekrar (gerekirse)
  if (window.MathJax && window.MathJax.typesetPromise) {
    window.MathJax.typesetPromise().catch(console.error);
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
    <summary>
      <b>Q${parseInt(newDetails.dataset.index) + 1}.</b>
      <span class="q" data-key="question" data-latex="${questionText}">${questionText}</span>
    </summary>
  `;

  const difficultyHTML = `<p><strong>Difficulty:</strong> ${difficultyIcon}</p>`;
  const checkboxHTML = localStorage.getItem("userEmail")
    ? `<label><input type="checkbox" class="qcheck"> ✅ Kaydet</label>` : "";

  const buttonsHTML = `
    <div style="margin-top: 8px;">
      <button onclick="editQuestion(this)">✏️ Düzenle</button>
      <button onclick="deleteQuestion(this)">🗑️ Sil</button>
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
  async function saveSelectedQuestions() {
    const token = localStorage.getItem("accessToken");
    const email = localStorage.getItem("userEmail");
    if (!token || !email) return alert("❌ Lütfen giriş yapın.");
  
    let title = "";
    const dropdown = document.getElementById("titleDropdown");
    const input = document.getElementById("newTitleInput");
  
    if (dropdown?.value === "__new__") {
      title = input?.value.trim();
      if (!title) return alert("⚠️ Lütfen yeni bir başlık giriniz.");
    } else {
      title = dropdown?.value;
      if (!title) return alert("⚠️ Lütfen bir başlık seçiniz.");
    }
  
    const categoryId = document.getElementById("categorySelect")?.value;
    if (!categoryId) {
      alert("⚠️ Lütfen bir kategori seçiniz.");
      return;
    }
  
    const questions = [];
  
    document.querySelectorAll(".quiz-preview").forEach((block, index) => {
      const check = block.querySelector(".qcheck");
      if (check?.checked) {
        const q = {};
  
        block.querySelectorAll(".q").forEach(s => {
          const key = s.dataset.key;
          const val = s.dataset.latex?.trim() || s.innerText.trim(); // ✅ MathJax için data-latex öncelikli
  
          if (key?.startsWith("option")) {
            q.options = q.options || [];
            q.options.push(val);
          } else {
            q[key] = val;
          }
        });
  
        // ✅ Difficulty DOM'dan alınır
        const diffText = block.querySelector(".difficulty-line")?.innerText?.toLowerCase() || "";
        if (diffText.includes("easy")) {
          q.difficulty = "easy";
        } else if (diffText.includes("hard")) {
          q.difficulty = "hard";
        } else {
          q.difficulty = "medium";
        }
  
        q.options = q.options || [];
        q.answer = q.answer || "placeholder";
        q.explanation = q.explanation || "";
  
        questions.push(q);
      }
    });
  
    if (questions.length === 0) {
      alert("⚠️ Kaydetmek için en az bir soru seçmelisiniz.");
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
          titleName: title,
          categoryId,
          questions
        })
      });
  
      const data = await res.json();
      if (res.ok) {
        alert("✅ Sorular başarıyla kaydedildi.");
        shouldReloadQuestions = true;
        currentTitle = "";
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
      console.error("❌ Başlıklar yüklenemedi:", err);
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
      console.error("❌ Başlıklar yüklenemedi:", err);
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
      container.innerHTML = "<p style='color:red;'>❌ Giriş yapmadınız. Lütfen giriş yapın.</p>";
      return;
    }
  
    let titleName = "";
    if (dropdown?.value === "__new__") {
      titleName = input?.value?.trim();
    } else {
      titleName = dropdown?.value;
    }
  
    if (!titleName) {
      container.innerHTML = "<p style='color:red;'>❌ Lütfen bir başlık seçin veya yazın.</p>";
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
block.open = false; // ✅ Açık gelmesin
block.dataset.difficulty = (q.difficulty || "medium").toLowerCase();

  
          let badge = "";
          if (q.difficulty === "easy") {
            badge = `🟢 Easy`;
          } else if (q.difficulty === "medium") {
            badge = `🟡 Medium`;
          } else if (q.difficulty === "hard") {
            badge = `🔴 Hard`;
          }
  
          block.innerHTML = `
          <summary>
            Q${i + 1}. <span class="q" data-key="question" data-latex="${q.question}">${q.question}</span>
          </summary>
          <ul>
            ${q.options.map((opt, idx) => `
              <li class="q" data-key="option${idx + 1}" data-latex="${opt}">${opt}</li>
            `).join("")}
          </ul>
          <p><strong>💡 Açıklama:</strong>
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
      })
      .catch(err => {
        container.innerHTML = "<p style='color:red;'>❌ Sorular alınamadı.</p>";
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


function selectAllQuestions(state = true) {
  document.querySelectorAll(".qcheck").forEach(cb => cb.checked = state);
}
