const API = "https://gemini-j8xd.onrender.com";
const token = localStorage.getItem("accessToken");
const email = localStorage.getItem("userEmail");
let editMode = false;
let currentRecentTextId = null;
document.addEventListener("DOMContentLoaded", () => {
  if (!token || !email) {
    document.getElementById("user-box").innerHTML = `
      <div class="user-box-inner">
        <p style="font-size:16px;color:#444;margin-bottom:12px;">
          🔒 You must log in with Patreon to use the admin panel.
        </p>
        <a class="login-btn" style="padding:10px 18px; background:#e85c33; color:white; border-radius:8px; text-decoration:none; display:inline-block;" 
           href="https://www.patreon.com/oauth2/authorize?response_type=code&client_id=IGUdh16RfRFyfzSrcqZR-Ots5N2jUd3Cu5B2tK5EKm6Dlaou0h2Pzq4S_urdc0Sl&redirect_uri=https://gemini-j8xd.onrender.com/auth/patreon/callback&scope=identity">
          Login with Patreon
        </a>
      </div>`;
    document.getElementById("mainTopics").innerHTML = "<p style='color:gray;'>⚠️ Content is hidden until you log in.</p>";
    document.getElementById("categories").innerHTML = "";
    document.getElementById("titles").innerHTML = "";
    document.getElementById("modalQuestionList").innerHTML = "";
    return;
  }

  // ✅ Token/email varsa devam et
  loadMainTopics();
});



// editMode fonksiyonu dışarıda kalmalı
function toggleEditMode() {
  editMode = !editMode;
  document.body.classList.toggle("edit-mode", editMode);
  renderEditControls();
}



// Main → Category → Title
let currentTitleId = null;
let currentTitleName = ""; 
let currentMainTopicId = null;
let currentCategoryId = null;


// 📘 1. Load Main Topics
async function loadMainTopics() {
  const container = document.getElementById("mainTopics");
  container.innerHTML = "<h3>📂 Main Topics</h3><p>Loading...</p>";

  const res = await fetch(`${API}/list-main-topics?email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  const topics = Array.isArray(data) ? data : data.topics || [];

  container.innerHTML = "<h3>📂 Main Topics</h3>";

  topics.forEach(topic => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = topic.name;
    div.onclick = () => {
      currentMainTopicId = topic.id;
      currentCategoryId = null;
      currentTitleId = null;
    
      highlightSelected(div, "mainTopics");
      // ✅ Fade ile içerik temizle
  updatePanelWithFade("titles", "<h3>📝 Titles</h3><p>⬅️ Select a category</p>");
  updatePanelWithFade("modalQuestionList", "<h3>📋 Questions</h3><p>⬅️ Select a title to view questions</p>");

    
      // ✅ titles panelini sıfırla
      const titles = document.getElementById("titles");
      if (titles) {
        titles.innerHTML = "<h3>📝 Titles</h3><p>⬅️ Select a category</p>";
      }
    
      // ✅ questions panelini sıfırla
      const questions = document.getElementById("modalQuestionList");
      if (questions) {
        questions.innerHTML = "<h3>📋 Questions</h3><p>⬅️ Select a title to view questions</p>";
      }
    
      loadCategories(topic.id);
    };
    
    
    container.appendChild(div);
  });
}

// 📁 2. Load Categories
async function loadCategories(mainTopicId) {
  const container = document.getElementById("categories");
  container.innerHTML = "<h3>📁 Categories</h3><p>Loading...</p>";

  const res = await fetch(`${API}/list-categories?main_topic_id=${mainTopicId}&email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  const categories = Array.isArray(data) ? data : data.categories || [];

  container.innerHTML = "<h3>📁 Categories</h3>";

  // 🔥 Hide Main Topics, Show Categories
 



  categories.forEach(cat => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = cat.name;
    div.onclick = () => {
      currentCategoryId = cat.id;
      currentTitleId = null;
      highlightSelected(div, "categories");

      updatePanelWithFade("modalQuestionList", "<h3>📋 Questions</h3><p>⬅️ Select a title to view questions</p>");
      loadTitles(cat.id);
    };
    container.appendChild(div);
  });

  if (editMode) renderEditControls();
}



// 📝 3. Load Titles
async function loadTitles(categoryId) {
  const container = document.getElementById("titles");
  container.innerHTML = "<h3>📝 Titles</h3><p>Loading...</p>";

  const res = await fetch(`${API}/list-titles?category_id=${categoryId}&email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  const titles = Array.isArray(data) ? data : data.titles || [];

  container.innerHTML = "<h3>📝 Titles</h3>";

  // 🔥 Hide Categories, Show Titles




  titles.forEach(title => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = title.name;
    div.onclick = () => {
      currentTitleId = title.id;
      currentTitleName = title.name; // ✅ add this!
      highlightSelected(div, "titles");
      loadQuestionsByTitleName(title.name);
    };
    container.appendChild(div);
  });

  if (editMode) renderEditControls();
}

async function renameMainTopic() {
  if (!currentMainTopicId) return alert("⚠️ Select a main topic first.");
  const newName = prompt("Enter new name for the Main Topic:");
  if (!newName) return;

  const res = await fetch(`${API}/rename-main-topic`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ main_topic_id: currentMainTopicId, new_name: newName, email })
  });

  const data = await res.json();
  if (data.success) {
    alert("✅ Main topic renamed.");
    clearSelectionUI();    
    loadMainTopics(); // yeniden yükle
  } else {
    alert("❌ Failed to rename main topic.");
  }
}

async function loadQuestionsByTitleName(titleName) {
  const container = document.getElementById("modalQuestionList");
  container.style.marginTop = "20px";
  container.innerHTML = `
    <div id="questionControlPanel" style="margin-bottom:12px; padding:12px; border:1px solid #e5e7eb; border-radius:12px; background:#f9fafb; text-align:center;">
      <input id="searchInput" oninput="filterQuestions()" placeholder="🔍 Search within questions..." 
             style="width:100%; max-width:600px; margin:0 auto; display:block; padding:10px 14px; border-radius:10px; border:1px solid #d1d5db; font-size:15px;" />
      <div style="margin-top:14px; display: flex; flex-wrap: wrap; justify-content: center; gap: 10px;">
        <button id="expandCollapseBtn" type="button" onclick="toggleExpandCollapse()">🔽 Expand All</button>
        <button type="button" onclick="filterByDifficulty('easy')">🟢 Easy</button>
        <button type="button" onclick="filterByDifficulty('medium')">🟡 Medium</button>
        <button type="button" onclick="filterByDifficulty('hard')">🔴 Hard</button>
        <button type="button" onclick="filterByDifficulty('')">🔁 All Levels</button>
      </div>
    </div>
    <div id="statsBox" style="margin-bottom:12px; font-weight:500; text-align:center;"></div>
    <p style='text-align:center;'>⏳ Loading questions...</p>
  `;

  const token = localStorage.getItem("accessToken");
  const email = localStorage.getItem("userEmail");

  if (!API || !currentCategoryId || !email) {
    container.innerHTML = "<p style='color:red;'>❌ Internal error: Missing parameters.</p>";
    return;
  }

  const titlesRes = await fetch(`${API}/list-titles?category_id=${currentCategoryId}&email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const titleData = await titlesRes.json();
  const matchedTitle = titleData.titles.find(t => t.name === titleName);
  if (!matchedTitle) {
    container.innerHTML += "<p style='color:red;'>❌ Title not found.</p>";
    return;
  }

  const res = await fetch(`${API}/get-questions?title_id=${matchedTitle.id}&email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  const controlPanel = document.getElementById("questionControlPanel");
  const statsBox = document.getElementById("statsBox");

  container.innerHTML = "";
  container.appendChild(controlPanel);
  container.appendChild(statsBox);

  if (!data.questions || data.questions.length === 0) {
    const noQuestionsMsg = document.createElement("p");
    noQuestionsMsg.style = "text-align:center; color:gray;";
    noQuestionsMsg.innerText = "⚠️ No questions under this title.";
    container.appendChild(noQuestionsMsg);
  } else {
    const count = data.questions.length;
    statsBox.innerHTML = `📊 Total Questions: <strong>${count}</strong>`;

    data.questions.forEach((q, i) => {
      const block = document.createElement("details");
      block.className = "question-card";
      block.setAttribute("data-id", q.id);

      const question = q.question || "";
      const options = q.options || [];
      const explanation = q.explanation || "";
      const answer = q.answer || "";
      const difficulty = q.difficulty || "medium";

      const badge = {
        easy: "🟢 Easy",
        medium: "🟡 Medium",
        hard: "🔴 Hard"
      }[difficulty] || "";

      block.innerHTML = `
        <summary>
          Q${i + 1}. <span class="q" data-key="question" data-latex="${question}">${question}</span> 
          <span class="difficulty-badge ${difficulty}" style="margin-left:8px;">${badge}</span>
        </summary>
        <ul>
          ${options.map((opt, idx) => `
            <li class="q" data-key="option${idx + 1}" data-latex="${opt}">${opt}</li>
          `).join("")}
        </ul>
        <p><strong>✅ Answer:</strong> ${answer}</p>
        <p><strong>💡 Explanation:</strong> <span class="q" data-key="explanation" data-latex="${explanation}">${explanation}</span></p>
        <div style="margin-top: 8px;">
          <button onclick="adminEditQuestion(${q.id})">✏️ Edit</button>
          <button onclick="adminDeleteQuestion(${q.id}, this)">🗑️ Delete</button>
        </div>
      `;
      container.appendChild(block);
    });
  }

  // ✅ AFTER questions, create Recent Texts container
  const recentTextsContainer = document.createElement("div");
  recentTextsContainer.id = "recentTextsContainer";
  recentTextsContainer.style = "margin-top:40px;";
  recentTextsContainer.innerHTML = `
    <h3>🕒 Recent Texts</h3>
    <p style="text-align:center; color:gray;">⏳ Loading recent texts...</p>
  `;
  container.appendChild(recentTextsContainer);

  // 🧠 Update stats if available
  if (typeof updateStats === "function") updateStats();
  if (window.MathJax) MathJax.typesetPromise?.();

  container.scrollIntoView({ behavior: "smooth" });

  // ✅ Finally load recent texts for this title
  loadRecentTexts(currentTitleId);
}




async function loadRecentTexts(titleId) {
  const container = document.getElementById("recentTextsContainer");
  if (!container) return;

  container.innerHTML = "<h3>🕒 Recent Texts</h3><p>Loading...</p>";

  const res = await fetch(`${API}/list-recent-texts?email=${email}&title_id=${titleId}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  if (!data.recent_texts || data.recent_texts.length === 0) {
    container.innerHTML = "<h3>🕒 Recent Texts</h3><p>No recent texts available.</p>";
    return;
  }

  container.innerHTML = "<h3>🕒 Recent Texts</h3>";

  data.recent_texts.forEach(text => {
    const div = document.createElement("div");
    div.className = "recent-text-card";
    div.id = `recentCard-${text.id}`;

    div.innerHTML = `
      <div style="font-size:12px; color:#666;">${new Date(text.created_at).toLocaleString()}</div>
      <textarea id="recentText-${text.id}" readonly>${text.extracted_text}</textarea>
      <div class="recent-text-buttons">
        <button onclick="viewRecentText(${text.id})">👁️ View</button>
   
        <button onclick="deleteRecentText(${text.id})" class="delete-btn">🗑️ Delete</button>
      </div>
    `;
    container.appendChild(div);
  });
}


function viewRecentText(id) {
  const textarea = document.getElementById(`recentText-${id}`);
  const modal = document.getElementById("viewModal");
  const modalTextarea = document.getElementById("viewModalTextarea");
  const editBtn = document.getElementById("modalEditButton");
  const saveBtn = document.getElementById("modalSaveButton");

  if (!textarea || !modal || !modalTextarea) return;

  currentRecentTextId = id; // 🆕 Save which text we're viewing

  modalTextarea.value = textarea.value;
  modalTextarea.setAttribute("readonly", true);
  editBtn.style.display = "inline-block";
  saveBtn.style.display = "none";
  modal.style.display = "flex";
}
function editModalText() {
  const modalTextarea = document.getElementById("viewModalTextarea");
  const editBtn = document.getElementById("modalEditButton");
  const saveBtn = document.getElementById("modalSaveButton");

  if (!modalTextarea) return;

  modalTextarea.removeAttribute("readonly");
  modalTextarea.focus();
  editBtn.style.display = "none";
  saveBtn.style.display = "inline-block";
}

function closeViewModal() {
  const modal = document.getElementById("viewModal");
  if (modal) {
    modal.style.display = "none";
  }
}


async function saveModalText() {
  const modalTextarea = document.getElementById("viewModalTextarea");
  const editBtn = document.getElementById("modalEditButton");
  const saveBtn = document.getElementById("modalSaveButton");

  if (!modalTextarea || !currentRecentTextId) return;

  const newText = modalTextarea.value.trim();
  if (!newText) return showToast("⚠️ Text cannot be empty!");

  try {
    const res = await fetch(`${API}/update-recent-text/${currentRecentTextId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ extracted_text: newText })
    });

    const data = await res.json();
    if (res.ok) {
      showToast("✅ Recent text updated!");
      modalTextarea.setAttribute("readonly", true);
      editBtn.style.display = "inline-block";
      saveBtn.style.display = "none";

      // Also update the card textarea if it still exists
      const cardTextarea = document.getElementById(`recentText-${currentRecentTextId}`);
      if (cardTextarea) cardTextarea.value = newText;
    } else {
      showToast("❌ Update failed: " + (data?.error || "Unknown error"));
    }
  } catch (err) {
    console.error("Save error:", err);
    showToast("❌ Server error");
  }
}


async function deleteRecentText(id) {
  if (!confirm("🗑️ Are you sure you want to delete this recent text?")) return;

  try {
    const res = await fetch(`${API}/delete-recent-text/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.ok) {
      const card = document.getElementById(`recentCard-${id}`);
      if (card) {
        card.classList.add("fade-out");
        setTimeout(() => card.remove(), 500);
      }
      alert("✅ Deleted successfully!");
    } else {
      alert("❌ Failed to delete");
    }
  } catch (err) {
    console.error("Delete error:", err);
    alert("❌ Server error");
  }
}




function renderEditControls() {
  ["mainTopics", "categories", "titles"].forEach(section => {
    const container = document.getElementById(section);
    const header = container.querySelector("h3");

    // Önce eski butonları temizle
    const existing = header.querySelector(".edit-controls");
    if (existing) existing.remove();

    if (!editMode) return;

    // Yeni buton grubu
    const controls = document.createElement("span");
    controls.className = "edit-controls";
    controls.style.marginLeft = "10px";

    if (section === "mainTopics") {
      if (section === "mainTopics") {
        controls.innerHTML = `
  <button onclick="addMainTopic()">➕</button>
  <button onclick="renameMainTopic()">✏️</button>
  <button onclick="deleteMainTopic()">🗑️</button>
`;
      }
      
    } else if (section === "categories") {
      controls.innerHTML = `
      <button onclick="addCategory()">➕</button>
      <button onclick="renameCategory()">✏️</button>
      <button onclick="deleteCategory()">🗑️</button>
      <button onclick="changeCategoryMainTopic()">🔁</button>
    `;
    
    } else if (section === "titles") {
      controls.innerHTML = `
  <button onclick="renameTitle()">✏️</button>
  <button onclick="deleteTitle()">🗑️</button>
  <button onclick="moveTitle()">🔁</button>
`;

    }

    header.appendChild(controls);
  });
}
async function addMainTopic() {
  const name = prompt("Enter new Main Topic name:");
  if (!name) return;

  const res = await fetch(`${API}/add-main-category`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email })
  });

  const data = await res.json();

  if (data.success) {
    // Clear current selections to avoid conflict
    currentMainTopicId = null;
    currentCategoryId = null;
    currentTitleId = null;

    loadMainTopics(); // reload UI cleanly
  } else {
    alert("❌ Failed to add main topic");
  }
}


async function addCategory() {
  if (!currentMainTopicId) return alert("⚠️ Select a Main Topic first.");

  const name = prompt("Enter new Category name:");
  if (!name) return;

  const res = await fetch(`${API}/add-category`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, main_id: currentMainTopicId, email })
  });

  const data = await res.json();

  if (data.success) {
    // Clear dependent selections
    currentCategoryId = null;
    currentTitleId = null;
    clearSelectionUI();     
    loadCategories(currentMainTopicId); // reload categories only under current main topic
  } else {
    alert("❌ Failed to add category");
  }
}

async function renameCategory() {
  if (!currentCategoryId) return alert("⚠️ Select a category first.");
  const newName = prompt("Enter new category name:");
  if (!newName) return;
  const res = await fetch(`${API}/rename-category`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_id: currentCategoryId, new_name: newName, email })
  });
  const data = await res.json();
  if (data.success) loadCategories(currentMainTopicId);
  else alert("❌ Failed to rename category");
}






async function changeCategoryMainTopic() {
  if (!currentCategoryId) return alert("⚠️ Select a category first.");

  const res = await fetch(`${API}/list-main-topics`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  const topics = data.topics || [];

  const oldMainTopicId = currentMainTopicId;

  showModalWithOptions("Select new Main Topic:", topics, async (selectedId) => {
    if (selectedId == currentMainTopicId) {
      alert("⚠️ You selected the current main topic. No changes made.");
      return;
    }

    const moveRes = await fetch(`${API}/move-category`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: currentCategoryId,
        newMainId: selectedId,
        email
      })
    });

    const result = await moveRes.json();

    if (result.success) {
      alert("✅ Category moved.");

      clearSelectionUI();         // ✅ UI'daki tüm seçimleri sıfırla
      currentMainTopicId = selectedId;

      await loadCategories(oldMainTopicId);  // eski konumdaki kategori listesini yenile
      await loadCategories(selectedId);      // yeni konumdaki kategori listesini yenile
      await loadMainTopics();                // tüm main topic listesini yenile

      // yeni seçilen main topic’i vurgula
      const mainTopicDivs = document.querySelectorAll("#mainTopics .item");
      const newTopicName = topics.find(t => t.id == selectedId)?.name;

      mainTopicDivs.forEach(div => {
        if (div.textContent === newTopicName) {
          highlightSelected(div, "mainTopics");
        }
      });

      if (editMode) renderEditControls();
    } else {
      alert("❌ Move failed.");
    }
  }, currentMainTopicId); // ✅ mevcut olanı parametre olarak geçiyoruz
}


async function moveTitleToCategory() {
  if (!currentTitleId) return alert("⚠️ Select a title first.");

  const res = await fetch(`${API}/list-categories?main_topic_id=${currentMainTopicId}&email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  const categories = data.categories || [];

  showModalWithOptions("Select new Category:", categories, async (selectedId) => {
    const moveRes = await fetch(`${API}/move-title-to-category`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title_id: currentTitleId, new_category_id: selectedId, email })
    });

    const result = await moveRes.json();
    if (result.success) {
      alert("✅ Title moved.");
      currentCategoryId = selectedId;
      loadTitles(selectedId);
    } else {
      alert("❌ Move failed.");
    }
  });
}


async function renameTitle() {
  if (!currentTitleId) {
    alert("⚠️ Select a title first.");
    return;
  }

  const newName = prompt("Enter the new title name:");
  if (!newName || !newName.trim()) return;

  try {
    const res = await fetch(`${API}/update-title-name`, {
      method: "PUT", // ✅ must be PUT, not POST
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: currentTitleId, newName: newName.trim(), email })
    });

    const data = await res.json();
    if (data.success) {
      alert("✅ Title renamed successfully!");
      loadTitles(currentCategoryId); // ✅ Reload titles after renaming
    } else {
      alert("❌ Failed to rename the title.");
    }
  } catch (err) {
    console.error("Rename title error:", err);
    alert("❌ Server error while renaming title.");
  }
}


async function deleteTitle() {
  if (!currentTitleId) return alert("⚠️ Select a title first.");
  if (!confirm("Are you sure? This will work only if all questions are deleted.")) return;

  try {
    const res = await fetch(`${API}/delete-title/${currentTitleId}?email=${email}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    const text = await res.text();
    console.log("🔍 delete-title response:", text);

    let data;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error("❌ JSON parse error from delete-title:", text);
      return alert("❌ Server returned invalid data. Sunucu HTML dönüyor olabilir.");
    }

    if (data.success) {
      alert("✅ Title deleted.");
      clearSelectionUI();   
      loadTitles(currentCategoryId);
    } else {
      alert(data.message || "❌ Cannot delete title (might still have questions)");
    }

  } catch (err) {
    console.error("❌ deleteTitle network error:", err);
    alert("⚠️ Unexpected error while deleting title.");
  }
}


async function moveTitle() {
  if (!currentTitleId) return alert("⚠️ Select a title first.");
  if (!currentCategoryId) return alert("⚠️ Select the current category first.");

  const res = await fetch(`${API}/list-categories?main_topic_id=${currentMainTopicId}&email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const data = await res.json();
  const categories = data.categories || [];

  const currentTitleDiv = [...document.querySelectorAll("#titles .item")].find(div =>
    div.classList.contains("active")
  );
  const currentTitleName = currentTitleDiv?.innerText || "";
  const oldCategoryId = currentCategoryId;

  showModalWithOptions("Select new Category:", categories, async (selectedId) => {
    const moveRes = await fetch(`${API}/move-title-to-category`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        titleId: currentTitleId,
        newCategoryId: selectedId,
        email
      })
    });

    const result = await moveRes.json();

    if (result.success) {
      alert("✅ Title moved.");
      currentCategoryId = selectedId;

      await loadTitles(oldCategoryId);
      await loadTitles(selectedId);

      const titleDivs = document.querySelectorAll("#titles .item");
      titleDivs.forEach(div => {
        if (div.textContent.trim() === currentTitleName.trim()) {
          highlightSelected(div, "titles");
        }
      });

      if (editMode) renderEditControls();
    } else {
      alert("❌ Move failed.");
    }
  }, currentCategoryId);
}






async function deleteMainTopic() {
  if (!currentMainTopicId) return alert("⚠️ Select a main topic first.");
  if (!confirm("Are you sure you want to delete this main topic?")) return;

  try {
    // ✅ Silme isteği
    const deleteRes = await fetch(`${API}/delete-main-category/${currentMainTopicId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    const text = await deleteRes.text();
    let deleteData;
    try {
      deleteData = JSON.parse(text);
    } catch (err) {
      console.error("❌ JSON parse error:", text);
      return alert("❌ Server returned invalid data (HTML instead of JSON). Sunucu yeniden deploy edilmiş mi?");
    }

    if (deleteData.success) {
      alert("✅ Main topic deleted.");
      clearSelectionUI();  
      currentMainTopicId = null;
      loadMainTopics();
    } else {
      alert(deleteData.message || "❌ Failed to delete main topic.");
    }
  } catch (err) {
    console.error("❌ deleteMainTopic error:", err);
    alert("⚠️ Unexpected error occurred while deleting the main topic.");
  }
}




async function deleteCategory() {
  if (!currentCategoryId) return alert("⚠️ Select a category first.");
  if (!confirm("Are you sure you want to delete this category? It must have no titles under it.")) return;

  try {
    // 1. Başlık var mı?
    const res = await fetch(`${API}/list-titles?category_id=${currentCategoryId}&email=${email}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (!data.titles || data.titles.length > 0) {
      return alert("❌ Cannot delete. This category still has titles.");
    }

    // 2. Ana başlık varsayılan mı?
    const mainInfoRes = await fetch(`${API}/get-main-topic-info/${currentMainTopicId}?email=${email}`);
    const mainInfoData = await mainInfoRes.json();
    const isDefaultMain = mainInfoData.is_default;

    // 3. Varsayılan ana başlıkta son kategori mi?
    if (isDefaultMain) {
      const resAll = await fetch(`${API}/list-categories?main_topic_id=${currentMainTopicId}&email=${email}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!resAll.ok) throw new Error("Category list fetch failed");

      const all = await resAll.json();
      const catList = all.categories || [];
      if (catList.length <= 1) {
        return alert("❌ At least one category must remain under this main topic.");
      }
    }

    // 🧪 Log DELETE URL
    const deleteUrl = `${API}/delete-category/${currentCategoryId}?email=${email}`;
    console.log("🧪 DELETE URL:", deleteUrl);

    // 4. Silme isteği
    const deleteRes = await fetch(deleteUrl, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` }
    });

    // ⛔ Sunucudan gelen veriyi düz metin olarak al, sonra parse etmeye çalış
    const text = await deleteRes.text();
    try {
      const deleteData = JSON.parse(text);
      if (deleteData.success) {
        alert("✅ Category deleted successfully.");
        clearSelectionUI(); 
        loadCategories(currentMainTopicId);
      } else {
        alert(deleteData.message || "❌ Category could not be deleted.");
      }
    } catch (err) {
      console.error("❌ JSON parse error:", text);
      alert("❌ Server returned invalid JSON. Check if ID or email is correct.");
    }

  } catch (err) {
    console.error("❌ Delete Category Error:", err);
    alert("⚠️ Unexpected error occurred while deleting the category.");
  }
}


// ✨ Helper: Highlight Active Selection
function highlightSelected(selectedDiv, containerId) {
  document.querySelectorAll(`#${containerId} .item`).forEach(d => d.classList.remove("active"));
  selectedDiv.classList.add("active");
}

document.addEventListener("click", function (e) {
  if (e.target.closest("#questionControlPanel button")) {
    e.preventDefault(); // ⛔ sayfa kaymasını engeller
  }
});

function highlightSelected(div, sectionId) {
  document.querySelectorAll(`#${sectionId} .item`).forEach(el => el.classList.remove("active"));
  div.classList.add("active");
}
function showModalWithOptions(label, items, callback, currentId = null) {
  const modal = document.getElementById("modalContainer");
  const select = document.getElementById("modalSelect");
  const modalLabel = document.getElementById("modalLabel");

  if (!modal || !select || !modalLabel) {
    console.error("❌ Modal öğeleri bulunamadı.");
    return;
  }

  modalLabel.textContent = label;

  const currentItems = items.filter(item => (item.id ?? '') == currentId);
  const otherItems = items.filter(item => (item.id ?? '') != currentId);

  const renderOptions = (label, list, isCurrent = false) => `
    <optgroup label="${label}">
      ${list.map(item => 
        `<option value="${item.id}" ${isCurrent ? 'selected' : ''}>${item.name}</option>`
      ).join("")}
    </optgroup>
  `;

  select.innerHTML =
    renderOptions("✅ Current Selection", currentItems, true) +
    renderOptions("🔁 Other Options", otherItems, false);

  // Fade-in animasyon
  modal.style.opacity = 0;
  modal.style.display = "block";
  requestAnimationFrame(() => {
    modal.style.transition = "opacity 0.3s ease, transform 0.3s ease";
    modal.style.opacity = 1;
    modal.style.transform = "translate(-50%, -30%) scale(1)";
  });

  // ESC tuşuyla kapatma
  const keyListener = (e) => {
    if (e.key === "Escape") closeModal();
    if (e.key === "ArrowDown") select.selectedIndex = (select.selectedIndex + 1) % select.options.length;
    if (e.key === "ArrowUp") select.selectedIndex = (select.selectedIndex - 1 + select.options.length) % select.options.length;
  };
  document.addEventListener("keydown", keyListener);

  window.confirmModalSelection = () => {
    const selectedId = select.value;
    if (selectedId == currentId) {
      alert("⚠️ You selected the current item. No changes made.");
      return;
    }
    closeModal();
    callback(selectedId);
  };

  window.closeModal = () => {
    modal.style.opacity = 0;
    modal.style.transform = "translate(-50%, -35%) scale(0.95)";
    setTimeout(() => {
      modal.style.display = "none";
    }, 250);
    document.removeEventListener("keydown", keyListener);
  };
}

function clearSelectionUI() {
  currentMainTopicId = null;
  currentCategoryId = null;
  currentTitleId = null;

  const titles = document.getElementById("titles");
  const questions = document.getElementById("modalQuestionList"); // ✅ doğru ID

  if (titles) {
    titles.innerHTML = "<h3>📝 Titles</h3><p>⬅️ Select a category</p>";
  }

  if (questions) {
    questions.innerHTML = "<h3>📋 Questions</h3><p>⬅️ Select a title to view questions</p>";
  }

  document.querySelectorAll(".item.active").forEach(el => el.classList.remove("active"));
}
function updatePanelWithFade(id, newContent) {
  const el = document.getElementById(id);
  if (!el) return;

  el.style.transition = "opacity 0.3s ease";
  el.style.opacity = 0;

  setTimeout(() => {
    el.innerHTML = newContent;
    el.style.opacity = 1;
  }, 200);
}
function flashMessage(text, duration = 2000) {
  const box = document.getElementById("flashMessage");
  box.textContent = text;
  box.style.display = "block";
  box.style.opacity = 1;

  setTimeout(() => {
    box.style.transition = "opacity 0.5s ease";
    box.style.opacity = 0;
    setTimeout(() => {
      box.style.display = "none";
    }, 500);
  }, duration);
}
function adminDeleteQuestion(id, btn) {
  const details = btn.closest("details");
  if (!details) return;

  if (!confirm("Are you sure you want to delete this question?")) return;

  fetch(`https://gemini-j8xd.onrender.com/delete-question/${id}?email=${encodeURIComponent(localStorage.getItem("userEmail"))}`, {
    method: "DELETE"
  }).then(res => {
    if (res.ok) {
      details.remove();
      flashMessage("✅ Question deleted.");
      renumberQuestions();
    } else {
      alert("❌ Failed to delete the question.");
    }
  }).catch(() => alert("❌ Server error"));
}


// ✅ Admin panelde bir soruyu güncellerken tüm textarea'lardan veri alır,
// doğru alanlara eşleştirir, PATCH atar ve render sonrası günceller
function saveQuestionEdits(block) {
  const id = block.getAttribute("data-id");
  if (!id) return alert("❌ Soru ID'si bulunamadı.");

  const edits = block.querySelectorAll(".q-edit");
  const selectedDiff = block.querySelector(".q-difficulty")?.value || "medium";

  const data = {
    question: "",
    explanation: "",
    options: [],
    answer: "",
    difficulty: selectedDiff
  };

  edits.forEach(input => {
    const key = input.dataset.key;
    const val = input.value.trim();

    if (key === "question") data.question = val;
    else if (key === "explanation") data.explanation = val;
    else if (key === "answer") data.answer = val;
    else if (key?.startsWith("option")) data.options.push(val);
  });

  const token = localStorage.getItem("accessToken");
  const email = localStorage.getItem("userEmail");

  fetch(`https://gemini-j8xd.onrender.com/update-question/${id}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      question: data.question,
      explanation: data.explanation,
      options: data.options,
      difficulty: data.difficulty,
      answer: data.options[0] // Gerçek cevap gerekirse burada ayarlanır
    })
  }).then(res => {
    if (!res.ok) return alert("❌ Update failed.");

    const index = Array.from(document.querySelectorAll("#modalQuestionList details")).indexOf(block);
    const badge = {
      easy: "🟢 Easy",
      medium: "🟡 Medium",
      hard: "🔴 Hard"
    }[data.difficulty] || "";

    block.innerHTML = `
      <summary>
        Q${index + 1}. <span class="q" data-key="question" data-latex="${data.question}">${data.question}</span>
        <span class="difficulty-badge ${data.difficulty}">${badge}</span>
      </summary>
      <ul>
        ${data.options.map((opt, i) => `<li class="q" data-key="option${i + 1}" data-latex="${opt}">${opt}</li>`).join("")}
      </ul>
      <p><strong>✅ Answer:</strong> ${data.options[0]}</p>
      <p><strong>💡 Explanation:</strong> <span class="q" data-key="explanation" data-latex="${data.explanation}">${data.explanation}</span></p>
      <div style="margin-top: 8px;">
        <button onclick="adminEditQuestion(${id})">✏️ Edit</button>
        <button onclick="adminDeleteQuestion(${id}, this)">🗑️ Delete</button>
      </div>
    `;

    block.open = true;
    if (window.MathJax?.typesetPromise) MathJax.typesetPromise([block]);
    flashMessage("✅ Question saved.");
  }).catch(() => alert("❌ Server error"));
}

function filterQuestions() {
  const val = document.getElementById("searchInput").value.toLowerCase();
  document.querySelectorAll("#modalQuestionList details").forEach(detail => {
    const text = detail.innerText.toLowerCase();
    detail.style.display = text.includes(val) ? "" : "none";
  });
}
let allExpanded = false; // 🔥 track expand/collapse state

function toggleExpandCollapse() {
  const detailsList = document.querySelectorAll("#modalQuestionList details");
  const btn = document.getElementById("expandCollapseBtn");

  if (!btn) return;

  if (allExpanded) {
    // 🔽 Collapse all
    detailsList.forEach(d => d.open = false);
    btn.textContent = "🔽 Expand All";
    allExpanded = false;
  } else {
    // 🔼 Expand all
    detailsList.forEach(d => d.open = true);
    btn.textContent = "🔼 Collapse All";
    allExpanded = true;
  }
}

function copyViewModalText() {
  const modalTextarea = document.getElementById("viewModalTextarea");
  if (!modalTextarea) return;
  
  modalTextarea.select();
  document.execCommand('copy');

  showToast("📋 Text copied!");
}


function showToast(message = "✅ Action completed!") {
  const toast = document.getElementById("toast");
  if (!toast) return;

  toast.textContent = message;
  toast.style.opacity = "1";

  setTimeout(() => {
    toast.style.opacity = "0";
  }, 2000); // Hide after 2 seconds
}
