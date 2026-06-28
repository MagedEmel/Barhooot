import {
  db, doc, getDoc, setDoc, updateDoc, addDoc, collection, getDocs, increment, onSnapshot
} from "./firebase-config.js";

const gate          = document.getElementById("gate");
const panel         = document.getElementById("panel");
const adminPassInp  = document.getElementById("admin-password");
const btnGate       = document.getElementById("btn-gate");
const gateError     = document.getElementById("gate-error");
const btnLogout     = document.getElementById("btn-logout");

const ambience = document.getElementById("bg-ambience");

// ------------------------------------------------------------
// 0) تبويبات
// ------------------------------------------------------------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(t => t.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  });
});

// ------------------------------------------------------------
// 1) بوابة الباسورد
// ------------------------------------------------------------
let settingsCache = { greenThreshold: 10, redThreshold: -10, shapes: [], adminPassword: "" };

async function checkGate() {
  try {
    const snap = await getDoc(doc(db, "config", "settings"));
    if (snap.exists()) settingsCache = { ...settingsCache, ...snap.data() };
  } catch (e) { console.error(e); }
}

btnGate.addEventListener("click", async () => {
  await checkGate();
  if (adminPassInp.value === String(settingsCache.adminPassword)) {
    gate.classList.add("hidden");
    panel.classList.remove("hidden");
    ambience.volume = 0.3;
    ambience.play().catch(()=>{});
    document.querySelector('.tab-btn[data-tab="tab-points"]').click();
    initPanel();
  } else {
    gateError.classList.remove("hidden");
  }
});
adminPassInp.addEventListener("keydown", e => { if (e.key === "Enter") btnGate.click(); });

btnLogout.addEventListener("click", () => window.location.href = "index.html");

// ------------------------------------------------------------
// 2) تاب النقاط
// ------------------------------------------------------------
const groupSelect    = document.getElementById("group-select");
const currentScoreEl = document.getElementById("current-score");
const shapesButtons  = document.getElementById("shapes-buttons");
const customPointsInp = document.getElementById("custom-points");
const btnCustomPoints = document.getElementById("btn-custom-points");
const groupsTableBody = document.querySelector("#groups-table tbody");

let groupsCache = []; // [{id, score}]

async function loadGroups() {
  const snap = await getDocs(collection(db, "groups"));
  groupsCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));

  groupSelect.innerHTML = groupsCache.map(g => `<option value="${g.id}">${g.id}</option>`).join("");
  renderGroupsTable();
  if (groupsCache.length) updateCurrentScoreDisplay(groupSelect.value);
}

function renderGroupsTable() {
  groupsTableBody.innerHTML = groupsCache
    .map(g => `<tr><td>${g.id}</td><td>${g.score ?? 0}</td></tr>`)
    .join("");
}

function updateCurrentScoreDisplay(groupId) {
  const g = groupsCache.find(x => x.id === groupId);
  currentScoreEl.textContent = g ? (g.score ?? 0) : "--";
}

groupSelect.addEventListener("change", () => updateCurrentScoreDisplay(groupSelect.value));

function renderShapeButtons() {
  shapesButtons.innerHTML = (settingsCache.shapes || []).map((s, i) => `
    <button class="btn shape-btn" data-value="${s.value}">
      ${s.label}<br><span class="muted">(${s.value > 0 ? "+" : ""}${s.value})</span>
    </button>
  `).join("");

  shapesButtons.querySelectorAll(".shape-btn").forEach(btn => {
    btn.addEventListener("click", () => applyPoints(Number(btn.dataset.value)));
  });
}

async function applyPoints(value) {
  const groupId = groupSelect.value;
  if (!groupId) return;
  try {
    await updateDoc(doc(db, "groups", groupId), { score: increment(value) });
    showToast(`تم ${value >= 0 ? "إضافة" : "خصم"} ${Math.abs(value)} نقطة لمجموعة ${groupId}`);
    await loadGroups();
    groupSelect.value = groupId;
    updateCurrentScoreDisplay(groupId);
  } catch (e) {
    console.error(e);
    showToast("حدث خطأ، حاول تاني");
  }
}

btnCustomPoints.addEventListener("click", () => {
  const val = Number(customPointsInp.value);
  if (!val) return;
  applyPoints(val);
  customPointsInp.value = "";
});

// ------------------------------------------------------------
// 3) تاب المهام
// ------------------------------------------------------------
const taskTitleInp = document.getElementById("task-title");
const taskPasswordInp = document.getElementById("task-password");
const taskContentInp = document.getElementById("task-content");
const taskOrderInp = document.getElementById("task-order");
const btnAddTask = document.getElementById("btn-add-task");
const tasksAdminList = document.getElementById("tasks-admin-list");

async function loadTasksAdmin() {
  const snap = await getDocs(collection(db, "tasks"));
  const tasks = snap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a,b) => (a.order ?? 0) - (b.order ?? 0));

  tasksAdminList.innerHTML = tasks.map(t => `
    <div class="task-item" style="cursor:default;">
      <span>${t.order ?? "-"}. ${t.title} <span class="tag">باسورد: ${t.password}</span></span>
    </div>
  `).join("") || `<p class="muted">لا توجد مهام بعد.</p>`;
}

btnAddTask.addEventListener("click", async () => {
  if (!taskTitleInp.value || !taskPasswordInp.value) {
    showToast("اكتب العنوان والباسورد على الأقل");
    return;
  }
  await addDoc(collection(db, "tasks"), {
    title: taskTitleInp.value,
    password: taskPasswordInp.value,
    content: taskContentInp.value,
    order: Number(taskOrderInp.value) || 0
  });
  taskTitleInp.value = ""; taskPasswordInp.value = ""; taskContentInp.value = ""; taskOrderInp.value = "";
  showToast("تمت إضافة المهمة");
  loadTasksAdmin();
});

// ------------------------------------------------------------
// 4) تاب المستخدمين
// ------------------------------------------------------------
const userNameInp = document.getElementById("user-name");
const userGroupInp = document.getElementById("user-group");
const userRoleSel = document.getElementById("user-role");
const btnAddUser = document.getElementById("btn-add-user");
const usersTableBody = document.querySelector("#users-table tbody");

async function loadUsersAdmin() {
  const snap = await getDocs(collection(db, "users"));
  const users = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  usersTableBody.innerHTML = users.map(u => `
    <tr><td>${u.name}</td><td>${u.group}</td><td>${roleLabel(u.role)}</td></tr>
  `).join("");
}

function roleLabel(r) {
  return r === "admin" ? "أدمن" : r === "leader" ? "ليدر" : "يوزر";
}

btnAddUser.addEventListener("click", async () => {
  if (!userNameInp.value || !userGroupInp.value) {
    showToast("اكتب الاسم والمجموعة");
    return;
  }
  await addDoc(collection(db, "users"), {
    name: userNameInp.value.trim(),
    group: userGroupInp.value.trim(),
    role: userRoleSel.value
  });

  // لو المجموعة دي جديدة، نعمل لها دوكيومنت سكور = 0
  const groupRef = doc(db, "groups", userGroupInp.value.trim());
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) {
    await setDoc(groupRef, { score: 0 });
  }

  userNameInp.value = ""; userGroupInp.value = "";
  showToast("تمت إضافة المستخدم");
  loadUsersAdmin();
  loadGroups();
});

// ------------------------------------------------------------
// 5) تاب الإعدادات
// ------------------------------------------------------------
const settingGreenInp = document.getElementById("setting-green");
const settingRedInp   = document.getElementById("setting-red");
const shapesSettingsDiv = document.getElementById("shapes-settings");
const btnSaveSettings = document.getElementById("btn-save-settings");

function renderShapesSettingsInputs() {
  const shapes = settingsCache.shapes && settingsCache.shapes.length === 3
    ? settingsCache.shapes
    : [{label:"شكل 1", value:5},{label:"شكل 2", value:10},{label:"شكل 3", value:-10}];

  shapesSettingsDiv.innerHTML = shapes.map((s, i) => `
    <div class="row" style="margin-top:10px;">
      <input class="input shape-label" data-i="${i}" value="${s.label}" placeholder="اسم الشكل">
      <input class="input shape-value" data-i="${i}" type="number" value="${s.value}" placeholder="القيمة">
    </div>
  `).join("");
}

function fillSettingsForm() {
  settingGreenInp.value = settingsCache.greenThreshold;
  settingRedInp.value = settingsCache.redThreshold;
  renderShapesSettingsInputs();
}

btnSaveSettings.addEventListener("click", async () => {
  const labels = [...document.querySelectorAll(".shape-label")].map(i => i.value);
  const values = [...document.querySelectorAll(".shape-value")].map(i => Number(i.value));
  const shapes = labels.map((label, i) => ({ label, value: values[i] }));

  const newSettings = {
    ...settingsCache,
    greenThreshold: Number(settingGreenInp.value),
    redThreshold: Number(settingRedInp.value),
    shapes
  };

  await setDoc(doc(db, "config", "settings"), newSettings, { merge: true });
  settingsCache = newSettings;
  renderShapeButtons();
  showToast("تم حفظ الإعدادات");
});

// ------------------------------------------------------------
// 6) تنبيهات Toast
// ------------------------------------------------------------
function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

// ------------------------------------------------------------
// 7) تشغيل اللوحة كاملة بعد الدخول
// ------------------------------------------------------------
async function initPanel() {
  await checkGate();
  fillSettingsForm();
  renderShapeButtons();
  await loadGroups();
  await loadTasksAdmin();
  await loadUsersAdmin();
}
