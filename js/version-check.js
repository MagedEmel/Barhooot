// ============================================================
//  Auto Update Checker
//  بيتأكد كل فترة لو في كومنت جديد ع GitHub Pages،
//  ولو لقى فيه، يظهر شريط فوق "تحديث جديد" ويعمل ريفريش لوحده
//  من غير ما المستخدم يحتاج يعمل Hard Refresh
// ============================================================

// 1) غيّر القيمتين دول باسم اليوزر/الريبو بتاعك على جيت هاب
const GH_OWNER = "MagedEmel";
const GH_REPO  = "Barhooot";
const GH_BRANCH = "main"; // أو master لو دي اسم البرانش بتاعك

const CHECK_INTERVAL_MS = 25000; // كل 25 ثانية
const API_URL = `https://api.github.com/repos/${GH_OWNER}/${GH_REPO}/commits/${GH_BRANCH}`;

let currentSha = null;

async function fetchLatestSha() {
  try {
    const res = await fetch(API_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.sha || null;
  } catch (e) {
    return null;
  }
}

function showUpdateBanner() {
  if (document.getElementById("update-banner")) return;
  const banner = document.createElement("div");
  banner.id = "update-banner";
  banner.textContent = "⚠ ظهر تحديث جديد في العشيرة... اضغط هنا للدخول للنسخة الجديدة";
  banner.addEventListener("click", () => location.reload());
  document.body.appendChild(banner);

  // ريفريش تلقائي بعد 4 ثواني لو مالمسش حد البانر
  setTimeout(() => location.reload(), 4000);
}

async function checkForUpdate() {
  const sha = await fetchLatestSha();
  if (!sha) return;
  if (currentSha === null) {
    currentSha = sha; // أول قراءة، نخزنها كمرجع
    return;
  }
  if (sha !== currentSha) {
    showUpdateBanner();
  }
}

export function startAutoUpdateWatcher() {
  // أول تشيك فوري عشان نسجل السها الحالي
  checkForUpdate();
  setInterval(checkForUpdate, CHECK_INTERVAL_MS);

  // كمان: لما اليوزر يرجع للتاب بعد ما يكون بعيد عنه، نتشيك فوراً
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
}
