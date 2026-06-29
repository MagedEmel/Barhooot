import { db, collection, getDocs } from "./firebase-config.js";

const nameInput      = document.getElementById("name-input");
const suggestionsBox = document.getElementById("name-suggestions");
const btnEnter    = document.getElementById("btn-enter");
const errorMsg    = document.getElementById("error-msg");
const screenSelect  = document.getElementById("screen-select");
const screenWelcome = document.getElementById("screen-welcome");
const welcomeText   = document.getElementById("welcome-text");
const groupNameEl   = document.getElementById("group-name");
const btnContinue   = document.getElementById("btn-continue");

const confirmOverlay = document.getElementById("confirm-overlay");
const confirmNameEl  = document.getElementById("confirm-name");
const confirmBack    = document.getElementById("confirm-back");
const confirmYes     = document.getElementById("confirm-yes");

const ambience = document.getElementById("bg-ambience");
const whispers = document.getElementById("bg-whispers");
const sfxBreak = document.getElementById("sfx-break");

ambience.volume = 0.35;
whispers.volume = 0.25;
ambience.play().catch(()=>{});
whispers.play().catch(()=>{});

let usersCache = []; // [{id, name, group, role}]
let selectedUser = null;

// ------------------------------------------------------------
// 0) لو الشخص ده دخل قبل كذا من نفس الجهاز، نتخطى شاشة اختيار
//    الاسم بالكامل ونوديه على طول لشاشة الترحيب — عشان محدش
//    يقدر يفتح الصفحة تاني ويتفرج على قايمة أسماء/تيمات الناس التانية
// ------------------------------------------------------------
const remembered = localStorage.getItem("clan_user");

if (remembered) {
  // selectedUser = JSON.parse(remembered);
  // sessionStorage.setItem("clan_user", remembered);
  // showWelcome(selectedUser);
  loadNames();
} else {
  loadNames();
}

// ------------------------------------------------------------
// 1) تحميل كل الأسماء من فاير بيز عشان الاقتراحات (datalist)
//    (بيحصل بس لو الشخص بيدخل لأول مرة من الجهاز ده)
// ------------------------------------------------------------
async function loadNames() {
  try {
    const snap = await getDocs(collection(db, "users"));
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  } catch (e) {
    console.error("خطأ في تحميل الأسماء:", e);
    showError("في عطل في الاتصال بالعشيرة... حاول تاني.");
  }
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.classList.remove("hidden");
}
function clearError() {
  errorMsg.classList.add("hidden");
}

nameInput.addEventListener("input", () => {
  clearError();
  const typed = nameInput.value.trim();

  const exactMatch = usersCache.find(u => u.name.trim() === typed);
  selectedUser = exactMatch || null;
  btnEnter.disabled = !selectedUser;

  renderSuggestions(typed);
});

function renderSuggestions(typed) {
  if (!typed) {
    suggestionsBox.classList.add("hidden");
    suggestionsBox.innerHTML = "";
    return;
  }
  const matches = usersCache
    .filter(u => u.name.toLowerCase().includes(typed.toLowerCase()))
    .slice(0, 5);

  if (!matches.length) {
    suggestionsBox.classList.add("hidden");
    suggestionsBox.innerHTML = "";
    return;
  }

  suggestionsBox.innerHTML = matches.map(u =>
    `<div class="sug-item" data-name="${u.name}">${u.name}</div>`
  ).join("");
  suggestionsBox.classList.remove("hidden");

  suggestionsBox.querySelectorAll(".sug-item").forEach(el => {
    el.addEventListener("click", () => {
      nameInput.value = el.dataset.name;
      selectedUser = usersCache.find(u => u.name === el.dataset.name) || null;
      btnEnter.disabled = !selectedUser;
      suggestionsBox.classList.add("hidden");
      suggestionsBox.innerHTML = "";
    });
  });
}

document.addEventListener("click", (e) => {
  if (!suggestionsBox.contains(e.target) && e.target !== nameInput) {
    suggestionsBox.classList.add("hidden");
  }
});

// ------------------------------------------------------------
// 2) عند الضغط على "ادخل": يظهر بوب أب تأكيد الاسم الأول
// ------------------------------------------------------------
btnEnter.addEventListener("click", () => {
  if (!selectedUser) return;
  confirmNameEl.textContent = selectedUser.name;
  confirmOverlay.classList.remove("hidden");
});

confirmBack.addEventListener("click", () => {
  confirmOverlay.classList.add("hidden");
});

confirmYes.addEventListener("click", () => {
  confirmOverlay.classList.add("hidden");
  proceedEntry(selectedUser);
});

// ------------------------------------------------------------
// 3) تأكيد الدخول فعليًا: تخزين دائم + عرض رسالة الترحيب
// ------------------------------------------------------------
function proceedEntry(user) {
  ambience.play().catch(()=>{});
  whispers.play().catch(()=>{});
  sfxBreak.play().catch(()=>{});

  // تخزين دائم (يفضل بعد إقفال المتصفح) + تخزين الجلسة الحالية
  localStorage.setItem("clan_user", JSON.stringify(user));
  sessionStorage.setItem("clan_user", JSON.stringify(user));

  showWelcome(user);
}

function showWelcome(user) {
  screenSelect.classList.add("hidden");
  screenWelcome.classList.remove("hidden");

  const txt = `أنت الآن ضمن عشيرة ${user.group}`;
  welcomeText.textContent = txt;
  welcomeText.setAttribute("data-text", txt);
  groupNameEl.textContent = `رحّب بك الظلام، ${user.name}...`;
}

// ------------------------------------------------------------
// 4) تحويل المستخدم حسب الـ role
// ------------------------------------------------------------
btnContinue.addEventListener("click", () => {
  if (!selectedUser) return;
  switch (selectedUser.role) {
    case "admin":
      window.location.href = "admin.html";
      break;
    case "leader":
      window.location.href = "leader.html";
      break;
    default:
      window.location.href = "user.html";
  }
});
