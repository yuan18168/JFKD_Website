/* pet-rules.js — 寵物說明（寵物設定）頁：純規則說明，8階段進化圖鑑 */
(async function () {
  await requireGuard();
  await applySiteFontScale();

  const students = await listStudents();
  renderStudentNav(students, null);

  const gallery = document.getElementById("petStageGallery");
  if (!gallery) return;

  gallery.innerHTML = `
    <div class="grid grid-cols-4" style="gap:12px;">
      ${PET_STAGES.map((s, i) => {
        const next = PET_STAGES[i + 1];
        const rangeText = next ? `${s.min} ~ ${next.min - 1}` : `${s.min}+（最高階）`;
        return `
        <div class="card" style="margin:0; text-align:center;">
          <div style="font-size:calc(40px * var(--font-scale, 1));">${s.emoji}</div>
          <div style="font-weight:700; margin-top:6px;">${s.label}</div>
          <div class="text-faint" style="font-size:calc(11px * var(--font-scale, 1)); margin-top:4px;">第 ${i + 1} 階</div>
          <div class="text-dim" style="font-size:calc(11px * var(--font-scale, 1)); margin-top:2px;">經驗值 ${rangeText}</div>
        </div>`;
      }).join("")}
    </div>`;
})();
