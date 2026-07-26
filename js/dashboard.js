/* dashboard.js — 總覽頁 */
(async function () {
  await requireGuard();

  const [students, profiles, settings] = await Promise.all([listStudents(), listRuleProfiles(), getSettings()]);
  const defaultProfileId = settings.defaultProfileId || profiles[0]?.id || null;

  renderStudentNav(students, null);

  // 每位學生各自抓一次紀錄（listExamRecords 會依學制順序排新到舊)，
  // 避免把不同學生、不同年級的紀錄混在一起排序造成「最新」失真。
  const perStudentRecords = await Promise.all(students.map((s) => listExamRecords(s.id)));

  // 每一筆紀錄都用「當初套用的設定檔」計算，新增/切換設定檔不會動到舊紀錄的結果。
  const enrichedByStudent = perStudentRecords.map((records) =>
    records.map((r) => {
      const result = calcExamRecord(r.subjects || [], pickRulesForRecord(r, profiles, defaultProfileId));
      return { ...r, result, total: result.total };
    })
  );
  const allEnriched = enrichedByStudent.flat();

  const totalBonus = sum(allEnriched.map((r) => r.total));
  const pendingPunishment = allEnriched.filter((r) => r.result.hasPunishment && r.punishmentStatus !== "done").length;

  const statCards = document.getElementById("statCards");
  statCards.innerHTML = [
    statCard("學生人數", students.length),
    statCard("累計紀錄數", allEnriched.length),
    statCard("累計獎金", fmtMoney(totalBonus)),
    statCard("待處理處罰", pendingPunishment, pendingPunishment > 0 ? "down" : ""),
  ].join("");

  renderStudentCards();
  renderRecentByStudent();

  // ---- 學生卡片（含每人一張小型平均趨勢圖）----
  function renderStudentCards() {
    const el = document.getElementById("studentCards");
    if (!students.length) {
      el.innerHTML = `<div class="empty-state">尚未新增學生，請至「學生名單」新增第一位學生。</div>`;
      return;
    }
    el.innerHTML = students
      .map((s, i) => {
        const records = enrichedByStudent[i];
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
          <div style="height:70px;">
            <canvas data-avg-chart="${s.id}"></canvas>
          </div>
        </a>`;
      })
      .join("");

    students.forEach((s, i) => {
      const canvas = el.querySelector(`canvas[data-avg-chart="${s.id}"]`);
      if (!canvas) return;
      const ordered = [...enrichedByStudent[i]].reverse(); // 舊到新
      if (!ordered.length) return;
      const labels = ordered.map((r) => `${r.semester || ""} ${r.examType || ""}`.trim() || r.date || "");
      const avgScores = ordered.map((r) => (typeof r.result?.avgScore === "number" ? r.result.avgScore : null));
      new Chart(canvas, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              data: avgScores,
              borderColor: "#e7ecf7",
              backgroundColor: "#e7ecf722",
              fill: true,
              tension: 0.3,
              spanGaps: true,
              pointRadius: 2,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false }, tooltip: { enabled: true } },
          scales: {
            y: { display: false },
            x: { display: false },
          },
        },
      });
    });
  }

  // 依學期文字（例如「四下」「國一上」「高三下」）判斷屬於哪個學制
  function schoolLevelLabel(semesterText) {
    const s = (semesterText || "").trim();
    if (s.startsWith("國")) return "國中";
    if (s.startsWith("高")) return "高中";
    return s ? "國小" : "-";
  }

  function punishmentBadge(r) {
    if (!r.result.hasPunishment) return '<span class="badge badge-normal">不需處罰</span>';
    return r.punishmentStatus === "done"
      ? '<span class="badge badge-done">已執行處罰</span>'
      : '<span class="badge badge-penalty">尚未執行處罰</span>';
  }

  function bonusBadge(r) {
    if (!(r.total > 0)) return '<span class="badge badge-normal">無獎金</span>';
    return r.bonusStatus === "done"
      ? '<span class="badge badge-done">已發放獎金</span>'
      : '<span class="badge badge-warn">尚未發放獎金</span>';
  }

  // ---- 最新紀錄：每位學生各顯示自己最後一筆，欄位與各學生頁的歷史紀錄表一致（不含編輯/刪除）----
  function renderRecentByStudent() {
    const container = document.getElementById("recentByStudent");
    if (!students.length) {
      container.innerHTML = `<div class="empty-state">還沒有任何學生</div>`;
      return;
    }
    container.innerHTML = students
      .map((s, i) => {
        const latest = enrichedByStudent[i][0];
        const rowHtml = latest
          ? `<tr>
              <td>${latest.date || "-"}</td>
              <td>${schoolLevelLabel(latest.semester)}</td>
              <td>${escapeHtml(latest.semester || "-")}</td>
              <td>${escapeHtml(latest.examType || "-")}</td>
              <td class="text-dim">${(latest.subjects || []).map((sub) => `${escapeHtml(sub.name)} ${sub.score}分`).join("、")}</td>
              <td class="num">${latest.result.avgScore}</td>
              <td class="num">${fmtMoney(latest.total)}</td>
              <td>${punishmentBadge(latest)}</td>
              <td>${bonusBadge(latest)}</td>
            </tr>`
          : `<tr><td colspan="9" class="empty-state">還沒有任何紀錄</td></tr>`;
        return `
        <div class="card" style="padding:0; overflow:hidden; margin-bottom:14px;">
          <div style="padding:14px 16px 0; display:flex; align-items:center; gap:8px;">
            <span style="width:20px;height:20px;border-radius:50%;background:${s.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#08122e;">${(s.name || "?").slice(0, 1)}</span>
            <span style="font-weight:700; font-size:13px;">${escapeHtml(s.name)}</span>
          </div>
          <table>
            <thead>
              <tr>
                <th>日期</th><th>學制</th><th>學期</th><th>考試</th><th>科目明細</th>
                <th class="num">平均分</th><th class="num">總獎金</th><th>處罰狀態</th><th>獎金狀態</th>
              </tr>
            </thead>
            <tbody>${rowHtml}</tbody>
          </table>
        </div>`;
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
