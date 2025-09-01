// src/firebaseConfig.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";

// ====================== Firebase プロジェクト設定 ======================
const firebaseConfig = {
  apiKey: "AIzaSyBfJmZNcy4NElw2LNfFqth9s0RwuzeGZ0Q",
  authDomain: "did-pwa-app.firebaseapp.com",
  projectId: "did-pwa-app",
  storageBucket: "did-pwa-app.firebasestorage.app",
  messagingSenderId: "319401095044",
  appId: "1:319401095044:web:2b872c070a455f7f1eb7d1",
  measurementId: "G-1YLSRVJ01F"
};

// ====================== Firebase 初期化 ======================
const app = initializeApp(firebaseConfig);

// Analytics はオプション（必要な場合のみ有効）
let analytics;
try {
  analytics = getAnalytics(app);
} catch (e) {
  console.warn("⚠️ Analytics の初期化に失敗:", e.message);
}

// Firestore など他サービスは app から取得可能
export { app };
