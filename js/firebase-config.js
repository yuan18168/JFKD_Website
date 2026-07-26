/*
  ⚠️ 這個檔案需要您依照 README.md「步驟 4：設定 Firebase」填入自己的資訊，
  網站才能連上您自己的資料庫。填完之前，網站無法登入或讀寫資料。

  取得方式：Firebase 主控台 → 專案設定 → 一般 → 我的應用程式 → SDK 設定與程式碼
*/

// TODO: 貼上您在 Firebase 主控台取得的設定值
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};

// TODO: 填入允許登入本網站的家人 Google 帳號（Email）
// 這是「第一道防線」（介面提示用）；真正的安全防護在 Firebase 主控台的
// Firestore 安全規則（見 firestore.rules 及 README 步驟 5），兩邊都要設定。
const ALLOWED_EMAILS = [
  "yuan18168@gmail.com",
  // "your-wife@gmail.com",
];

// ---- 初始化（不需要修改以下內容）----
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
