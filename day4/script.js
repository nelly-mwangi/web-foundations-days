const noteText = document.getElementById("note-text");
const charCount = document.getElementById("char-count");
const wordCount = document.getElementById("word-count");
const clearBtn = document.getElementById("clear-btn");
const themeToggle = document.getElementById("theme-toggle");

function updateCounts() {
  const text = noteText.value;
  const characterNumber = text.length;

  const words = text.trim() === "" ? [] : text.trim().split(/\s+/);

  charCount.textContent = `${characterNumber} / 200 characters`;
  wordCount.textContent = `${words.length} words`;

  charCount.classList.remove("warning", "over");

  if (characterNumber > 200) {
    charCount.classList.add("over");
  } else if (characterNumber > 180) {
    charCount.classList.add("warning");
  }
}

noteText.addEventListener("input", () => {
  updateCounts();
  localStorage.setItem("noteDraft", noteText.value);
});

function clearNote() {
  noteText.value = "";
  localStorage.removeItem("noteDraft");
  updateCounts();
}

clearBtn.addEventListener("click", clearNote);

noteText.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    clearNote();
  }
});

function updateThemeButton() {
  if (document.body.classList.contains("dark")) {
    themeToggle.textContent = "Light mode";
  } else {
    themeToggle.textContent = "Dark mode";
  }
}

themeToggle.addEventListener("click", () => {
  document.body.classList.toggle("dark");

  const isDark = document.body.classList.contains("dark");

  localStorage.setItem("theme", isDark ? "dark" : "light");

  updateThemeButton();
});

const savedDraft = localStorage.getItem("noteDraft");

if (savedDraft !== null) {
  noteText.value = savedDraft;
}

const savedTheme = localStorage.getItem("theme");

if (savedTheme === "dark") {
  document.body.classList.add("dark");
}

updateThemeButton();
updateCounts();
