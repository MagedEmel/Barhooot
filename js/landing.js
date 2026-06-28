import { db, collection, getDocs, query, where } from "./firebase-config.js";

const nameInput   = document.getElementById("name-input");
const namesList   = document.getElementById("names-list");
const btnEnter    = document.getElementById("btn-enter");
const errorMsg    = document.getElementById("error-msg");
const screenSelect  = document.getElementById("screen-select");
const screenWelcome = document.getElementById("screen-welcome");
const welcomeText   = document.getElementById("welcome-text");
const groupNameEl   = document.getElementById("group-name");
const btnContinue   = document.getElementById("btn-continue");

const ambience = document.getElementById("bg-ambience");
const whispers = document.getElementById("bg-whispers");
ambience.volume = 0.35;
whispers.volume = 0.25;
ambience.play().catch(()=>{});
whispers.play().catch(()=>{})
const sfxBreak = document.getElementById("sfx-break");

let usersCache = []; // [{id, name, group, role}]
let selectedUser = null;

// ------------------------------------------------------------
// 1) تحميل كل الأسماء من فاير بيز عشان الاقتراحات (datalist)
// ------------------------------------------------------------
async function loadNames() {
  try {
    const snap = await getDocs(collection(db, "users"));
    usersCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    namesList.innerHTML = "";
    usersCache.forEach(u => {
      const opt = document.createElement("option");
      opt.value = u.name;
      namesList.appendChild(opt);
    });
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
  const match = usersCache.find(u => u.name.trim() === nameInput.value.trim());
  selectedUser = match || null;
  btnEnter.disabled = !selectedUser;
});

// ------------------------------------------------------------
// 2) عند الدخول
// ------------------------------------------------------------
btnEnter.addEventListener("click", () => {
  if (!selectedUser) return;

  // نشغل الصوت (لازم يبدأ بضغطة مستخدم عشان المتصفح يسمح)
  ambience.volume = 0.35;
  whispers.volume = 0.25;
  ambience.play().catch(()=>{});
  whispers.play().catch(()=>{});
  sfxBreak.play().catch(()=>{});

  // نخزن هوية المستخدم في الجلسة
  sessionStorage.setItem("clan_user", JSON.stringify(selectedUser));

  // نعرض رسالة الترحيب المرعبة
  screenSelect.classList.add("hidden");
  screenWelcome.classList.remove("hidden");

  const txt = `أنت الآن ضمن عشيرة ${selectedUser.group}`;
  welcomeText.textContent = txt;
  welcomeText.setAttribute("data-text", txt);
  groupNameEl.textContent = `رحّب بك الظلام، ${selectedUser.name}...`;
});

// ------------------------------------------------------------
// 3) تحويل المستخدم حسب الـ role
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

loadNames();
