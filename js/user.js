import { db, doc, getDoc, onSnapshot } from "./firebase-config.js";
const ambience = document.getElementById("bg-ambience");
ambience.volume = 0.3;
ambience.play().catch(()=>{});

const subEl       = document.getElementById("user-sub");
const markerEl    = document.getElementById("marker");
const labelEl     = document.getElementById("indicator-label");
const scorePillEl = document.getElementById("score-pill");
const btnLogout   = document.getElementById("btn-logout");

// ------------------------------------------------------------
// 0) التأكد إن في يوزر مسجل في الجلسة
// ------------------------------------------------------------
const raw = sessionStorage.getItem("clan_user");
if (!raw) {
  window.location.href = "index.html";
}
const me = JSON.parse(raw);
subEl.textContent = `${me.name} • تيم ${me.group}`;

btnLogout.addEventListener("click", () => {
  sessionStorage.removeItem("clan_user");
  window.location.href = "index.html";
});

// ------------------------------------------------------------
// 1) تحميل عتبات الألوان (config/settings) ثم تتبّع سكور المجموعة لحظياً
// ------------------------------------------------------------
async function init() {
  const groupRef = doc(db, "groups", me.group);
  onSnapshot(groupRef, (snap) => {
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

init();
