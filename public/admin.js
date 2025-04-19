const API = "https://gemini-j8xd.onrender.com";
const token = localStorage.getItem("accessToken");
const email = localStorage.getItem("userEmail");

// 🔐 Giriş kontrolü
if (!token || !email) {
  alert("⚠️ You must log in with Patreon to use the admin panel.");
  location.href = "/login.html";
  throw new Error("Not logged in");
}

// Main → Category → Title
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
      highlightSelected(div, "titles");
      loadQuestionsByTitleName(title.name);
    };
    container.appendChild(div);
  });
}

async function loadQuestionsByTitleName(titleName) {
  const container = document.getElementById("modalQuestionList");
  container.innerHTML = "<p style='text-align:center;'>⏳ Sorular yükleniyor...</p>";

  // Başlığa ait ID'yi al
  const titlesRes = await fetch(`${API}/list-titles?category_id=${currentCategoryId}&email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const titleData = await titlesRes.json();
  const matchedTitle = titleData.titles.find(t => t.name === titleName);
  if (!matchedTitle) {
    container.innerHTML = "❌ Başlık bulunamadı.";
    return;
  }

  // Soruları getir
  const res = await fetch(`${API}/get-questions?title_id=${matchedTitle.id}&email=${email}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  if (!data.questions || data.questions.length === 0) {
    container.innerHTML = "<p style='text-align:center; color:gray;'>⚠️ Bu başlığa ait soru bulunamadı.</p>";
    return;
  }

  container.innerHTML = `<p style="margin-bottom:12px;">📌 <strong>${data.questions.length}</strong> soru bulundu:</p>`;

  data.questions.forEach((q, i) => {
    const block = document.createElement("details");

    const question = q.question || "(soru bulunamadı)";
    const options = Array.isArray(q.options) ? q.options : [];
    const explanation = q.explanation || "Açıklama yok";
    const answer = q.answer || "";

    // 🔍 Debug: zorluk seviyesi logla
    console.log(`Q${i + 1} zorluk seviyesi:`, q.difficulty);

    // 🎨 Badge
    let badge = "";
    if (q.difficulty === "easy") {
      badge = `<span style="background:#d1fae5;color:#065f46;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">🟢 Kolay</span>`;
    } else if (q.difficulty === "medium") {
      badge = `<span style="background:#fef3c7;color:#92400e;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">🟡 Orta</span>`;
    } else if (q.difficulty === "hard") {
      badge = `<span style="background:#fee2e2;color:#991b1b;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">🔴 Zor</span>`;
    } else {
      badge = `<span style="background:#e5e7eb;color:#6b7280;padding:2px 6px;border-radius:6px;font-size:12px;margin-left:8px;">❔ Bilinmiyor</span>`;
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

  if (window.MathJax) MathJax.typesetPromise?.();
}


 

// ✨ Helper: Highlight Active Selection
function highlightSelected(selectedDiv, containerId) {
  document.querySelectorAll(`#${containerId} .item`).forEach(d => d.classList.remove("active"));
  selectedDiv.classList.add("active");
}
