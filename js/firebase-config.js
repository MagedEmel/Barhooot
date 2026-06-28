// ============================================================
//  إعدادات فاير بيز
//  هات الكود ده من: Firebase Console > Project settings > General
//  > Your apps > Web app > SDK setup and configuration
// ============================================================

// 1) حط بياناتك هنا بدل القيم دي
const firebaseConfig = {
    apiKey: "AIzaSyC_p2B6KV03CbMGPgUhe_beg-EyU2lZy0w",
    authDomain: "conference2026-7f070.firebaseapp.com",
    projectId: "conference2026-7f070",
    storageBucket: "conference2026-7f070.firebasestorage.app",
    messagingSenderId: "47927073423",
    appId: "1:47927073423:web:7290ad8c1b3914151c6efa",
    measurementId: "G-4HW3J0B7Z8"
  };

// 2) تهيئة فاير بيز (نستخدم CDN modular SDK v10)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore,
  collection, getDocs, getDoc, doc,
  setDoc, updateDoc, addDoc, deleteDoc, query, where,
  increment, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export {
  db,
  collection, getDocs, getDoc, doc,
  setDoc, updateDoc, addDoc, deleteDoc, query, where,
  increment, onSnapshot, serverTimestamp
};

/*
===============================================================
 هيكل قاعدة البيانات (Firestore) المطلوب:
===============================================================

 1) users  (كولكشن)
    كل دوكيومنت = شخص واحد
    {
      name: "اسم الشخص",
      group: "اسم المجموعة/التيم",
      role: "user"   // أو "leader" أو "admin"
    }

 2) groups  (كولكشن)
    كل دوكيومنت id = اسم المجموعة نفسه (نفس القيمة المكتوبة في users.group)
    {
      score: 0          // النقطة الحالية للمجموعة
    }

 3) config  (كولكشن)
    دوكيومنت واحد اسمه "settings"
    {
      greenThreshold: 10,     // لو السكور يساوي أو أعلى من كذا => المؤشر يبقى أخضر
      redThreshold: -10,      // لو السكور يساوي أو أقل من كذا => المؤشر يبقى أحمر
                               // وأي قيمة بينهم => أصفر (نقطة البداية)
      shapes: [
        { label: "نصر صغير",  value: 5  },
        { label: "نصر كبير",  value: 15 },
        { label: "خيانة/عقاب", value: -10 }
      ],
      adminPassword: "ضع_باسورد_الأدمن_هنا"
    }

 4) tasks  (كولكشن)
    كل دوكيومنت = مهمة/مكان مقفول بباسورد (يظهر فقط لليدر)
    {
      title: "اسم المهمة كما يظهر مقفولاً",
      password: "1234",
      content: "النص أو الموقع اللي يظهر بعد فتح القفل",
      order: 1
    }

===============================================================
*/
