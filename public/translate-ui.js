// 🌍 İngilizceye çevirmek için basit sözlük
const englishDefaults = {
  "Metne Dayalı Soru Üretici": "Text-Based Question Generator",
  "Metin Girin:": "Enter Text:",
  "Soru Üret": "Generate Questions",
  "Oluşturulan Sorular:": "Generated Questions:",
  "Metin Olarak İndir (.txt)": "Download as Text (.txt)"
};

// 🌐 Sayfadaki .translatable öğeleri çevir
async function translateTranslatableElements(lang) {
  const elements = document.querySelectorAll(".translatable");
  const texts = [...elements].map((el) => el.innerText.trim());

  if (lang === "en") {
    elements.forEach((el) => {
      const original = el.innerText.trim();
      if (englishDefaults[original]) {
        el.innerText = englishDefaults[original];
      }
    });
    return;
  }

  try {
    const res = await fetch("/translate-ui", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetLang: lang, texts }),
    });

    const data = await res.json();
    const translated = data.translated;

    elements.forEach((el, i) => {
      el.innerText = translated[i];
    });
  } catch (err) {
    console.error("Çeviri hatası:", err.message);
  }
}

// 🔁 Dil dropdown'ında önceki dili seçili göster
function initLangDropdown(currentLang) {
  const select = document.getElementById("langSelect");
  if (!select) return;

  const option = Array.from(select.options).find(opt => opt.value === currentLang);
  if (option) {
    option.selected = true;
  }
}

// 🔁 Kullanıcı başka bir dil seçtiğinde localStorage'a kaydet ve reload et
function onLangChange() {
  const newLang = document.getElementById("langSelect").value;
  const oldLang = localStorage.getItem("lang");

  if (newLang === oldLang) return; // Aynı dilse reload etme

  localStorage.setItem("lang", newLang);
  location.reload();
}
