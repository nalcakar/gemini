const API = "https://gemini-j8xd.onrender.com";
const token = localStorage.getItem("accessToken");
const email = localStorage.getItem("userEmail");
let editMode = false;

function toggleEditMode() {
  editMode = !editMode;
  document.body.classList.toggle("edit-mode", editMode);
  renderEditControls();
}
// 🔐 Giriş kontrolü
if (!token || !email) {
  alert("⚠️ You must log in with Patreon to use the admin panel.");
  location.href = "/login.html";
  throw new Error("Not logged in");
}

// Main → Category → Title
let currentTitleId = null;
let currentMainTopicId = null;
let currentCategoryId = null;

document.addEventListener("DOMContentLoaded", () => {
  loadMainTopics();
});

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
      highlightSelected(div, "mainTopics");
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

  categories.forEach(cat => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = cat.name;
    div.onclick = () => {
      currentCategoryId = cat.id;
      highlightSelected(div, "categories");
      loadTitles(cat.id);
    };
    container.appendChild(div);
  });

  if (editMode) renderEditControls(); // 👈 Bunu EKLE
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

  titles.forEach(title => {
    const div = document.createElement("div");
    div.className = "item";
    div.textContent = title.name;
    div.onclick = () => {
      currentTitleId = title.id;
      highlightSelected(div, "titles");
      loadQuestionsByTitleName(title.name);
    };
    container.appendChild(div);
  });

  // ✅ editMode aktifse, edit butonlarını geri ekle
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
    loadMainTopics(); // yeniden yükle
  } else {
    alert("❌ Failed to rename main topic.");
  }
}


async function loadQuestionsByTitleName(titleName) {
  const container = document.getElementById("modalQuestionList");
  container.style.marginTop = "20px";
  container.innerHTML = `
    <div id="questionControlPanel" style="margin-bottom:12px; padding:12px; border:1px solid #e5e7eb; border-radius:12px; background:#f9fafb;">
      <input id="searchInput" oninput="filterQuestions()" placeholder="🔍 Soru içinde ara..." 
             style="width:100%; padding:8px 12px; border-radius:8px; border:1px solid #d1d5db; font-size:14px;" />
      <div style="margin-top:12px; display:flex; flex-wrap:wrap; gap:8px;">
        <button type="button" onclick="collapseAllDetails()">🔽 Tümünü Kapat</button>
        <button type="button" onclick="filterByDifficulty('easy')">🟢 Kolay</button>
        <button type="button" onclick="filterByDifficulty('medium')">🟡 Orta</button>
        <button type="button" onclick="filterByDifficulty('hard')">🔴 Zor</button>
        <button type="button" onclick="filterByDifficulty('')">🔁 Tümünü Göster</button>
      </div>
    </div>
    <div id="statsBox" style="margin-bottom:12px; font-weight:500;"></div>
    <p style='text-align:center;'>⏳ Sorular yükleniyor...</p>
  `;

  const token = localStorage.getItem("accessToken");
  const email = localStorage.getItem("userEmail");

  const titlesRes = await fetch(`${API}/list-titles?category_id=${currentCategoryId}&email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const titleData = await titlesRes.json();
  const matchedTitle = titleData.titles.find(t => t.name === titleName);
  if (!matchedTitle) {
    container.innerHTML += "❌ Başlık bulunamadı.";
    return;
  }

  const res = await fetch(`${API}/get-questions?title_id=${matchedTitle.id}&email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  if (!data.questions || data.questions.length === 0) {
    container.innerHTML += "<p style='text-align:center; color:gray;'>⚠️ Bu başlığa ait soru bulunamadı.</p>";
    return;
  }

  const controlPanel = document.getElementById("questionControlPanel");
  const statsBox = document.getElementById("statsBox");
  container.innerHTML = "";
  container.appendChild(controlPanel);
  container.appendChild(statsBox);

  data.questions.forEach((q, i) => {
    const block = document.createElement("details");
    block.className = "question-card";

    const question = q.question || "(soru bulunamadı)";
    const options = Array.isArray(q.options) ? q.options : [];
    const explanation = q.explanation || "Açıklama yok";
    const answer = q.answer || "";

    let badge = "";
    if (q.difficulty === "easy") {
      badge = `<span class="difficulty-badge easy" style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">🟢 Kolay</span>`;
    } else if (q.difficulty === "medium") {
      badge = `<span class="difficulty-badge medium" style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">🟡 Orta</span>`;
    } else if (q.difficulty === "hard") {
      badge = `<span class="difficulty-badge hard" style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">🔴 Zor</span>`;
    } else {
      badge = `<span class="difficulty-badge unknown" style="background:#e5e7eb;color:#6b7280;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">❔ Bilinmiyor</span>`;
    }
    block.innerHTML = `
      <summary>Q${i + 1}. ${question} ${badge}</summary>
      <ul>${options.map(opt => `<li>${opt}</li>`).join("")}</ul>
      <p><strong>✅ Cevap:</strong> ${answer}</p>
      <p><strong>💡 Açıklama:</strong> ${explanation}</p>
      <div style="margin-top: 8px;">
        <button onclick="editExistingQuestion(${q.id})">✏️ Düzenle</button>
        <button onclick="deleteExistingQuestion(${q.id}, this)">🗑️ Sil</button>
      </div>
    `;

    container.appendChild(block);
  });

  if (typeof updateStats === "function") updateStats();
  if (window.MathJax) MathJax.typesetPromise?.();

  // 🔽 SCROLL: Sorular yüklendikten sonra aşağı kaydır
  container.scrollIntoView({ behavior: "smooth" });
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
  const newMainTopicId = prompt("Enter new Main Topic ID:");
  if (!newMainTopicId) return;
  const res = await fetch(`${API}/move-category-to-main`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ category_id: currentCategoryId, new_main_id: newMainTopicId, email })
  });
  const data = await res.json();
  if (data.success) loadCategories(newMainTopicId);
  else alert("❌ Failed to move category");
}

async function renameTitle() {
  if (!currentTitleId) return alert("⚠️ Select a title first.");
  const newName = prompt("Enter new title name:");
  if (!newName) return;
  const res = await fetch(`${API}/rename-title`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title_id: currentTitleId, new_name: newName, email })
  });
  const data = await res.json();
  if (data.success) loadTitles(currentCategoryId);
  else alert("❌ Failed to rename title");
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
  const newCategoryId = prompt("Enter new category ID:");
  if (!newCategoryId) return;
  const res = await fetch(`${API}/move-title-to-category`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title_id: currentTitleId, new_category_id: newCategoryId, email })
  });
  const data = await res.json();
  if (data.success) loadTitles(newCategoryId);
  else alert("❌ Failed to move title");
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