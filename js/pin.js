/* pin.js — 家長模式 PIN 閘門
   ------------------------------------------------------------------------
   在需要保護的頁面載入後呼叫 requireParentPin()，會蓋上一層全螢幕 PIN 輸入畫面，
   輸入正確才顯示頁面內容。通過後記在 sessionStorage，同一次瀏覽階段不會重複詢問
   （關掉瀏覽器分頁後就要重新輸入）。PIN 碼存在 config/settings.parentPin，預設 1234。
   ※ 這是「防止小朋友好奇亂改」等級的保護，不是資安防護；真正的存取控制仍由
     Firebase Auth 的家庭成員白名單負責（見 firestore.rules）。 */

const PARENT_SESSION_KEY = "jfkd_parent_ok";

function parentUnlocked() {
  return sessionStorage.getItem(PARENT_SESSION_KEY) === "1";
}

function lockParentMode() {
  sessionStorage.removeItem(PARENT_SESSION_KEY);
}

async function requireParentPin() {
  if (parentUnlocked()) return true;

  let pin = "1234";
  try { pin = await getParentPin(); } catch (e) { /* 讀不到就用預設值 */ }

  return new Promise((resolve) => {
    const gate = document.createElement("div");
    gate.className = "pin-gate";
    gate.innerHTML = `
      <div class="pin-gate-lock">🔒</div>
      <h2>家長模式</h2>
      <p>輸入 4 位數 PIN 碼才能進入<br>（可在「顯示設定」頁修改）</p>
      <div class="pin-dots">
        <div class="pin-dot"></div><div class="pin-dot"></div>
        <div class="pin-dot"></div><div class="pin-dot"></div>
      </div>
      <div class="pin-error" id="pinError"></div>
      <div class="pin-pad" id="pinPad"></div>
      <button class="pin-back" id="pinBack">← 回到孩子模式</button>`;
    document.body.appendChild(gate);

    const dots = gate.querySelectorAll(".pin-dot");
    const err = gate.querySelector("#pinError");
    let buf = "";

    const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "", "0", "⌫"];
    gate.querySelector("#pinPad").innerHTML = keys
      .map((k) => (k === "" ? '<button class="ghost" disabled></button>' : `<button data-k="${k}">${k}</button>`))
      .join("");

    function paint() {
      dots.forEach((d, i) => d.classList.toggle("filled", i < buf.length));
    }

    gate.querySelectorAll("[data-k]").forEach((b) =>
      b.addEventListener("click", () => {
        const k = b.dataset.k;
        err.textContent = "";
        if (k === "⌫") buf = buf.slice(0, -1);
        else if (buf.length < 4) buf += k;
        paint();
        if (buf.length === 4) {
          setTimeout(() => {
            if (buf === String(pin)) {
              sessionStorage.setItem(PARENT_SESSION_KEY, "1");
              gate.remove();
              resolve(true);
            } else {
              err.textContent = "PIN 碼錯誤，請再試一次";
              buf = "";
              paint();
            }
          }, 150);
        }
      }));

    // 實體鍵盤也能輸入
    function onKey(e) {
      if (/^[0-9]$/.test(e.key)) {
        err.textContent = "";
        if (buf.length < 4) { buf += e.key; paint(); }
        if (buf.length === 4) {
          setTimeout(() => {
            if (buf === String(pin)) {
              sessionStorage.setItem(PARENT_SESSION_KEY, "1");
              document.removeEventListener("keydown", onKey);
              gate.remove();
              resolve(true);
            } else { err.textContent = "PIN 碼錯誤，請再試一次"; buf = ""; paint(); }
          }, 150);
        }
      } else if (e.key === "Backspace") {
        buf = buf.slice(0, -1); paint();
      }
    }
    document.addEventListener("keydown", onKey);

    gate.querySelector("#pinBack").addEventListener("click", () => {
      window.location.href = "app.html";
    });
  });
}
