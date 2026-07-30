/* rules.js — 遊戲規則說明頁：所有數字都直接從 gamify.js / data.js 的常數產生，
   規則調整時這頁會自動同步，不會出現「說明與實作不一致」的情況。 */
(async function () {
  await requireGuard();
  await requireParentPin();
  await applySiteFontScale();

  const students = await listStudents();
  renderStudentNav(students, null);

  // ---- 常數同步 ----
  document.getElementById("perfectXp").textContent = PERFECT_DAY_XP;
  document.getElementById("shieldEvery").textContent = SHIELD_EVERY;
  document.getElementById("shieldMax").textContent = SHIELD_MAX;
  document.getElementById("badgeCount").textContent = BADGES.length;

  // ---- 等級表 ----
  const levelRows = [1, 5, 10, 15, 20, 25, 30, 40, 50, 60]
    .map((lv) => {
      const info = levelInfo(cumulativeXpForLevel(lv));
      return `<tr><td>Lv.${lv}</td><td>${info.title}</td><td class="num">${cumulativeXpForLevel(lv).toLocaleString()} XP</td></tr>`;
    })
    .join("");
  document.getElementById("levelTable").innerHTML = `
    <div class="card" style="padding:0; overflow:hidden; margin:0;">
      <div class="table-wrap"><table>
        <thead><tr><th>等級</th><th>稱號</th><th class="num">累計需要</th></tr></thead>
        <tbody>${levelRows}</tbody>
      </table></div>
    </div>`;

  // ---- 連續打卡里程碑 ----
  const msRows = Object.keys(STREAK_MILESTONES)
    .map(Number)
    .sort((a, b) => a - b)
    .map((d) => `<tr><td>連續 ${d} 天</td><td class="num">+${STREAK_MILESTONES[d]} XP</td></tr>`)
    .join("");
  document.getElementById("milestoneTable").innerHTML = `
    <div class="card" style="padding:0; overflow:hidden; margin:0;">
      <div class="table-wrap"><table>
        <thead><tr><th>達成條件</th><th class="num">額外獎勵</th></tr></thead>
        <tbody>${msRows}</tbody>
      </table></div>
    </div>`;

  // ---- 稀有度統計 ----
  const RC = { 1: "#9AA3B2", 2: "#3FA9F5", 3: "#A855F7", 4: "#FFA51F" };
  document.getElementById("raritySummary").innerHTML =
    `<div style="display:flex; gap:10px; flex-wrap:wrap;">` +
    [4, 3, 2, 1]
      .map((r) => {
        const n = BADGES.filter((b) => b.r === r).length;
        return `<span class="badge" style="border-color:${RC[r]}; color:${RC[r]};">
          ${"★".repeat(r)} ${RARITY_NAME[r]} ${n} 個</span>`;
      })
      .join("") + `</div>`;

  // ---- 完整徽章清單 ----
  const groupHtml = BADGE_GROUPS.map((g) => {
    const list = BADGES.filter((b) => b.g === g.key).sort((a, b) => b.r - a.r);
    const rows = list
      .map(
        (b) => `<tr>
          <td style="width:44px; font-size:calc(20px * var(--font-scale,1));">${b.hidden ? "❓" : b.i}</td>
          <td><b>${b.hidden ? "（隱藏）" + escapeHtml(b.n) : escapeHtml(b.n)}</b></td>
          <td><span style="color:${RC[b.r]}; font-weight:700; white-space:nowrap;">${"★".repeat(b.r)} ${RARITY_NAME[b.r]}</span></td>
          <td>${escapeHtml(b.d)}</td>
        </tr>`
      )
      .join("");
    return `
      <div class="section-title">${g.label}（${list.length} 個）</div>
      <div class="card" style="padding:0; overflow:hidden; margin:0 0 14px;">
        <div class="table-wrap"><table>
          <thead><tr><th></th><th>名稱</th><th>稀有度</th><th>解鎖條件</th></tr></thead>
          <tbody>${rows}</tbody>
        </table></div>
      </div>`;
  }).join("");
  document.getElementById("badgeList").innerHTML = groupHtml;

  // ---- 主題解鎖門檻 ----
  const themeRows = ["", "zoro", "babymonster", "galaxy", "lava", "aurora", "gold"]
    .map((id) => {
      const t = id ? getStudentTheme(id) : { name: "預設主題", tagline: "乾淨清爽的預設配色" };
      if (!t) return "";
      const need = THEME_XP[id] || 0;
      return `<tr>
        <td><b>${escapeHtml(t.name)}</b></td>
        <td>${escapeHtml(t.tagline || "")}</td>
        <td class="num">${need === 0 ? "免費" : need.toLocaleString() + " XP"}</td>
      </tr>`;
    })
    .join("");
  document.getElementById("themeTable").innerHTML = `
    <div class="card" style="padding:0; overflow:hidden; margin:0;">
      <div class="table-wrap"><table>
        <thead><tr><th>主題</th><th>說明</th><th class="num">解鎖門檻</th></tr></thead>
        <tbody>${themeRows}</tbody>
      </table></div>
    </div>`;
})();
