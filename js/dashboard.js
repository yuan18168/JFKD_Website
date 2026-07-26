/* dashboard.js — 總覽頁 */
(async function () {
  await requireGuard();

  const [students, rules, allRecords] = await Promise.all([
    listStudents(),
    getRules(),
    listExamRecords(null),
  ]);

  renderStudentNav(students, null);

  // ---- 每筆紀錄計算彙總 ----
  const enriched = allRecords.map((r) => {
    const result = calcExamRecord(r.subjects || [], rules);
    const total = typeof r.manualOverrideTotal === "number" ? r.manualOverrideTotal : result.total;
    return { ...r, result, total };
  });

  const totalBonus = sum(enriched.map((r) => r.total));
  const pendingPunishment = enriched.filter((r) => r.result.hasPunishment).length;

  const statCards = document.getElementById("statCards");
  statCards.innerHTML = [
    statCard("學生人數", students.length),
    statCard("累計紀錄數", enriched.length),
    statCard("累計獎金", fmtMoney(totalBonus)),
    statCard("待處理處罰", pendingPunishment, pendingPunishment > 0 ? "down" : ""),
  ].join("");

  // ---- 學生卡片 ----
  const studentCardsEl = document.getElementById("studentCards");
  if (!students.length) {
    studentCardsEl.innerHTML = `<div class="empty-state">尚未新增學生，請至「獎懲規則設定」新增第一位學生。</div>`;
  } else {
    studentCardsEl.innerHTML = students
      .map((s) => {
        const records = enriched.filter((r) => r.studentId === s.id);
        const total = sum(records.map((r) => r.total));
        const latest = records[0];
        return `
        <a class="card student-card" href="student.html?id=${s.id}">
          <div class="head">
            <div class="avatar" style="background:${s.color || "#4f7cff"}">${(s.name || "?").slice(0, 1)}</div>
            <div>
              <div class="name">${escapeHtml(s.name)}</div>
              <div class="meta">${records.length} 筆紀錄${latest ? " · 最近 " + latest.date : ""}</div>
            </div>
          </div>
          <div>
            <div class="text-faint" style="font-size:11px;">累計獎金</div>
            <div class="total">${fmtMoney(total)}</div>
          </div>
        </a>`;
      })
      .join("");
  }

  // ---- 最新紀錄表 ----
  const tbody = document.querySelector("#recentTable tbody");
  const recent = enriched.slice(0, 10);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="7" class="empty-state">還沒有任何紀錄</td></tr>`;
  } else {
    const studentMap = Object.fromEntries(students.map((s) => [s.id, s]));
    tbody.innerHTML = recent
      .map((r) => {
        const st = studentMap[r.studentId];
        return `<tr>
          <td>${r.date || "-"}</td>
          <td>${st ? escapeHtml(st.name) : "-"}</td>
          <td>${escapeHtml(r.semester || "-")}</td>
          <td>${escapeHtml(r.examType || "-")}</td>
          <td class="num">${r.result.avgScore}</td>
          <td class="num">${fmtMoney(r.total)}</td>
          <td>${r.result.hasPunishment ? '<span class="badge badge-penalty">需處罰</span>' : '<span class="badge badge-normal">正常</span>'}</td>
        </tr>`;
      })
      .join("");
  }

  function statCard(label, value, deltaClass) {
    return `<div class="card stat-card">
      <div class="label">${label}</div>
      <div class="value">${value}</div>
      ${deltaClass ? `<div class="delta ${deltaClass}">需留意</div>` : ""}
    </div>`;
  }
  function sum(arr) {
    return arr.reduce((a, b) => a + b, 0);
  }
})();
