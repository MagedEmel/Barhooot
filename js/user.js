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
    const level = snap.exists() ? (snap.data().indicatorLevel ?? "red") : "red";
    const score = snap.exists() ? (snap.data().score ?? 0) : 0;
    updateIndicator(level, score);
  });
}

function updateIndicator(level, score) {
  scorePillEl.textContent = `السكور: ${score}`;
  const map = {
    red:    { color:"red",    percent: 90, text: "أحمر" },
    yellow: { color:"yellow", percent: 50, text: "أصفر" },
    green:  { color:"green",  percent: 10, text: "أخضر" },
  };
  const s = map[level] || map.red;
  labelEl.textContent = s.text;
  labelEl.className = "indicator-label " + s.color;
  markerEl.style.bottom = s.percent + "%";
}

init();
