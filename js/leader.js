import { db, doc, getDoc, onSnapshot, collection, getDocs } from "./firebase-config.js";

const subEl       = document.getElementById("user-sub");
const markerEl    = document.getElementById("marker");
const labelEl     = document.getElementById("indicator-label");
const scorePillEl = document.getElementById("score-pill");
const btnLogout   = document.getElementById("btn-logout");
const tasksList   = document.getElementById("tasks-list");

const modalOverlay   = document.getElementById("modal-overlay");
const modalTitle     = document.getElementById("modal-title");
const modalPassword  = document.getElementById("modal-password");
const modalError     = document.getElementById("modal-error");
const modalCancel    = document.getElementById("modal-cancel");
const modalSubmit    = document.getElementById("modal-submit");

const contentOverlay = document.getElementById("content-overlay");
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
  let greenThreshold = 10, redThreshold = -10;
  try {
    const cfgSnap = await getDoc(doc(db, "config", "settings"));
    if (cfgSnap.exists()) {
      const cfg = cfgSnap.data();
      greenThreshold = cfg.greenThreshold ?? greenThreshold;
      redThreshold = cfg.redThreshold ?? redThreshold;
    }
  } catch (e) { console.error(e); }

  onSnapshot(doc(db, "groups", me.group), (snap) => {
    const score = snap.exists() ? (snap.data().score ?? 0) : 0;
    updateIndicator(score, greenThreshold, redThreshold);
  });
}

function updateIndicator(score, greenThreshold, redThreshold) {
  scorePillEl.textContent = `السكور: ${score}`;
  let color, percent;
  if (score >= greenThreshold) { color="green"; percent=90; labelEl.textContent="أخضر"; }
  else if (score <= redThreshold) { color="red"; percent=10; labelEl.textContent="أحمر"; }
  else {
    color="yellow";
    const ratio = (score - redThreshold) / (greenThreshold - redThreshold);
    percent = 25 + ratio * 50;
    labelEl.textContent = "أصفر";
  }
  labelEl.className = "indicator-label " + color;
  markerEl.style.bottom = percent + "%";
}

// ------------------------------------------------------------
// 2) تحميل المهام (Tasks) وعرضها مقفولة
// ------------------------------------------------------------
let activeTask = null;
const unlocked = new Set(); // tasks اللي اتفكت في الجلسة دي

async function loadTasks() {
  try {
    const snap = await getDocs(collection(db, "tasks"));
    let tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    tasks.sort((a,b) => (a.order ?? 0) - (b.order ?? 0));

    tasksList.innerHTML = "";
    tasks.forEach(task => {
      const item = document.createElement("div");
      item.className = "task-item";
      item.innerHTML = `
        <span>${task.title}</span>
        <span class="lock-icon">🔒</span>
      `;
      item.addEventListener("click", () => {
        if (unlocked.has(task.id)) {
          openContent(task);
        } else {
          openPasswordModal(task);
        }
      });
      tasksList.appendChild(item);
    });

    if (tasks.length === 0) {
      tasksList.innerHTML = `<p class="muted">لا توجد مهام حالياً.</p>`;
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
  modalPassword.focus();
}

modalCancel.addEventListener("click", () => modalOverlay.classList.add("hidden"));

modalSubmit.addEventListener("click", checkPassword);
modalPassword.addEventListener("keydown", (e) => { if (e.key === "Enter") checkPassword(); });

function checkPassword() {
  if (!activeTask) return;
  if (modalPassword.value === String(activeTask.password)) {
    unlocked.add(activeTask.id);
    modalOverlay.classList.add("hidden");
    sfxUnlock.play().catch(()=>{});
    markTaskUnlocked(activeTask.id);
    openContent(activeTask);
  } else {
    modalError.classList.remove("hidden");
  }
}

function markTaskUnlocked(taskId) {
  document.querySelectorAll(".task-item").forEach(el => {
    if (el.textContent.includes(activeTask.title)) {
      el.classList.add("unlocked");
      el.querySelector(".lock-icon").textContent = "🔓";
    }
  });
}

function openContent(task) {
  contentTitle.textContent = task.title;
  contentBody.textContent = task.content || "(لا يوجد محتوى مضاف لهذه المهمة)";
  contentOverlay.classList.remove("hidden");
}
contentClose.addEventListener("click", () => contentOverlay.classList.add("hidden"));

initIndicator();
loadTasks();
