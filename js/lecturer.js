import {
  db, collection, getDocs, addDoc, doc, updateDoc, increment, serverTimestamp
} from "./firebase-config.js";

const ambience = document.getElementById("bg-ambience");
ambience.volume = 0.3;
ambience.play().catch(()=>{});

const subEl       = document.getElementById("user-sub");
const lecGroup    = document.getElementById("lec-group");
const lecWorkshop = document.getElementById("lec-workshop");
const lecPoints   = document.getElementById("lec-points");
const btnSubmit   = document.getElementById("btn-submit");
const lecError    = document.getElementById("lec-error");
const btnLogout   = document.getElementById("btn-logout");

const raw = sessionStorage.getItem("clan_user");
if (!raw) window.location.href = "index.html";
const me = JSON.parse(raw);
if (me.role !== "lecturer" && me.role !== "admin") window.location.href = "user.html";
subEl.textContent = `${me.name} • محاضر`;

btnLogout.addEventListener("click", () => {
  sessionStorage.removeItem("clan_user");
  window.location.href = "index.html";
});

// تحميل العشائر في السيليكت
async function loadGroups() {
  const snap = await getDocs(collection(db, "groups"));
  lecGroup.innerHTML = snap.docs.map(d => `<option value="${d.id}">${d.id}</option>`).join("");
}

// إرسال النقاط
btnSubmit.addEventListener("click", async () => {
  const group    = lecGroup.value;
  const workshop = lecWorkshop.value.trim();
  const points   = Number(lecPoints.value);

  if (!workshop) { lecError.textContent = "اكتب اسم الورشة والشيفت"; lecError.classList.remove("hidden"); return; }
  if (!points)   { lecError.textContent = "اكتب عدد النقاط"; lecError.classList.remove("hidden"); return; }
  lecError.classList.add("hidden");

  btnSubmit.disabled = true;

  try {
    // سجّل الإيفنت في submissions عشان الأدمن يشوفه في الـ feed
    await addDoc(collection(db, "submissions"), {
      group,
      workshop,
      points,
      lecturerName: me.name,
      createdAt: serverTimestamp()
    });

    // زوّد السكور على المجموعة
    await updateDoc(doc(db, "groups", group), { score: increment(points) });

    lecWorkshop.value = "";
    lecPoints.value = "";
    showToast(`✅ تم إرسال ${points} نقطة لـ ${group}`);
  } catch (e) {
    console.error(e);
    lecError.textContent = "حصل خطأ، حاول تاني";
    lecError.classList.remove("hidden");
  }

  btnSubmit.disabled = false;
});

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

loadGroups();