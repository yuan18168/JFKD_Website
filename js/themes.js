/* themes.js — 學生主題造型：主題庫預覽 ＋ 上方頁籤切換每位學生自己的套用/標題設定
   （原本在「學生名單」頁的「專屬主題造型」下拉選單，已經搬到這裡統一管理） */
(async function () {
  await requireGuard();
  await requireParentPin();
  await applySiteFontScale();

  let students = await listStudents();
  renderStudentNav(students, null);

  let activeId = students[0] && students[0].id;

  // Character catalog is shared with the child interface.
  function renderGallery() {
    const gallery = document.getElementById("themeGallery");
    gallery.innerHTML = Object.values(STUDENT_THEMES)
      .map((theme) => {
        const bannerClass = theme.bodyClass;
        const style = {swatches:[theme.color,theme.bg,"#fff"]};
        const { swatches, bannerBg, bannerBorder, taglineColor } = style;
        const nameColor = "#ffffff";
        return `
        <div class="card theme-gallery-card">
          ${JDesign.themeArt(theme.id)}
          <div class="theme-preview-info"><h3>${escapeHtml(JDesign.worlds[theme.id]?.label || theme.name)}</h3><p>${escapeHtml(JDesign.worlds[theme.id].description)}</p></div>
          <div class="theme-swatches">
            ${swatches.map((c) => `<span class="theme-swatch" style="background:${c};"></span>`).join("")}
          </div>
          <div class="text-faint" style="font-size:calc(12px * var(--font-scale, 1));">
            ${theme.character} · ${theme.xp.toLocaleString()} XP
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
    const defaultTitle = hasTheme ? JDesign.worlds[theme.id].label : "";
    const defaultTagline = hasTheme ? JDesign.worlds[theme.id].description : "";

    el.innerHTML = `
      <div class="card" style="max-width:560px;">
        <div style="margin-bottom:14px; max-width:320px;">
          <label>專屬主題造型</label>
          <select id="themeSelect">
            <option value="">無主題（標準樣式）</option>
            ${Object.values(STUDENT_THEMES)
              .map((t) => {
                const need = THEME_XP[t.id] || 0;
                const tag = need > 0 ? `（需 ${need.toLocaleString()} XP）` : "";
                return `<option value="${t.id}" ${student.themeId === t.id ? "selected" : ""}>${escapeHtml(t.name)}${tag}</option>`;
              })
              .join("")}
          </select>
          <div class="text-faint" style="font-size:calc(11.5px * var(--font-scale, 1)); margin-top:6px; line-height:1.7;">
            括號內是孩子在「孩子模式 → 造型」自行解鎖所需的 XP 門檻。<br>
            家長在這裡可以<b>直接指定</b>任何主題，不受門檻限制。
          </div>
        </div>

        <div class="text-faint" style="margin-top:14px;line-height:1.8;">
          首頁標題與場景介紹會跟隨目前主題自動切換。每款主題另有 6 句專屬鼓勵語，重新整理或切換主題時會換一句；打卡時保持不變。
        </div>
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


  }

  // 【2026-07-31 修正】renderGallery/renderTabs/renderEditor 都要等 THEME_PREVIEW_STYLE
  // 這個 const 已經宣告完才能呼叫，所以移到檔案最後（原本放在檔案開頭會踩到 TDZ，
  // 讓整頁一載入就 ReferenceError 崩潰，導致主題造型頁完全打不開）。
  renderGallery();
  renderTabs();
  renderEditor();
})();
