// ==============================================
// 🔹 GLOBAL O'ZGARUVCHILAR
// ==============================================
let allData = [];

// 🔹 Fayllar ro‘yxati
const EXCEL_FILES = ["javob111.xlsx", "quizresults.xlsx"];
const WORD_FILES = ["Jami2025.docx", "Testsavollarijavoblaribilan.doc"];

// 🔹 Statik ma’lumot
const staticData = [
//   { Savol: "eldor", Javob: "eng zori" },
];

// 🔹 HTML elementlar
const searchInputs = [
  document.getElementById("searchInput1"),
  document.getElementById("searchInput2")
];
const resultContainers = [
  document.getElementById("resultsContainer1"),
  document.getElementById("resultsContainer2")
];

// ==============================================
// 🟩 Normalize (uzbcha harflar uchun tozalovchi funksiya)
// ==============================================
function normalizeText(text) {
  return text
    .toLowerCase()
    .replace(/[’'‘`]/g, "'")
    .replace(/ё/g, "yo")
    .replace(/ў/g, "o‘")
    .replace(/қ/g, "q")
    .replace(/ғ/g, "g‘");
}

// ==============================================
// 🟩 Excel fayllarni o‘qish
// ==============================================
async function loadExcelFile(file) {
  if (typeof XLSX === 'undefined') return [];
  try {
    const res = await fetch(file);
    const buf = await res.arrayBuffer();
    const workbook = XLSX.read(buf, { type: "array" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    return rows.map(r => ({
      Savol: (r["Savollar"] || r["Savol"] || "").toString().trim(),
      Javob: (r["Javoblar"] || r["Javob"] || "").toString().trim(),
    })).filter(r => r.Savol && r.Javob);
  } catch (err) {
    console.warn("Excel o‘qishda xato:", file, err);
    return [];
  }
}

// ==============================================
// 🟩 Word fayllarni o‘qish
// ==============================================
async function loadWordFile(file) {
  if (typeof mammoth === 'undefined') return [];
  try {
    const res = await fetch(file);
    const buf = await res.arrayBuffer();
    const result = await mammoth.extractRawText({ arrayBuffer: buf });
    const text = result.value.trim();
    const data = [];

    const regex = /Savol[:\-–]\s*([\s\S]*?)\s+Javob[:\-–]\s*([\s\S]*?)(?=\nSavol[:\-–]|$)/gi;
    let match;
    while ((match = regex.exec(text)) !== null) {
      data.push({ Savol: match[1].trim(), Javob: match[2].trim() });
    }
    return data;
  } catch (err) {
    console.warn("Word o‘qishda xato:", file, err);
    return [];
  }
}

// ==============================================
// 🟩 Fuzzy qidiruv
// ==============================================
function fuzzyMatch(str, pattern) {
  str = str.toLowerCase();
  pattern = pattern.toLowerCase();
  let j = 0;
  for (let i = 0; i < str.length && j < pattern.length; i++) {
    if (str[i] === pattern[j]) j++;
  }
  return j === pattern.length;
}

// ==============================================
// 🟩 Ma’lumotlarni tayyorlash (oldindan lowercase)
// ==============================================
function prepareData(data) {
  return data.map(item => ({
    ...item,
    _lowerSavol: normalizeText(item.Savol),
    _lowerJavob: normalizeText(item.Javob),
  }));
}

// ==============================================
// 🟩 Qidiruv funksiyasi (so‘z bo‘yicha va fuzzy bilan)
// ==============================================
function filterData(inputIndex) {
  if (!searchInputs[inputIndex]) return;
  const searchTerm = normalizeText(searchInputs[inputIndex].value.trim());
  if (searchTerm === "") {
    displayResults(allData, inputIndex);
    return;
  }

  const words = searchTerm.split(/\s+/).filter(w => w.length > 2);

  const filtered = allData.filter(item => {
    const text = item._lowerSavol + " " + item._lowerJavob;
    const wordMatchCount = words.filter(w => text.includes(w)).length;
    return (
      wordMatchCount >= Math.ceil(words.length * 0.5) ||
      fuzzyMatch(item._lowerSavol, searchTerm) ||
      fuzzyMatch(item._lowerJavob, searchTerm)
    );
  });

  displayResults(filtered, inputIndex, searchTerm);
}

// ==============================================
// 🟩 So‘zlarni sariq bilan belgilash funksiyasi
// ==============================================
function highlightWords(text, words) {
  let result = text;
  words.forEach(w => {
    const escaped = w.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, "gi");
    result = result.replace(regex, `<mark style="background: yellow;">$1</mark>`);
  });
  return result;
}

// ==============================================
// 🟩 Natijalarni chiqarish (DOM optimallashtirilgan + so‘z highlight)
// ==============================================
function displayResults(results, index, searchTerm = "") {
  const container = resultContainers[index];
  if (!container) return;

  if (results.length === 0) {
    container.innerHTML = `<p class="no-results">⚠️ <b>${searchTerm}</b> bo‘yicha natija topilmadi.</p>`;
    return;
  }

  const words = searchTerm.split(/\s+/).filter(w => w.length > 2);
  let html = "";

  results.forEach((item, i) => {
    let savol = item.Savol;
    let javob = item.Javob;

    if (words.length > 0) {
      savol = highlightWords(savol, words);
      javob = highlightWords(javob, words);
    }

    html += `
      <div class="result-item">
        <p><b style="color:#3b82f6">Savol:</b> ${savol}</p>
        <p><b style="color:#3b82f6">Javob:</b> ${javob}</p>
      </div>
      ${i < results.length - 1 ? '<hr class="result-separator">' : ''}
    `;
  });

  container.innerHTML = html;
}

// ==============================================
// 🟩 Barcha manbalarni yuklash
// ==============================================
async function loadAllData() {
  allData = [...staticData];

  const excelPromises = (typeof XLSX !== 'undefined' ? EXCEL_FILES : []).map(f => loadExcelFile(f));
  const wordPromises = (typeof mammoth !== 'undefined' ? WORD_FILES : []).map(f => loadWordFile(f));

  const results = await Promise.all([...excelPromises, ...wordPromises]);
  results.forEach(r => (allData = allData.concat(r)));

  allData = prepareData(allData);

  if (resultContainers[0]) displayResults(allData, 0);
  if (resultContainers[1]) displayResults(allData, 1);

  if (excelPromises.length > 0 && typeof XLSX === 'undefined')
    console.warn("Excel fayllarini yuklash uchun XLSX.js kutubxonasini ulash kerak.");
  if (wordPromises.length > 0 && typeof mammoth === 'undefined')
    console.warn("Word fayllarini yuklash uchun Mammoth.js kutubxonasini ulash kerak.");
}

// ==============================================
// 🟩 Debounce funksiyasi
// ==============================================
function debounce(fn, delay = 300) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => fn(...args), delay);
  };
}

// ==============================================
// 🟩 Eventlar (debounce bilan)
// ==============================================
if (searchInputs[0]) {
  searchInputs[0].addEventListener("keyup", debounce(() => filterData(0), 300));
}
if (searchInputs[1]) {
  searchInputs[1].addEventListener("keyup", debounce(() => filterData(1), 300));
}

// ==============================================
// 🟩 Boshlang‘ich yuklash
// ==============================================
window.onload = loadAllData;


// my kod

function filterData(inputIndex) {
    if (!searchInputs[inputIndex]) return;
    const searchTerm = searchInputs[inputIndex].value.toLowerCase().trim();
    if (searchTerm === "") {
      displayResults(allData, inputIndex);
      return;
    }
  
    // So‘zlarni ajratamiz (kamida 2ta so‘z)
    const words = searchTerm.split(/\s+/).filter(w => w.length > 2);
  
    const filtered = allData.filter(item => {
      const text = item._lowerSavol + " " + item._lowerJavob;
      // Har bir so‘z mos kelsa natijaga kiritamiz
      const wordMatchCount = words.filter(w => text.includes(w)).length;
      return (
        wordMatchCount >= Math.ceil(words.length * 0.5) || // 50% so‘z mos bo‘lsa
        fuzzyMatch(item._lowerSavol, searchTerm) ||
        fuzzyMatch(item._lowerJavob, searchTerm)
      );
    });
  
    displayResults(filtered, inputIndex, searchTerm);
  }
  