import { db, doc, getDoc, onSnapshot, collection, getDocs } from "./firebase-config.js";

const ambience = document.getElementById("bg-ambience");
ambience.volume = 0.3;
ambience.play().catch(()=>{});

const subEl       = document.getElementById("user-sub");
const markerEl    = document.getElementById("marker");
const labelEl     = document.getElementById("indicator-label");
const scorePillEl = document.getElementById("score-pill");
const btnLogout   = document.getElementById("btn-logout");
const tasksList   = document.getElementById("tasks-list");

const modalOverlay   = document.getElementById("modal-overlay");
const modalCard      = modalOverlay.querySelector(".card");
const modalTitle     = document.getElementById("modal-title");
const modalPassword  = document.getElementById("modal-password");
const modalError     = document.getElementById("modal-error");
const modalCancel    = document.getElementById("modal-cancel");
const modalSubmit    = document.getElementById("modal-submit");

const contentOverlay = document.getElementById("content-overlay");
const contentCard    = contentOverlay.querySelector(".card");
const contentTitle   = document.getElementById("content-title");
const contentBody    = document.getElementById("content-body");
const contentClose   = document.getElementById("content-close");

const sfxUnlock = document.getElementById("sfx-unlock");

// ------------------------------------------------------------
// 0) المستخدم لازم يكون ليدر (أو أدمن) عشان يدخل الصفحة دي
// ------------------------------------------------------------
const raw = sessionStorage.getItem("clan_user");
if (!raw) window.location.href = "index.html";
const me = JSON.parse(raw);
if (me.role !== "leader" && me.role !== "admin") {
  window.location.href = "user.html";
}
subEl.textContent = `${me.name} • تيم ${me.group} • ليدر`;

btnLogout.addEventListener("click", () => {
  sessionStorage.removeItem("clan_user");
  window.location.href = "index.html";
});

// ------------------------------------------------------------
// 1) المؤشر (نفس منطق صفحة اليوزر)
// ------------------------------------------------------------
async function initIndicator() {
  onSnapshot(doc(db, "groups", me.group), (snap) => {
    const level = snap.exists() ? (snap.data().indicatorLevel ?? 90) : 90;
    const score = snap.exists() ? (snap.data().score ?? 0) : 0;
    updateIndicator(level, score);
  });
}

function updateIndicator(level, score) {
  const percent = typeof level === "number" ? level : 90;
  markerEl.style.bottom = percent + "%";
  if (percent >= 67) {
    labelEl.textContent = "أحمر"; labelEl.className = "indicator-label red";
  } else if (percent >= 34) {
    labelEl.textContent = "أصفر"; labelEl.className = "indicator-label yellow";
  } else {
    labelEl.textContent = "أخضر"; labelEl.className = "indicator-label green";
  }
}

// ------------------------------------------------------------
// 2) تحميل المهام (Tasks) وعرضها مقفولة
//    - الترتيب مختلف لكل عشيرة (order[group])
//    - الباسورد مختلف لكل عشيرة (password[group]) عشان التيمات متغشش من بعض
//    - أي تاسك اتفتح مرة، يفضل مفتوح للأبد لهذه العشيرة (محفوظ في localStorage)
// ------------------------------------------------------------
let activeTask = null;

function unlockKey(taskId) {
  return `clan_unlocked_${me.group}_${taskId}`;
}
function isUnlocked(taskId) {
  return localStorage.getItem(unlockKey(taskId)) === "1";
}
function persistUnlocked(taskId) {
  localStorage.setItem(unlockKey(taskId), "1");
}

// دعم فورمات قديم: لو order/password كانوا قيمة واحدة (مش Object) بتتطبق على كل العشائر
function orderFor(task) {
  if (task.order && typeof task.order === "object") {
    const v = task.order[me.group];
    return v === undefined ? Infinity : v;
  }
  return typeof task.order === "number" ? task.order : Infinity;
}
function passwordFor(task) {
  if (task.password && typeof task.password === "object") {
    return task.password[me.group];
  }
  return task.password;
}

async function loadTasks() {
  try {
    const snap = await getDocs(collection(db, "tasks"));
    let tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    // نعرض بس المهام اللي فعلاً عندها باسورد متظبط لعشيرتنا
    tasks = tasks.filter(t => passwordFor(t) !== undefined && passwordFor(t) !== "");

    tasks.sort((a, b) => orderFor(a) - orderFor(b));

    tasksList.innerHTML = "";
    tasks.forEach((task, i) => {
      const unlocked = isUnlocked(task.id);
      const item = document.createElement("div");
      item.className = "task-item fade-in";
      item.style.animationDelay = (i * 0.06) + "s";
      item.dataset.taskId = task.id;
      item.innerHTML = `
        <span class="task-name">
          ${unlocked ? `<span class="badge-open">مفتوحة</span>` : ""}${task.title}
        </span>
        <span class="lock-icon">${unlocked ? "🔓" : "🔒"}</span>
      `;
      item.addEventListener("click", () => {
        if (isUnlocked(task.id)) {
          openContent(task);
        } else {
          openPasswordModal(task);
        }
      });
      tasksList.appendChild(item);
    });

    if (tasks.length === 0) {
      tasksList.innerHTML = `<p class="muted">لا توجد مهام متاحة لعشيرتك حالياً.</p>`;
    }
  } catch (e) {
    console.error(e);
    tasksList.innerHTML = `<p class="muted">حدث خطأ في تحميل المهام.</p>`;
  }
}

function openPasswordModal(task) {
  activeTask = task;
  modalTitle.textContent = `🔒 ${task.title}`;
  modalPassword.value = "";
  modalError.classList.add("hidden");
  modalOverlay.classList.remove("hidden");
  modalOverlay.classList.add("overlay-fade");
  modalCard.classList.remove("reveal-pop");
  modalCard.classList.add("reveal-pop");
  modalPassword.focus();
}

modalCancel.addEventListener("click", () => modalOverlay.classList.add("hidden"));

modalSubmit.addEventListener("click", checkPassword);
modalPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") checkPassword(); });

function checkPassword() {
  if (!activeTask) return;
  const correctPassword = passwordFor(activeTask);
  if (modalPassword.value === String(correctPassword)) {
    persistUnlocked(activeTask.id); // يفضل مفتوح للأبد بعد كذا
    modalOverlay.classList.add("hidden");
    sfxUnlock.play().catch(()=>{});
    loadTasks(); // إعادة رسم القايمة بالبادچ والقفل المفتوح
    openContent(activeTask);
  } else {
    // هزة على المودال + رسالة خطأ
    modalCard.classList.remove("shake");
    void modalCard.offsetWidth; // إعادة تشغيل الأنيميشن
    modalCard.classList.add("shake");
    modalError.classList.remove("hidden");
  }
}

function openContent(task) {
  contentTitle.textContent = task.title;
  contentBody.textContent = task.content || "(لا يوجد محتوى مضاف لهذه المهمة)";
  contentOverlay.classList.remove("hidden");
  contentCard.classList.remove("reveal-pop");
  void contentCard.offsetWidth;
  contentCard.classList.add("reveal-pop");
}
contentClose.addEventListener("click", () => contentOverlay.classList.add("hidden"));

initIndicator();
loadTasks();
