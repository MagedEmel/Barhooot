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
  let greenThreshold = 10;
  let redThreshold = -10;

  try {
    const cfgSnap = await getDoc(doc(db, "config", "settings"));
    if (cfgSnap.exists()) {
      const cfg = cfgSnap.data();
      greenThreshold = cfg.greenThreshold ?? greenThreshold;
      redThreshold = cfg.redThreshold ?? redThreshold;
    }
  } catch (e) {
    console.error("خطأ في تحميل الإعدادات:", e);
  }

  const groupRef = doc(db, "groups", me.group);

  onSnapshot(groupRef, (snap) => {
    const score = snap.exists() ? (snap.data().score ?? 0) : 0;
    updateIndicator(score, greenThreshold, redThreshold);
  }, (err) => {
    console.error("خطأ في تتبع السكور:", err);
  });
}

function updateIndicator(score, greenThreshold, redThreshold) {
  scorePillEl.textContent = `السكور: ${score}`;

  let color, percent;
  if (score >= greenThreshold) {
    color = "green";
    percent = 90;
    labelEl.textContent = "أخضر";
  } else if (score <= redThreshold) {
    color = "red";
    percent = 10;
    labelEl.textContent = "أحمر";
  } else {
    color = "yellow";
    // نحسب نسبة المؤشر بين العتبتين عشان يبان تدريجي وسط المنطقة الصفراء
    const ratio = (score - redThreshold) / (greenThreshold - redThreshold); // 0..1
    percent = 25 + ratio * 50; // يتراوح بين 25% و 75%
    labelEl.textContent = "أصفر";
  }

  labelEl.className = "indicator-label " + color;
  markerEl.style.bottom = percent + "%";
}

init();
