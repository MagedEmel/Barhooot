import { db, collection, onSnapshot } from "./firebase-config.js";

const rawUser = sessionStorage.getItem("clan_user") || localStorage.getItem("clan_user");
const me = rawUser ? JSON.parse(rawUser) : null;
const btn        = document.getElementById("btn-notifications");
const overlay    = document.getElementById("notifications-overlay");
const closeBtn   = document.getElementById("notifications-close");
const listEl     = document.getElementById("notifications-list");

// ── مفتاحان منفصلان ──────────────────────────────────────────
// lastSeenTime  = آخر مرة فتح المستخدم الـ overlay فعلياً (للـ badge)
// lastAlertTime = للصوت فقط: آخر وقت تنبيه جديد وصل وهو على الصفحة
const SEEN_KEY  = "clan_last_seen_time";
const SOUND_KEY = "clan_last_alert_time";
let lastSeenTime  = Number(localStorage.getItem(SEEN_KEY)  || 0);
let lastAlertTime = Number(localStorage.getItem(SOUND_KEY) || 0);

let firstLoad = true;
let allNotifs = []; // كل التنبيهات المرئية لليوزر ده

// ─── helpers ──────────────────────────────────────────────────
function escapeHtml(v) {
  return String(v || "").replace(/[&<>'"]/g, c =>
    ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[c]);
}
function alertTime(n) {
  const d = n.createdAt?.toDate?.();
  return d ? d.getTime() : (n.createdAtMs || 0);
}
function formatTime(n) {
  const d = n.createdAt?.toDate?.();
  return d ? d.toLocaleString("ar-EG") : "الآن";
}
function canSee(n) {
  if (!me) return false;
  return n.target === "all" || n.targetGroup === me.group;
}

// ─── badge ────────────────────────────────────────────────────
let badgeEl = null;
function getBadge() {
  if (!btn) return null;
  if (!badgeEl) {
    badgeEl = document.createElement("span");
    badgeEl.style.cssText = `
      position:absolute; top:-8px; left:-8px;
      min-width:22px; height:22px; border-radius:999px;
      background:var(--crimson,#ff3333); color:#fff;
      font-size:11px; font-weight:900;
      display:none; align-items:center; justify-content:center;
      padding:0 5px; pointer-events:none;
      box-shadow:0 0 10px rgba(255,51,51,.6);
      animation:badgePop .25s cubic-bezier(.2,.9,.3,1.4) both;
    `;
    btn.style.position = "relative";
    btn.appendChild(badgeEl);
  }
  return badgeEl;
}
function updateBadge() {
  const badge = getBadge();
  if (!badge) return;
  const unread = allNotifs.filter(n => alertTime(n) > lastSeenTime).length;
  if (unread > 0) {
    badge.textContent = "+" + unread;
    badge.style.display = "flex";
  } else {
    badge.style.display = "none";
  }
}

// ─── صوت تنبيه ────────────────────────────────────────────────
function playSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const gain = ctx.createGain();
    const osc  = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start(); osc.stop(ctx.currentTime + 0.5);
  } catch(e) {}
}

// ─── render ────────────────────────────────────────────────────
function render() {
  if (!listEl) return;
  if (!allNotifs.length) {
    listEl.innerHTML = '<p class="muted">لا توجد تنبيهات حالياً.</p>';
    return;
  }
  listEl.innerHTML = allNotifs.map(n => {
    const target = n.target === "all" ? "كل المستخدمين" : n.targetGroup;
    const isNew  = alertTime(n) > lastSeenTime;
    return `
      <div class="notice-item${isNew ? " notice-unread" : ""}">
        <div class="row" style="justify-content:space-between;gap:8px;flex-wrap:wrap;">
          <strong>${escapeHtml(n.title || "تنبيه")}${isNew ? ' <span style="color:var(--crimson);font-size:11px;">• جديد</span>' : ""}</strong>
          <span class="tag">${escapeHtml(target)}</span>
        </div>
        <p style="margin:8px 0 0;white-space:pre-wrap;">${escapeHtml(n.message || "")}</p>
        <p class="muted" style="margin:6px 0 0;">${formatTime(n)}</p>
      </div>`;
  }).join("");
}

// ─── الاستماع الرئيسي ─────────────────────────────────────────
if (btn && overlay && closeBtn && listEl && me) {

  // فتح الـ overlay: نعرض التنبيهات ونحدّث lastSeenTime
  btn.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    // نحدث وقت الفتح لآخر تنبيه موجود (عشان الـ badge يصفّر)
    const newest = allNotifs[0] ? alertTime(allNotifs[0]) : Date.now();
    lastSeenTime = newest;
    localStorage.setItem(SEEN_KEY, String(lastSeenTime));
    render();        // إعادة رسم بدون علامات "جديد"
    updateBadge();   // صفّر الـ badge
  });

  closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));
  overlay.addEventListener("click", e => { if (e.target === overlay) overlay.classList.add("hidden"); });

  // onSnapshot: يسمع أي تنبيه جديد لحظياً
  onSnapshot(collection(db, "notifications"), snap => {
    allNotifs = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(canSee)
      .sort((a, b) => alertTime(b) - alertTime(a));

    if (firstLoad) {
      // أول load: نحدّث lastAlertTime بس (مش lastSeenTime) عشان الصوت
      const newest = allNotifs[0] ? alertTime(allNotifs[0]) : 0;
      lastAlertTime = Math.max(lastAlertTime, newest);
      localStorage.setItem(SOUND_KEY, String(lastAlertTime));
      firstLoad = false;
    } else {
      // تنبيه جديد وصل بعد ما الصفحة كانت مفتوحة
      const newest = allNotifs[0] ? alertTime(allNotifs[0]) : 0;
      if (newest > lastAlertTime) {
        lastAlertTime = newest;
        localStorage.setItem(SOUND_KEY, String(lastAlertTime));
        playSound();
      }
    }

    render();
    updateBadge();
  });
}
