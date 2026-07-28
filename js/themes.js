/* themes.js — 學生主題造型：主題庫預覽 ＋ 上方頁籤切換每位學生自己的套用/標題設定
   （原本在「學生名單」頁的「專屬主題造型」下拉選單，已經搬到這裡統一管理） */
(async function () {
  await requireGuard();
  await applySiteFontScale();

  let students = await listStudents();
  renderStudentNav(students, null);

  let activeId = students[0] && students[0].id;

  renderGallery();
  renderTabs();
  renderEditor();

  // ---- 主題庫預覽（跟每位學生的設定無關，純展示所有可選主題）----
  function renderGallery() {
    const gallery = document.getElementById("themeGallery");
    gallery.innerHTML = Object.values(STUDENT_THEMES)
      .map((theme) => {
        const bannerClass = theme.bodyClass;
        const swatches =
          theme.id === "zoro"
            ? ["#04160d", "#0d3b24", "#00e676", "#ffd200", "#eafff2"]
            : ["#0c0c0e", "#3a0a10", "#ff1744", "#d8dbe2", "#ffffff"];
        const bannerBg =
          theme.id === "zoro"
            ? "linear-gradient(120deg,#04160d,#0d3b24 38%,#145c38 68%,#1f7a4d)"
            : "linear-gradient(120deg,#0c0c0e,#3a0a10 38%,#6e131f 68%,#8f1826)";
        const bannerBorder = theme.id === "zoro" ? "2px solid #00e676" : "2px solid #ff1744";
        const nameColor = "#ffffff";
        const taglineColor = theme.id === "zoro" ? "#7dffb8" : "#ff8fa3";
        return `
        <div class="card theme-gallery-card">
          <div class="theme-preview-banner ${bannerClass}" style="background:${bannerBg}; border:${bannerBorder};">
            <div style="display:flex; align-items:center; gap:14px;">
              <div>${themeIconSvg(theme.id)}</div>
              <div>
                <div style="font-weight:800; font-size:calc(16px * var(--font-scale, 1)); color:${nameColor};">${escapeHtml(theme.name)}</div>
                <div style="font-size:calc(12px * var(--font-scale, 1)); color:${taglineColor};">${escapeHtml(theme.tagline)}</div>
              </div>
            </div>
          </div>
          <div class="theme-swatches">
            ${swatches.map((c) => `<span class="theme-swatch" style="background:${c};"></span>`).join("")}
          </div>
          <div class="text-faint" style="font-size:calc(12px * var(--font-scale, 1));">
            套用後會出現在該學生的學生紀錄頁最上方（橫幅＋配色＋圖標），僅此一頁換裝，不影響其他人。
          </div>
        </div>`;
      })
      .join("");
  }

  // ---- 上方頁籤：一次只編輯一位學生 ----
  function renderTabs() {
    const el = document.getElementById("themeStudentTabs");
    if (!el) return;
    if (!students.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = students
      .map((s) => {
        const active = s.id === activeId ? "active" : "";
        const initial = (s.name || "?").slice(0, 1);
        return `<button type="button" class="student-tab ${active}" data-tab="${s.id}">
          <span class="dot" style="background:${s.color || "#4f7cff"};">${escapeHtml(initial)}</span>
          ${escapeHtml(s.name)}
        </button>`;
      })
      .join("");
    el.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === activeId) return;
        activeId = btn.dataset.tab;
        renderTabs();
        renderEditor();
      });
    });
  }

  // ---- 主題套用下拉選單 ＋ 大/小標題覆寫（只有套用主題時才能編輯）----
  function renderEditor() {
    const el = document.getElementById("themeEditor");
    if (!el) return;
    if (!students.length) {
      el.innerHTML = '<div class="card empty-state">尚未新增學生，請至「學生名單」新增</div>';
      return;
    }
    const student = students.find((s) => s.id === activeId) || students[0];
    activeId = student.id;
    const theme = getStudentTheme(student.themeId);
    const hasTheme = !!theme;
    const defaultTitle = hasTheme ? `${student.name} · ${theme.name}` : "";
    const defaultTagline = hasTheme ? theme.tagline : "";

    el.innerHTML = `
      <div class="card" style="max-width:560px;">
        <div style="margin-bottom:14px; max-width:320px;">
          <label>專屬主題造型</label>
          <select id="themeSelect">
            <option value="">無主題（標準樣式）</option>
            ${Object.values(STUDENT_THEMES)
              .map((t) => `<option value="${t.id}" ${student.themeId === t.id ? "selected" : ""}>${escapeHtml(t.name)}</option>`)
              .join("")}
          </select>
        </div>

        <div style="margin-bottom:10px;">
          <label>大標題${hasTheme ? "" : '　<span class="text-faint" style="font-weight:400;">（套用主題後才能編輯）</span>'}</label>
          <input type="text" id="bannerTitleInput" placeholder="${escapeHtml(defaultTitle || "請先套用主題")}" value="${escapeHtml(student.bannerTitle || "")}" ${hasTheme ? "" : "disabled"} />
        </div>
        <div style="margin-bottom:14px;">
          <label>小標題</label>
          <input type="text" id="bannerTaglineInput" placeholder="${escapeHtml(defaultTagline || "請先套用主題")}" value="${escapeHtml(student.bannerTagline || "")}" ${hasTheme ? "" : "disabled"} />
        </div>
        <button class="btn btn-primary btn-sm" id="saveBannerBtn" ${hasTheme ? "" : "disabled"}>儲存標題設定</button>
        ${
          hasTheme
            ? `<div class="text-faint" style="font-size:calc(12px * var(--font-scale, 1)); margin-top:8px;">留白代表使用預設文字：「${escapeHtml(defaultTitle)}」／「${escapeHtml(defaultTagline)}」</div>`
            : ""
        }
      </div>`;

    document.getElementById("themeSelect").addEventListener("change", async (e) => {
      const value = e.target.value;
      e.target.disabled = true;
      try {
        if (value) {
          await updateStudent(student.id, { themeId: value });
        } else {
          // 取消套用主題時，只清除 themeId，大/小標題覆寫文字保留在資料庫中不刪除，
          // 這樣之後選回原本的主題時，原本輸入的標題會自動復原，不會憑空消失。
          await updateStudent(student.id, {
            themeId: firebase.firestore.FieldValue.delete(),
          });
        }
        students = await listStudents();
        renderEditor();
      } catch (err) {
        alert("更新主題失敗：" + err.message);
        e.target.disabled = false;
      }
    });

    if (hasTheme) {
      document.getElementById("saveBannerBtn").addEventListener("click", async () => {
        const btn = document.getElementById("saveBannerBtn");
        const title = document.getElementById("bannerTitleInput").value.trim();
        const tagline = document.getElementById("bannerTaglineInput").value.trim();
        btn.disabled = true;
        try {
          await updateStudent(student.id, {
            bannerTitle: title ? title : firebase.firestore.FieldValue.delete(),
            bannerTagline: tagline ? tagline : firebase.firestore.FieldValue.delete(),
          });
          students = await listStudents();
          flashButtonSuccess(btn, "已儲存 ✓");
        } catch (err) {
          alert("儲存失敗：" + err.message);
        } finally {
          btn.disabled = false;
        }
      });
    }
  }
})();
