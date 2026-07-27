/* nav.js — 側邊欄「學生」清單渲染（共用於各頁） */
function renderStudentNav(students, activeStudentId) {
  const el = document.getElementById("studentNavLinks");
  if (!el) return;
  if (!students.length) {
    el.innerHTML = '<div class="text-faint" style="padding:8px 12px;font-size:12px;">尚未新增學生，請至「獎懲規則設定」新增</div>';
    return;
  }
  el.innerHTML = students
    .map((s) => {
      const active = s.id === activeStudentId ? "active" : "";
      const initial = (s.name || "?").slice(0, 1);
      return `<a href="student.html?id=${s.id}" class="nav-link ${active}">
        <span style="width:18px;height:18px;border-radius:50%;background:${s.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#08122e;">${initial}</span>
        ${escapeHtml(s.name)}
      </a>`;
    })
    .join("");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

function fmtMoney(n) {
  return "NT$" + Math.round(n || 0).toLocaleString("zh-Hant-TW");
}

/* ---------- 自訂確認彈窗（共用，取代原生 confirm()）---------- */
// 回傳 Promise<boolean>：使用者按下確定 -> true，取消／按 Esc／點背景 -> false。
// 訊息一律用 textContent 塞入，不解析 HTML，避免學生名稱等內容被當成標籤。
function confirmDialog(message, opts = {}) {
  const { title = "請確認", confirmText = "確定", cancelText = "取消", danger = true } = opts;
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-card">
        <div class="confirm-title"></div>
        <div class="confirm-message"></div>
        <div class="confirm-actions">
          <button class="btn" data-act="cancel"></button>
          <button class="btn ${danger ? "btn-danger-solid" : "btn-primary"}" data-act="ok"></button>
        </div>
      </div>`;
    overlay.querySelector(".confirm-title").textContent = title;
    overlay.querySelector(".confirm-message").textContent = message;
    overlay.querySelector('[data-act="cancel"]').textContent = cancelText;
    overlay.querySelector('[data-act="ok"]').textContent = confirmText;
    document.body.appendChild(overlay);

    function cleanup(result) {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === "Escape") cleanup(false);
      if (e.key === "Enter") cleanup(true);
    }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cleanup(false);
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener("click", () => cleanup(false));
    overlay.querySelector('[data-act="ok"]').addEventListener("click", () => cleanup(true));
    overlay.querySelector('[data-act="ok"]').focus();
  });
}

/* ---------- 輕量提示 Toast（共用）---------- */
// 用於沒有慶祝動畫、但仍需要讓使用者知道「動作完成了」的場合（例如編輯紀錄、一般儲存）
function showToast(text) {
  const el = document.createElement("div");
  el.className = "toast-msg";
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1500);
}

/* ---------- 新增紀錄有進步／有獎金時的慶祝動畫（共用）---------- */
// 灑一點彩帶＋一張置中訊息卡，讓小孩看到自己進步/拿到獎金時更有成就感，
// 純視覺效果，不影響任何資料，animation 結束後呼叫端會自行接著做（例如重新整理頁面）。
function celebrate(bigText, subText) {
  const overlay = document.createElement("div");
  overlay.className = "celebrate-overlay";
  const colors = ["#ffd54a", "#4fd1c5", "#63b3ff", "#34d399", "#ff8fa3", "#ffffff"];
  let confettiHtml = "";
  for (let i = 0; i < 46; i++) {
    const left = Math.random() * 100;
    const delay = (Math.random() * 0.5).toFixed(2);
    const duration = (1.3 + Math.random() * 0.9).toFixed(2);
    const color = colors[i % colors.length];
    const rotate = Math.round(Math.random() * 360);
    const size = 6 + Math.round(Math.random() * 5);
    confettiHtml += `<div class="confetti-piece" style="left:${left}%; width:${size}px; height:${size * 1.6}px; background:${color}; animation-duration:${duration}s; animation-delay:${delay}s; transform:rotate(${rotate}deg);"></div>`;
  }
  overlay.innerHTML = `
    ${confettiHtml}
    <div class="celebrate-card">
      <div class="big">${bigText}</div>
      ${subText ? `<div class="sub">${subText}</div>` : ""}
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 2100);
}

/* ---------- 儲存成功的按鈕視覺回饋（共用）---------- */
// 按下儲存後暫時把按鈕文字換成「已儲存 ✓」並套用綠色高亮，過一下自動還原，
// 讓使用者確定「有存到」而不是靜悄悄地毫無反應。
function flashButtonSuccess(btn, text) {
  if (!btn) return;
  if (btn.dataset.flashOriginal === undefined) {
    btn.dataset.flashOriginal = btn.textContent;
  }
  clearTimeout(btn._flashTimer);
  btn.textContent = text || "已儲存 ✓";
  btn.classList.add("btn-flash-success");
  btn._flashTimer = setTimeout(() => {
    btn.textContent = btn.dataset.flashOriginal;
    btn.classList.remove("btn-flash-success");
  }, 1600);
}

/* ---------- 圖表顯示設定共用工具（全域預設 + 每位學生可覆寫）---------- */
function chartFontSizePx(fontSize) {
  return { sm: 10, md: 12, lg: 15 }[fontSize] || 12;
}

// 一律顯示分數的自訂 Chart.js 外掛（平常靠 tooltip 顯示，開啟此設定才會把數字直接畫在點位旁邊）
// 會依點位所在位置自動避開邊界：太靠左/右會改成靠左/靠右對齊（避免疊到 Y 軸文字或被裁切），
// 太靠近圖表頂端（例如剛好 100 分）會改畫在點的下方，避免數字被裁掉一半。
if (typeof Chart !== "undefined") {
  Chart.register({
    id: "jfkdPointLabels",
    afterDatasetsDraw(chart) {
      const opts = chart.config._jfkdPointLabelOpts;
      if (!opts || !opts.enabled) return;
      const { ctx, chartArea } = chart;
      const fontSize = opts.fontSize || 11;
      ctx.save();
      ctx.font = `700 ${fontSize}px ${getComputedStyle(document.body).fontFamily}`;
      ctx.fillStyle = opts.color || "#e7ecf7";
      chart.data.datasets.forEach((dataset, i) => {
        const meta = chart.getDatasetMeta(i);
        if (meta.hidden) return;
        meta.data.forEach((point, index) => {
          const value = dataset.data[index];
          if (value === null || value === undefined) return;
          const text = String(value);
          const textWidth = ctx.measureText(text).width;

          // 水平：預設置中；超出圖表左右邊界就改靠左/靠右對齊，貼齊邊界內側
          let x = point.x;
          let align = "center";
          if (chartArea) {
            if (point.x - textWidth / 2 < chartArea.left) {
              align = "left";
              x = chartArea.left + 1;
            } else if (point.x + textWidth / 2 > chartArea.right) {
              align = "right";
              x = chartArea.right - 1;
            }
          }

          // 垂直：預設畫在點的上方；太靠近圖表頂端（會被裁切）就改畫在點的下方
          let y = point.y - 8;
          if (chartArea && y - fontSize < chartArea.top) {
            y = point.y + fontSize + 4;
          }

          ctx.textAlign = align;
          ctx.fillText(text, x, y);
        });
      });
      ctx.restore();
    },
  });
}
