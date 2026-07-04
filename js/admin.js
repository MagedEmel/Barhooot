import {
  db,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  addDoc,
  deleteDoc,
  collection,
  getDocs,
  increment,
  onSnapshot,
  serverTimestamp,
} from "./firebase-config.js";

const gate = document.getElementById("gate");
const panel = document.getElementById("panel");
const adminPassInp = document.getElementById("admin-password");
const btnGate = document.getElementById("btn-gate");
const gateError = document.getElementById("gate-error");
const btnLogout = document.getElementById("btn-logout");

const ambience = document.getElementById("bg-ambience");
ambience.play().catch(() => {});

// ------------------------------------------------------------
// 0) تبويبات
// ------------------------------------------------------------
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((t) => t.classList.add("hidden"));
    document.getElementById(btn.dataset.tab).classList.remove("hidden");
  });
});

// ------------------------------------------------------------
// 1) بوابة الباسورد
// ------------------------------------------------------------
let settingsCache = {
  greenThreshold: 10,
  redThreshold: -10,
  shapes: [],
  adminPassword: "",
  groupsRevealed: false,
};

async function checkGate() {
  try {
    const snap = await getDoc(doc(db, "config", "settings"));
    if (snap.exists()) settingsCache = { ...settingsCache, ...snap.data() };
  } catch (e) {
    console.error(e);
  }
}

btnGate.addEventListener("click", async () => {
  await checkGate();
  if (adminPassInp.value === String(settingsCache.adminPassword)) {
    gate.classList.add("hidden");
    panel.classList.remove("hidden");
    ambience.volume = 0.3;
    ambience.play().catch(() => {});
    document.querySelector('.tab-btn[data-tab="tab-points"]').click();
    initPanel();
  } else {
    gateError.classList.remove("hidden");
  }
});
adminPassInp.addEventListener("keydown", (e) => {
  if (e.key === "Enter") btnGate.click();
});

// btnLogout.addEventListener(
//   "click",
//   () => (window.location.href = "index.html"),
// );
document.getElementById("btn-switch-account").addEventListener("click", () => {
  if (!confirm("هتمسح الحساب المحفوظ على الجهاز ده وترجع لصفحة الاختيار. متأكد؟")) return;
  localStorage.removeItem("clan_user");
  sessionStorage.removeItem("clan_user");
  localStorage.setItem("clan_admin_mode", "1"); // flag عشان يقدر يرجع
  window.location.href = "index.html";
});

// ------------------------------------------------------------
// 2) تاب النقاط
// ------------------------------------------------------------
const groupSelect = document.getElementById("group-select");
const currentScoreEl = document.getElementById("current-score");
const shapesButtons = document.getElementById("shapes-buttons");
const customPointsInp = document.getElementById("custom-points");
const btnCustomPoints = document.getElementById("btn-custom-points");
const groupsTableBody = document.querySelector("#groups-table tbody");

let groupsCache = []; // [{id, score}]

async function loadGroups() {
  const snap = await getDocs(collection(db, "groups"));
  groupsCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  groupSelect.innerHTML = groupsCache
    .map((g) => `<option value="${g.id}">${g.id}</option>`)
    .join("");
  renderGroupsTable();
  // نملى سيليكت إضافة المستخدم بأسماء المجموعات
  const userGroupSel = document.getElementById("user-group");
  if (userGroupSel) {
    userGroupSel.innerHTML = groupsCache
      .map((g) => `<option value="${g.id}">${g.id}</option>`)
      .join("");
  }
  fillAlertTargets();
  fillSubmissionsFilter();
  if (groupsCache.length) updateCurrentScoreDisplay(groupSelect.value);
}

function renderGroupsTable() {
  groupsTableBody.innerHTML = groupsCache
    .map(
      (g) => `
    <tr>
      <td>${g.id}</td>
      <td>${g.score ?? 0}</td>
      <td>
        <button class="ind-btn" data-group="${g.id}" data-level="${g.indicatorLevel ?? 90}"
          style="background:rgba(196,117,42,.15);color:var(--glow);border:1px solid var(--ember);border-radius:20px;padding:4px 12px;cursor:pointer;font-size:12px;">
          تعديل (${g.indicatorLevel ?? 90})
        </button>
      </td>
    </tr>
  `,
    )
    .join("");

  groupsTableBody.querySelectorAll(".ind-btn").forEach((btn) => {
    btn.addEventListener("click", () =>
      openIndicatorModal(btn.dataset.group, Number(btn.dataset.level)),
    );
  });
}

function updateCurrentScoreDisplay(groupId) {
  const g = groupsCache.find((x) => x.id === groupId);
  currentScoreEl.textContent = g ? (g.score ?? 0) : "--";
}

groupSelect.addEventListener("change", () =>
  updateCurrentScoreDisplay(groupSelect.value),
);

function renderShapeButtons() {
  shapesButtons.innerHTML = (settingsCache.shapes || [])
    .map(
      (s, i) => `
    <button class="btn shape-btn" data-value="${s.value}">
      ${s.label}<br><span class="muted">(${s.value > 0 ? "+" : ""}${s.value})</span>
    </button>
  `,
    )
    .join("");

  shapesButtons.querySelectorAll(".shape-btn").forEach((btn) => {
    btn.addEventListener("click", () => applyPoints(Number(btn.dataset.value)));
  });
}

async function applyPoints(value) {
  const groupId = groupSelect.value;
  if (!groupId) return;
  try {
    await updateDoc(doc(db, "groups", groupId), { score: increment(value) });
    showToast(
      `تم ${value >= 0 ? "إضافة" : "خصم"} ${Math.abs(value)} نقطة لمجموعة ${groupId}`,
    );
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
const taskContentInp = document.getElementById("task-content");
const taskOrderPerGroupDiv = document.getElementById("task-order-per-group");
const btnAddTask = document.getElementById("btn-add-task");
const tasksAdminList = document.getElementById("tasks-admin-list");

// بيبني صف فيه "ترتيب" و"باسورد" لكل عشيرة موجودة
function renderTaskGroupInputs(
  container,
  existingOrder = {},
  existingPassword = {},
) {
  if (!groupsCache.length) {
    container.innerHTML = `<p class="muted">لسه مفيش عشائر مُضافة، ضيف مستخدمين/مجموعات الأول.</p>`;
    return;
  }
  container.innerHTML = groupsCache
    .map(
      (g) => `
    <div class="group-task-row">
      <span class="group-task-row-name">${g.id}</span>
      <input class="input order-for-group" data-group="${g.id}" type="number"
             placeholder="ترتيب" value="${existingOrder[g.id] ?? ""}">
      <input class="input password-for-group" data-group="${g.id}" type="text"
             placeholder="باسورد العشيرة دي" value="${existingPassword[g.id] ?? ""}">
    </div>
  `,
    )
    .join("");
}

function collectGroupData(container) {
  const order = {};
  const password = {};
  container.querySelectorAll(".order-for-group").forEach((inp) => {
    if (inp.value !== "") order[inp.dataset.group] = Number(inp.value);
  });
  container.querySelectorAll(".password-for-group").forEach((inp) => {
    if (inp.value !== "") password[inp.dataset.group] = inp.value;
  });
  return { order, password };
}

async function loadTasksAdmin() {
  const snap = await getDocs(collection(db, "tasks"));
  const tasks = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  tasksAdminList.innerHTML = "";
  if (!tasks.length) {
    tasksAdminList.innerHTML = `<p class="muted">لا توجد مهام بعد.</p>`;
    return;
  }

  tasks.forEach((t) => {
    const orderObj = t.order && typeof t.order === "object" ? t.order : {};
    const passwordObj =
      t.password && typeof t.password === "object" ? t.password : {};
    const card = document.createElement("div");
    card.className = "card";
    card.style.marginBottom = "14px";
    card.innerHTML = `
      <div class="row" style="justify-content:space-between;">
        <span>${t.title}</span>
        <button class="btn ghost btn-delete-task" style="width:auto;">حذف</button>
      </div>
      <p class="muted" style="margin-top:8px;">ترتيب وباسورد كل عشيرة لهذه المهمة:</p>
      <div class="task-order-edit"></div>
      <button class="btn btn-save-order" style="margin-top:10px;">حفظ التعديلات</button>
    `;
    tasksAdminList.appendChild(card);

    const orderEditDiv = card.querySelector(".task-order-edit");
    renderTaskGroupInputs(orderEditDiv, orderObj, passwordObj);

    card
      .querySelector(".btn-save-order")
      .addEventListener("click", async () => {
        const { order, password } = collectGroupData(orderEditDiv);
        await updateDoc(doc(db, "tasks", t.id), { order, password });
        showToast("تم حفظ التعديلات");
      });

    card
      .querySelector(".btn-delete-task")
      .addEventListener("click", async () => {
        if (!confirm(`تأكيد حذف "${t.title}"؟`)) return;
        await deleteDoc(doc(db, "tasks", t.id));
        showToast("تم حذف المهمة");
        loadTasksAdmin();
      });
  });
}

btnAddTask.addEventListener("click", async () => {
  if (!taskTitleInp.value) {
    showToast("اكتب عنوان المهمة على الأقل");
    return;
  }
  const { order, password } = collectGroupData(taskOrderPerGroupDiv);
  if (!Object.keys(password).length) {
    showToast("لازم تكتب باسورد لعشيرة واحدة على الأقل");
    return;
  }
  await addDoc(collection(db, "tasks"), {
    title: taskTitleInp.value,
    content: taskContentInp.value,
    order, // مابّة: { "اسم العشيرة": رقم_الترتيب, ... }
    password, // مابّة: { "اسم العشيرة": "باسوردها", ... }
  });
  taskTitleInp.value = "";
  taskContentInp.value = "";
  renderTaskGroupInputs(taskOrderPerGroupDiv);
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
const usersCardsList = document.getElementById("users-cards-list");
const usersFilterGroup = document.getElementById("users-filter-group");
const editUserModal = document.getElementById("edit-user-modal");
const editUserNameInp = document.getElementById("edit-user-name");
const editUserGroupSel = document.getElementById("edit-user-group");
const editUserRoleSel = document.getElementById("edit-user-role");
const editUserCancel = document.getElementById("edit-user-cancel");
const editUserSave = document.getElementById("edit-user-save");

let allUsersCache = []; // كل اليوزرين
let editingUserId = null;

// بيرسم السيليكت للفلتر + يملأه بأسماء العشائر
function refreshUsersFilter() {
  if (!usersFilterGroup) return;
  const current = usersFilterGroup.value;
  usersFilterGroup.innerHTML =
    '<option value="all">كل العشائر</option>' +
    groupsCache.map((g) => `<option value="${g.id}">${g.id}</option>`).join("");
  usersFilterGroup.value =
    current && groupsCache.some((g) => g.id === current) ? current : "all";
}

// بيرسم الكروت بناءً على الفلتر الحالي
function renderUsersCards() {
  if (!usersCardsList) return;
  const filterVal = usersFilterGroup ? usersFilterGroup.value : "all";
  const filtered =
    filterVal === "all"
      ? allUsersCache
      : allUsersCache.filter((u) => u.group === filterVal);

  if (!filtered.length) {
    usersCardsList.innerHTML = '<p class="muted">لا يوجد مستخدمون.</p>';
    return;
  }

  usersCardsList.innerHTML = filtered
    .map(
      (u) => `
    <div class="user-row-card" style="
      display:flex; justify-content:space-between; align-items:center;
      flex-wrap:wrap; gap:8px;
      background:var(--ash); border:1px solid rgba(196,117,42,.18);
      border-radius:12px; padding:12px 16px; margin-bottom:8px;">
      <div>
        <span style="color:var(--sand);font-weight:700;">${u.name}</span>
        <span class="tag" style="margin-right:8px;">${u.group}</span>
        <span class="tag">${roleLabel(u.role)}</span>
      </div>
      <div class="row" style="gap:6px; margin:0;">
        <button class="btn ghost compact-btn btn-edit-user" data-id="${u.id}"
          style="width:auto;margin:0;padding:6px 14px;font-size:12px;">تعديل</button>
        <button class="btn compact-btn btn-delete-user" data-id="${u.id}" data-name="${u.name}"
          style="width:auto;margin:0;padding:6px 14px;font-size:12px;
                 background:rgba(255,51,51,.2);color:#ff3333;border:1px solid #ff3333;">حذف</button>
      </div>
    </div>
  `,
    )
    .join("");

  // أحداث الأزرار
  usersCardsList.querySelectorAll(".btn-edit-user").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.id));
  });
  usersCardsList.querySelectorAll(".btn-delete-user").forEach((btn) => {
    btn.addEventListener("click", () =>
      deleteUser(btn.dataset.id, btn.dataset.name),
    );
  });
}

async function loadUsersAdmin() {
  const snap = await getDocs(collection(db, "users"));
  allUsersCache = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  refreshUsersFilter();
  renderUsersCards();
}

// ─── فلتر العشيرة ────────────────────────────────────────────
if (usersFilterGroup) {
  usersFilterGroup.addEventListener("change", renderUsersCards);
}

// ─── مودال التعديل ────────────────────────────────────────────
function openEditModal(userId) {
  const user = allUsersCache.find((u) => u.id === userId);
  if (!user) return;
  editingUserId = userId;
  editUserNameInp.value = user.name;
  // نملأ سيليكت العشائر في المودال
  editUserGroupSel.innerHTML = groupsCache
    .map(
      (g) =>
        `<option value="${g.id}"${g.id === user.group ? " selected" : ""}>${g.id}</option>`,
    )
    .join("");
  editUserRoleSel.value = user.role || "user";
  editUserModal.classList.remove("hidden");
}

if (editUserCancel)
  editUserCancel.addEventListener("click", () =>
    editUserModal.classList.add("hidden"),
  );

if (editUserSave) {
  editUserSave.addEventListener("click", async () => {
    if (!editingUserId) return;
    const newName = editUserNameInp.value.trim();
    const newGroup = editUserGroupSel.value;
    const newRole = editUserRoleSel.value;
    if (!newName) {
      showToast("اكتب الاسم");
      return;
    }
    await updateDoc(doc(db, "users", editingUserId), {
      name: newName,
      group: newGroup,
      role: newRole,
    });
    editUserModal.classList.add("hidden");
    showToast("تم تحديث بيانات المستخدم");
    await loadUsersAdmin();
  });
}

// ─── حذف يوزر ─────────────────────────────────────────────────
async function deleteUser(userId, userName) {
  if (!confirm(`تأكيد حذف "${userName}" نهائياً؟`)) return;
  await deleteDoc(doc(db, "users", userId));
  showToast(`تم حذف ${userName}`);
  await loadUsersAdmin();
}

function roleLabel(r) {
  if (r === "admin") return "أدمن";
  if (r === "leader") return "ليدر";
  if (r === "lecturer") return "محاضر";
  return "يوزر";
}

btnAddUser.addEventListener("click", async () => {
  if (!userNameInp.value || !userGroupInp.value) {
    showToast("اكتب الاسم والمجموعة");
    return;
  }
  await addDoc(collection(db, "users"), {
    name: userNameInp.value.trim(),
    group: userGroupInp.value.trim(),
    role: userRoleSel.value,
  });

  // لو المجموعة دي جديدة، نعمل لها دوكيومنت سكور = 0
  const groupRef = doc(db, "groups", userGroupInp.value.trim());
  const groupSnap = await getDoc(groupRef);
  if (!groupSnap.exists()) {
    await setDoc(groupRef, { score: 0 });
  }

  userNameInp.value = "";
  userGroupInp.value = "";
  showToast("تمت إضافة المستخدم");
  loadUsersAdmin();
  await loadGroups();
  renderTaskGroupInputs(taskOrderPerGroupDiv);
});

// ------------------------------------------------------------
// 5) تاب الإعدادات
// ------------------------------------------------------------
const settingGreenInp = document.getElementById("setting-green");
const settingRedInp = document.getElementById("setting-red");
const shapesSettingsDiv = document.getElementById("shapes-settings");
const btnSaveSettings = document.getElementById("btn-save-settings");

function renderShapesSettingsInputs() {
  const shapes =
    settingsCache.shapes && settingsCache.shapes.length === 3
      ? settingsCache.shapes
      : [
          { label: "شكل 1", value: 5 },
          { label: "شكل 2", value: 10 },
          { label: "شكل 3", value: -10 },
        ];

  shapesSettingsDiv.innerHTML = shapes
    .map(
      (s, i) => `
    <div class="row" style="margin-top:10px;">
      <input class="input shape-label" data-i="${i}" value="${s.label}" placeholder="اسم الشكل">
      <input class="input shape-value" data-i="${i}" type="number" value="${s.value}" placeholder="القيمة">
    </div>
  `,
    )
    .join("");
}

function fillSettingsForm() {
  settingGreenInp.value = settingsCache.greenThreshold;
  settingRedInp.value = settingsCache.redThreshold;
  renderShapesSettingsInputs();
}

btnSaveSettings.addEventListener("click", async () => {
  const labels = [...document.querySelectorAll(".shape-label")].map(
    (i) => i.value,
  );
  const values = [...document.querySelectorAll(".shape-value")].map((i) =>
    Number(i.value),
  );
  const shapes = labels.map((label, i) => ({ label, value: values[i] }));

  const newSettings = {
    ...settingsCache,
    greenThreshold: Number(settingGreenInp.value),
    redThreshold: Number(settingRedInp.value),
    shapes,
  };

  await setDoc(doc(db, "config", "settings"), newSettings, { merge: true });
  settingsCache = newSettings;
  renderShapeButtons();
  showToast("تم حفظ الإعدادات");
});

// ------------------------------------------------------------
// 6) التنبيهات وإظهار العشائر
// ------------------------------------------------------------
const alertTitleInp = document.getElementById("alert-title");
const alertMessageInp = document.getElementById("alert-message");
const alertTargetSel = document.getElementById("alert-target");
const btnSendAlert = document.getElementById("btn-send-alert");
const alertsAdminList = document.getElementById("alerts-admin-list");
const revealStatus = document.getElementById("reveal-status");
const btnRevealGroups = document.getElementById("btn-reveal-groups");

function fillAlertTargets() {
  if (!alertTargetSel) return;
  const current = alertTargetSel.value || "all";
  alertTargetSel.innerHTML =
    '<option value="all">كل المستخدمين</option>' +
    groupsCache
      .map((g) => `<option value="${g.id}">عشيرة ${g.id}</option>`)
      .join("");
  alertTargetSel.value = groupsCache.some((g) => g.id === current)
    ? current
    : "all";
}

function fillSubmissionsFilter() {
  const filter = document.getElementById("submissions-filter");
  if (!filter) return;
  const current = filter.value || "all";
  filter.innerHTML =
    '<option value="all">كل العشائر</option>' +
    groupsCache
      .map((g) => `<option value="${g.id}">عشيرة ${g.id}</option>`)
      .join("");
  filter.value =
    current === "all" || groupsCache.some((g) => g.id === current)
      ? current
      : "all";
}

function escapeHtml(value) {
  return String(value || "").replace(
    /[&<>'"]/g,
    (ch) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "'": "&#39;",
        '"': "&quot;",
      })[ch],
  );
}

async function refreshRevealStatus() {
  await checkGate();
  const isRevealed = settingsCache.groupsRevealed === true;
  if (revealStatus) {
    revealStatus.textContent = isRevealed
      ? "العشائر ظاهرة حالياً لكل المستخدمين."
      : "المستخدمون يرون رسالة انتظار تحديد العشيرة حالياً.";
  }
  if (btnRevealGroups) {
    btnRevealGroups.disabled = false;
    btnRevealGroups.classList.toggle("danger", isRevealed);
    btnRevealGroups.textContent = isRevealed
      ? "إخفاء العشائر عن المستخدمين"
      : "إظهار العشائر لكل المستخدمين";
  }
}

btnRevealGroups?.addEventListener("click", async () => {
  const nextValue = settingsCache.groupsRevealed !== true;
  await setDoc(
    doc(db, "config", "settings"),
    { groupsRevealed: nextValue },
    { merge: true },
  );
  settingsCache.groupsRevealed = nextValue;
  await refreshRevealStatus();
  showToast(
    nextValue
      ? "تم إظهار العشائر لكل المستخدمين"
      : "تم إخفاء العشائر عن المستخدمين",
  );
});

btnSendAlert?.addEventListener("click", async () => {
  const title = alertTitleInp.value.trim();
  const message = alertMessageInp.value.trim();
  const targetValue = alertTargetSel.value;
  if (!title && !message) {
    showToast("اكتب عنوان أو نص التنبيه");
    return;
  }

  await addDoc(collection(db, "notifications"), {
    title: title || "تنبيه",
    message,
    target: targetValue === "all" ? "all" : "group",
    targetGroup: targetValue === "all" ? "" : targetValue,
    createdAt: serverTimestamp(),
    createdAtMs: Date.now(),
  });

  alertTitleInp.value = "";
  alertMessageInp.value = "";
  showToast("تم إرسال التنبيه");
  loadAlertsAdmin();
});

async function loadAlertsAdmin() {
  if (!alertsAdminList) return;
  const snap = await getDocs(collection(db, "notifications"));
  const alerts = snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.createdAtMs || 0) - (a.createdAtMs || 0))
    .slice(0, 12);

  alertsAdminList.innerHTML = alerts.length
    ? alerts
        .map((alert) => {
          const target =
            alert.target === "all"
              ? "كل المستخدمين"
              : `عشيرة ${alert.targetGroup}`;
          return `<div class="notice-item"><div class="row" style="justify-content:space-between; gap:8px; flex-wrap:wrap;"><strong>${escapeHtml(alert.title)}</strong><span class="tag">${escapeHtml(target)}</span></div><p style="margin:8px 0 0; white-space:pre-wrap;">${escapeHtml(alert.message)}</p></div>`;
        })
        .join("")
    : '<p class="muted">لا توجد تنبيهات بعد.</p>';
}

// ------------------------------------------------------------
// 7) تنبيهات Toast
// ------------------------------------------------------------
function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}

function startSubmissionsFeed() {
  const feedEl = document.getElementById("submissions-feed");
  const filterEl = document.getElementById("submissions-filter");
  if (!feedEl) return;
  let submissionsCache = [];

  function renderSubmissionsFeed() {
    const selectedGroup = filterEl?.value || "all";
    const filtered =
      selectedGroup === "all"
        ? submissionsCache
        : submissionsCache.filter((s) => s.group === selectedGroup);

    feedEl.innerHTML = filtered.length
      ? filtered
          .map((s) => {
            const t = s.createdAt?.toDate?.();
            const time = t ? t.toLocaleTimeString("ar-EG") : "الآن";
            return `
              <div class="card" style="margin-bottom:10px; padding:14px 18px;">
                <div class="row" style="justify-content:space-between; flex-wrap:wrap; gap:6px;">
                  <span style="color:var(--sand); font-weight:700;">${escapeHtml(s.group)}</span>
                  <span class="tag">${time}</span>
                </div>
                <p class="muted" style="margin-top:6px;">${escapeHtml(s.workshop)}</p>
                <p style="color:var(--green); font-weight:700; margin-top:4px;">+${escapeHtml(s.points)} نقطة</p>
                <p class="muted" style="font-size:12px;">المحاضر: ${escapeHtml(s.lecturerName)}</p>
              </div>
            `;
          })
          .join("")
      : `<p class="muted">لا توجد إرسالات لهذه العشيرة حالياً.</p>`;
  }

  filterEl?.addEventListener("change", renderSubmissionsFeed);

  import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js").then(
    ({ onSnapshot, collection, query, orderBy, limit }) => {
      const q = query(
        collection(db, "submissions"),
        orderBy("createdAt", "desc"),
        limit(60),
      );
      onSnapshot(q, (snap) => {
        submissionsCache = snap.docs.map((d) => d.data());
        renderSubmissionsFeed();
      });
    },
  );
}

// -------------------- مودال التحكم الدقيق في المؤشر --------------------
let activeIndicatorGroup = null;
const indModal = document.getElementById("indicator-modal");
const indSlider = document.getElementById("indicator-slider");
const indLabel = document.getElementById("modal-indicator-label");
const sliderValLbl = document.getElementById("slider-val-label");
const indGroupName = document.getElementById("modal-group-name");
const modalCancelInd = document.getElementById("modal-cancel-ind");
const modalSaveInd = document.getElementById("modal-save-ind");

function openIndicatorModal(groupId, currentVal) {
  activeIndicatorGroup = groupId;
  indGroupName.textContent = groupId;
  indSlider.value = currentVal;
  updateSliderUI(currentVal);
  indModal.classList.remove("hidden");
  document.querySelectorAll(".preset-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      indSlider.value = btn.dataset.val;
      updateSliderUI(Number(btn.dataset.val));
    });
  });
}

function updateSliderUI(val) {
  sliderValLbl.textContent = `القيمة: ${val}`;
  if (val >= 67) {
    indLabel.textContent = "أحمر";
    indLabel.className = "indicator-label red";
  } else if (val >= 34) {
    indLabel.textContent = "أصفر";
    indLabel.className = "indicator-label yellow";
  } else {
    indLabel.textContent = "أخضر";
    indLabel.className = "indicator-label green";
  }
}

indSlider.addEventListener("input", () =>
  updateSliderUI(Number(indSlider.value)),
);

modalCancelInd.addEventListener("click", () =>
  indModal.classList.add("hidden"),
);

modalSaveInd.addEventListener("click", async () => {
  if (!activeIndicatorGroup) return;
  const val = Number(indSlider.value);
  await updateDoc(doc(db, "groups", activeIndicatorGroup), {
    indicatorLevel: val,
  });
  showToast(`✅ تم تحديث مؤشر ${activeIndicatorGroup} → ${val}`);
  indModal.classList.add("hidden");
  await loadGroups();
});

// ------------------------------------------------------------
// 7) تشغيل اللوحة كاملة بعد الدخول
// ------------------------------------------------------------
async function initPanel() {
  await checkGate();
  fillSettingsForm();
  renderShapeButtons();
  await loadGroups();
  renderTaskGroupInputs(taskOrderPerGroupDiv);
  await loadTasksAdmin();
  await loadUsersAdmin();
  fillAlertTargets();
  await refreshRevealStatus();
  await loadAlertsAdmin();
  startSubmissionsFeed();
}

// ============================================================
//  printGroupsToConsole()
//  تطبع في الكونسول 4 objects — كل object = عشيرة واحدة
//  فيها اسم العشيرة + قايمة أسماء أعضاؤها
//  استدعيها من الكونسول يدوياً: printGroupsToConsole()
// ============================================================

async function printGroupsToConsole() {
  // جيب كل المستخدمين من Firestore
  const snap = await getDocs(collection(db, "users"));
  const users = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  // جيب كل المجموعات عشان نعرف الترتيب
  const groupSnap = await getDocs(collection(db, "groups"));
  const groupIds = groupSnap.docs.map((d) => d.id);

  // جمّع المستخدمين لكل مجموعة
  const grouped = {};
  groupIds.forEach((gid) => {
    grouped[gid] = [];
  });
  users.forEach((u) => {
    if (!grouped[u.group]) grouped[u.group] = [];
    grouped[u.group].push(u.name);
  });

  // حوّل لـ array من objects وطبع كل واحد لوحده
  const entries = Object.entries(grouped);
  console.log("==============================");
  console.log(" قائمة العشائر وأعضاؤها");
  console.log("==============================");
  entries.forEach(([groupName, members], i) => {
    const obj = {
      عشيرة: groupName,
      الأعضاء: members,
      عدد_الأعضاء: members.length,
    };
    console.log(`\n📌 العشيرة ${i + 1}: ${groupName}`);
    console.table(members.map((name) => ({ الاسم: name })));
    console.log(obj);
  });
  console.log("\n==============================");
  console.log("الكل في object واحد:");
  console.log(grouped);
}

// اجعلها متاحة في الكونسول مباشرة
window.printGroupsToConsole = printGroupsToConsole;

printGroupsToConsole();
