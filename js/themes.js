/* themes.js — 學生主題造型：主題庫預覽 + 目前套用狀態總覽 */
(async function () {
  await requireGuard();

  const students = await listStudents();
  renderStudentNav(students, null);

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
      const nameColor = theme.id === "zoro" ? "#ffffff" : "#ffffff";
      const taglineColor = theme.id === "zoro" ? "#7dffb8" : "#ff8fa3";
      return `
      <div class="card theme-gallery-card">
        <div class="theme-preview-banner ${bannerClass}" style="background:${bannerBg}; border:${bannerBorder};">
          <div style="display:flex; align-items:center; gap:14px;">
            <div>${themeIconSvg(theme.id)}</div>
            <div>
              <div style="font-weight:800; font-size:16px; color:${nameColor};">${escapeHtml(theme.name)}</div>
              <div style="font-size:12px; color:${taglineColor};">${escapeHtml(theme.tagline)}</div>
            </div>
          </div>
        </div>
        <div class="theme-swatches">
          ${swatches.map((c) => `<span class="theme-swatch" style="background:${c};"></span>`).join("")}
        </div>
        <div class="text-faint" style="font-size:12px;">
          套用後會出現在該學生的學生紀錄頁最上方（橫幅＋配色＋圖標），僅此一頁換裝，不影響其他人。
        </div>
      </div>`;
    })
    .join("");

  const assignEl = document.getElementById("currentAssignments");
  if (!students.length) {
    assignEl.innerHTML = '<div class="empty-state">尚未新增學生，請至「學生名單」新增</div>';
    return;
  }
  assignEl.innerHTML = students
    .map((s) => {
      const theme = getStudentTheme(s.themeId);
      return `<div class="flex-between" style="padding:10px 0; border-bottom:1px solid var(--border);">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="width:20px;height:20px;border-radius:50%;background:${s.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#08122e;">${(s.name || "?").slice(0, 1)}</span>
          <span>${escapeHtml(s.name)}</span>
        </div>
        <span class="badge ${theme ? "badge-done" : "badge-normal"}">${theme ? escapeHtml(theme.name) : "無主題（標準樣式）"}</span>
      </div>`;
    })
    .join("");
  assignEl.innerHTML += `<div class="text-faint" style="font-size:12px; margin-top:10px;">想更換套用對象？請到「學生名單」調整。</div>`;
})();
