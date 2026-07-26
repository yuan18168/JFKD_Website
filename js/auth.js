/*
  auth.js — 共用登入邏輯
  - login.html 用 requireLogin=false 呼叫 initAuth，只負責觸發 Google 登入
  - 其他頁面用 requireGuard() 保護：未登入或不在白名單 → 導回 login.html
*/

const googleProvider = new firebase.auth.GoogleAuthProvider();

function signInWithGoogle() {
  return auth.signInWithPopup(googleProvider);
}

function signOutUser() {
  return auth.signOut().then(() => {
    window.location.href = "login.html";
  });
}

function isAllowedEmail(email) {
  if (!email) return false;
  return ALLOWED_EMAILS.map((e) => e.toLowerCase()).includes(email.toLowerCase());
}

/**
 * 保護一般頁面：確認使用者已登入且在白名單內。
 * 回傳一個 Promise，resolve 後帶入 user 物件，可用來渲染側邊欄使用者資訊。
 */
function requireGuard() {
  return new Promise((resolve, reject) => {
    auth.onAuthStateChanged((user) => {
      if (!user) {
        window.location.href = "login.html";
        reject(new Error("未登入"));
        return;
      }
      if (!isAllowedEmail(user.email)) {
        auth.signOut().then(() => {
          window.location.href = "login.html?denied=1";
        });
        reject(new Error("不在白名單"));
        return;
      }
      renderSidebarUser(user);
      resolve(user);
    });
  });
}

function renderSidebarUser(user) {
  const nameEl = document.getElementById("sidebarUserEmail");
  const imgEl = document.getElementById("sidebarUserAvatar");
  if (nameEl) nameEl.textContent = user.email;
  if (imgEl && user.photoURL) imgEl.src = user.photoURL;
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) logoutBtn.addEventListener("click", signOutUser);
}
