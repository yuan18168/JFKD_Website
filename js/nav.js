/* nav.js — 側邊欄「學生」清單渲染（共用於各頁） */
function renderStudentNav(students, activeStudentId) {
  const el = document.getElementById("studentNavLinks");
  if (!el) return;
  if (!students.length) {
    el.innerHTML = '<div class="text-faint" style="padding:8px 12px;font-size:calc(12px * var(--font-scale, 1));">尚未新增學生，請至「獎懲規則設定」新增</div>';
    return;
  }
  el.innerHTML = students
    .map((s) => {
      const active = s.id === activeStudentId ? "active" : "";
      const initial = (s.name || "?").slice(0, 1);
      return `<a href="student.html?id=${s.id}" class="nav-link ${active}">
        <span style="width:18px;height:18px;border-radius:50%;background:${s.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:calc(10px * var(--font-scale, 1));font-weight:700;color:#08122e;">${initial}</span>
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

// ------------------------------------------------------------------
// 成長寵物：四個階段，依「成長值」（=累計獎金＋每日任務累積的成長值，見 data.js）決定目前階段。
// 純粹用 emoji 呈現（原創、非任何品牌角色），避免版權疑慮，也跟全站既有的 emoji 風格一致。
const PET_STAGES = [
  { min: 0, emoji: "🥚", label: "蛋" },
  { min: 500, emoji: "🐣", label: "破殼幼體" },
  { min: 2000, emoji: "🐥", label: "成長期" },
  { min: 5000, emoji: "🦜", label: "華麗進化型" },
];
function petStageForGrowth(growthValue) {
  let stage = PET_STAGES[0];
  let index = 0;
  PET_STAGES.forEach((s, i) => {
    if (growthValue >= s.min) {
      stage = s;
      index = i;
    }
  });
  const next = PET_STAGES[index + 1] || null;
  return { ...stage, index, next };
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

/* ---------- 許願池共用小工具（學生名單頁 + 學生紀錄頁都會用到）---------- */
// 願望項目合計金額（自付＋父母加碼＋其他人加碼）；相容舊資料的單一 amount 欄位
function wishlistItemTotal(item) {
  if (typeof item.amountSelf === "number" || typeof item.amountParent === "number" || typeof item.amountOther === "number") {
    return (item.amountSelf || 0) + (item.amountParent || 0) + (item.amountOther || 0);
  }
  return item.amount || 0;
}

// 達成狀態文字（"progress"｜"achieved"｜"notAchieved"，缺欄位一律視為 "progress"）
function wishlistStatusLabel(status) {
  if (status === "achieved") return "達成";
  if (status === "notAchieved") return "未達成";
  return "進行中";
}

// 「其他人加碼」徽章：支援多位出資者（item.otherContributors: [{name, amount}]），
// 有明細就列出每位出資者姓名＋金額；相容舊資料（只有單一 amountOther 數字、沒有明細）時退回原本的單一數字顯示。
function otherContributorsBadgeHtml(item) {
  const list = Array.isArray(item.otherContributors) ? item.otherContributors.filter((c) => c && c.amount > 0) : [];
  if (list.length) {
    const total = list.reduce((s, c) => s + (c.amount || 0), 0);
    const detail = list.map((c) => `${escapeHtml(c.name || "其他人")} ${fmtMoney(c.amount)}`).join("、");
    return `<span class="badge badge-normal">其他人加碼 ${fmtMoney(total)}（${detail}）</span>`;
  }
  if (item.amountOther > 0) {
    return `<span class="badge badge-normal">其他人加碼 ${fmtMoney(item.amountOther)}</span>`;
  }
  return "";
}

/* ---------- 拖曳排序共用工具（許願池用；Trello 風格：拖到哪張卡就插進哪，其餘自動往後推）---------- */
// containerEl：卡片們共同的父層容器（例如 .wishlist-grid）
// cardSelector：每張可拖曳卡片的 CSS class（例如 ".wishlist-card"），卡片本身需加上 draggable="true" 與 data-drag-id="項目id"
// onReorder(newIdOrder)：使用者放開滑鼠、順序確定改變後才會呼叫，帶入新的 id 順序陣列，由呼叫端自行寫回 Firestore
function attachDragReorder(containerEl, cardSelector, onReorder) {
  if (!containerEl) return;
  let draggedEl = null;

  containerEl.querySelectorAll(cardSelector).forEach((card) => {
    card.addEventListener("dragstart", (e) => {
      draggedEl = card;
      card.classList.add("dragging");
      e.dataTransfer.effectAllowed = "move";
      try {
        e.dataTransfer.setData("text/plain", card.dataset.dragId || "");
      } catch (err) {
        /* 部分瀏覽器對 setData 較嚴格，失敗也不影響拖曳排序本身 */
      }
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("dragging");
      containerEl.querySelectorAll(cardSelector).forEach((c) => c.classList.remove("drag-over"));
      draggedEl = null;
    });
    card.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!draggedEl || draggedEl === card) return;
      e.dataTransfer.dropEffect = "move";
      card.classList.add("drag-over");
    });
    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });
    card.addEventListener("drop", (e) => {
      e.preventDefault();
      card.classList.remove("drag-over");
      if (!draggedEl || draggedEl === card) return;
      // 依放開滑鼠時位在目標卡片的左半邊或右半邊，決定插入到目標「之前」還是「之後」
      const rect = card.getBoundingClientRect();
      const insertAfter = e.clientX - rect.left > rect.width / 2;
      if (insertAfter) {
        card.after(draggedEl);
      } else {
        card.before(draggedEl);
      }
      const newOrder = Array.from(containerEl.querySelectorAll(cardSelector)).map((c) => c.dataset.dragId);
      if (typeof onReorder === "function") onReorder(newOrder);
    });
  });
}

/* ---------- 自訂日期輸入彈窗（共用，取代原生 prompt()）---------- */
// 原生 prompt() 在部分自動化/嵌入環境會卡住整個頁面，且視覺風格跟全站不一致，
// 所以跟 confirmDialog 一樣，改用自訂彈窗＋<input type="date">。
// 回傳 Promise<string|null>：使用者按下確定 -> "YYYY-MM-DD"，取消／按 Esc／點背景 -> null。
function promptDateDialog(message, defaultValue, opts = {}) {
  const { title = "請輸入日期", confirmText = "確定", cancelText = "取消" } = opts;
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-card">
        <div class="confirm-title"></div>
        <div class="confirm-message"></div>
        <input type="date" class="confirm-date-input" style="width:100%; margin-top:10px;" />
        <div class="confirm-actions">
          <button class="btn" data-act="cancel"></button>
          <button class="btn btn-primary" data-act="ok"></button>
        </div>
      </div>`;
    overlay.querySelector(".confirm-title").textContent = title;
    overlay.querySelector(".confirm-message").textContent = message;
    overlay.querySelector('[data-act="cancel"]').textContent = cancelText;
    overlay.querySelector('[data-act="ok"]').textContent = confirmText;
    const dateInput = overlay.querySelector(".confirm-date-input");
    dateInput.value = defaultValue || new Date().toISOString().slice(0, 10);
    document.body.appendChild(overlay);

    function cleanup(result) {
      overlay.remove();
      document.removeEventListener("keydown", onKey);
      resolve(result);
    }
    function onKey(e) {
      if (e.key === "Escape") cleanup(null);
      if (e.key === "Enter") cleanup(dateInput.value || defaultValue);
    }
    document.addEventListener("keydown", onKey);
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) cleanup(null);
    });
    overlay.querySelector('[data-act="cancel"]').addEventListener("click", () => cleanup(null));
    overlay.querySelector('[data-act="ok"]').addEventListener("click", () => cleanup(dateInput.value || defaultValue));
    dateInput.focus();
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

/* ---------- 全站字體大小（顯示設定頁的「整體設定」，單一全域設定，不分學生）----------
   小/中/大/特大四級，「中」＝目前既有的字體大小，其餘三級依此比例縮放。
   套用方式：把對應的級別字串寫到 <body data-font-scale="..">，CSS 端已把絕大多數
   font-size 改成 calc(基準px * var(--font-scale, 1))，只要切換這個屬性全站文字
   就會同步縮放；圖表（Chart.js 用 canvas 畫的軸標/點位數字，不是 CSS）則另外
   透過 chartFontSizePx() 讀同一個縮放比例換算成實際像素值。 */
const FONT_SCALE_FACTORS = { sm: 0.875, md: 1, lg: 1.15, xl: 1.3 };
const FONT_SCALE_LABELS = { sm: "小", md: "中", lg: "大", xl: "特大" };

async function applySiteFontScale() {
  let scale = "md";
  try {
    scale = await getSiteFontScale();
  } catch (err) {
    /* 讀取失敗就先用「中」，不要讓整頁掛掉 */
  }
  document.body.dataset.fontScale = scale;
  window.SITE_FONT_SCALE = scale;
  window.SITE_FONT_SCALE_FACTOR = FONT_SCALE_FACTORS[scale] || 1;
  return scale;
}

/* ---------- 圖表顯示設定共用工具（Y軸/X筆數/點位標籤全域預設 + 每位學生可覆寫；
   字體大小已改由上面的全站設定統一控制，圖表數字跟著同一個比例縮放）---------- */
function chartFontSizePx() {
  const factor = window.SITE_FONT_SCALE_FACTOR || 1;
  return Math.round(12 * factor);
}

// 一律顯示分數的自訂 Chart.js 外掛（平常靠 tooltip 顯示，開啟此設定才會把數字直接畫在點位旁邊）
// 統一畫在點的正上方；圖表建立時會依字體大小預留頂端留白（見 layout.padding.top），
// 所以就算是最高分（例如剛好 100 分）的點，數字也不會被裁切或蓋到 UI。
// 水平方向仍會自動避開左右邊界，避免疊到 Y 軸文字或被裁切。
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

          // 垂直：一律畫在點的正上方（圖表已預留足夠頂端空間，不會被裁切）
          const y = point.y - 8;

          ctx.textAlign = align;
          ctx.fillText(text, x, y);
        });
      });
      ctx.restore();
    },
  });
}
