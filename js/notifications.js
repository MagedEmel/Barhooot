import { db, collection, onSnapshot } from "./firebase-config.js";

const rawUser = sessionStorage.getItem("clan_user") || localStorage.getItem("clan_user");
const me = rawUser ? JSON.parse(rawUser) : null;
const btn = document.getElementById("btn-notifications");
const overlay = document.getElementById("notifications-overlay");
const closeBtn = document.getElementById("notifications-close");
const listEl = document.getElementById("notifications-list");

let firstLoad = true;
let latestSeen = Number(localStorage.getItem("clan_latest_alert_time") || 0);
let notifications = [];

function escapeHtml(value) {
  return String(value || "").replace(/[&<>'"]/g, (ch) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;",
  })[ch]);
}

function alertTime(alert) {
  const date = alert.createdAt?.toDate?.();
  return date ? date.getTime() : alert.createdAtMs || 0;
}

function formatTime(alert) {
  const date = alert.createdAt?.toDate?.();
  return date ? date.toLocaleString("ar-EG") : "الآن";
}

function canSee(alert) {
  if (!me) return false;
  return alert.target === "all" || alert.targetGroup === me.group;
}

function playAlertSound() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    const ctx = new AudioContext();
    const gain = ctx.createGain();
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(220, ctx.currentTime + 0.35);
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.18, ctx.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.45);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.5);
  } catch (e) {}
}

function render() {
  if (!listEl) return;
  if (!notifications.length) {
    listEl.innerHTML = '<p class="muted">لا توجد تنبيهات حالياً.</p>';
    return;
  }
  listEl.innerHTML = notifications
    .map((alert) => {
      const target = alert.target === "all" ? "كل المستخدمين" : alert.targetGroup;
      return '<div class="notice-item"><div class="row" style="justify-content:space-between; gap:8px; flex-wrap:wrap;"><strong>' + escapeHtml(alert.title || "تنبيه") + '</strong><span class="tag">' + escapeHtml(target) + '</span></div><p style="margin:8px 0 0; white-space:pre-wrap;">' + escapeHtml(alert.message || "") + '</p><p class="muted" style="margin:6px 0 0;">' + formatTime(alert) + '</p></div>';
    })
    .join("");
}

if (btn && overlay && closeBtn && listEl && me) {
  btn.addEventListener("click", () => {
    overlay.classList.remove("hidden");
    render();
  });
  closeBtn.addEventListener("click", () => overlay.classList.add("hidden"));
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.classList.add("hidden");
  });

  onSnapshot(collection(db, "notifications"), (snap) => {
    notifications = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter(canSee)
      .sort((a, b) => alertTime(b) - alertTime(a));

    const newest = notifications[0] ? alertTime(notifications[0]) : 0;
    if (!firstLoad && newest > latestSeen) {
      latestSeen = newest;
      localStorage.setItem("clan_latest_alert_time", String(latestSeen));
      playAlertSound();
    }
    if (firstLoad) {
      latestSeen = Math.max(latestSeen, newest);
      localStorage.setItem("clan_latest_alert_time", String(latestSeen));
      firstLoad = false;
    }
    render();
  });
}
