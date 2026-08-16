/* violations.js — 結算記錄
   【2026-08-16 改版】從「一份單筆登記清單 ＋ 一份週結算清單並列」改成以「週」為主軸：
     1. 需要你處理  — 跨學生的行動清單（待執行處罰、待發放獎金），有事才出現
     2. 本週進行中  — 還沒結算的即時淨值
     3. 已結算週次  — 一週一張卡片，展開可看這一週實際被算進淨值的每一筆原始資料
*/
(async function () {
  await requireGuard();
  await requireParentPin();
  await applySiteFontScale();

  let students = await listStudents();
  renderStudentNav(students, null);
  const wrap = document.getElementById("violationsBody");
  if (!students.length) {
    wrap.innerHTML = '<div class="empty-state">尚未新增學生，請至「學生名單」新增</div>';
    return;
  }

  const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;
  let activeStudentId = students[0].id;

  const findStudent = (id) => students.find((s) => s.id === id);
  const replaceStudent = (u) => { students = students.map((s) => (s.id === u.id ? u : s)); };
  const initialOf = (n) => (n || "?").slice(0, 1);
  const monthKey = (ms) => { const d = new Date(ms); return d.getFullYear() + "年" + (d.getMonth() + 1) + "月"; };
  function shortInstant(str) {
    if (!str) return "最早以前";
    const m = /^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}:\d{2})$/.exec(str);
    return m ? Number(m[2]) + "/" + Number(m[3]) + " " + m[4] : str;
  }
  const fmtJacks = (n) => { const v = Number(n) || 0; return (v > 0 ? "+" : "") + v + " 下"; };

  function pendingBoardHtml() {
    const all = [];
    students.forEach((s) => pendingActionsOf(s).forEach((a) => all.push(a)));
    if (!all.length) return '<div class="settle-clear">✅ 目前沒有待處理的事項</div>';
    const order = { punishment: 0, violation: 1, bonus: 2 };
    all.sort((a, b) => (order[a.type] - order[b.type]) || b.amount - a.amount);
    return '<div class="settle-todo"><div class="settle-todo-head">⚠️ 需要你處理（' + all.length + '）</div>' +
      all.map((a) => {
        const isBonus = a.type === "bonus";
        const st = findStudent(a.studentId);
        return '<div class="settle-todo-row">' +
          '<span class="settle-avatar" style="background:' + ((st && st.color) || "#4f7cff") + ';">' + escapeHtml(initialOf(a.studentName)) + '</span>' +
          '<span class="settle-todo-name">' + escapeHtml(a.studentName) + '</span>' +
          '<span class="settle-todo-title ' + (isBonus ? "is-bonus" : "is-punish") + '">' + escapeHtml(a.title) + '</span>' +
          '<span class="settle-todo-sub">' + escapeHtml(a.sub) + '</span>' +
          '<button class="btn btn-sm btn-primary settle-todo-btn" data-todo-type="' + a.type + '" data-todo-id="' + a.id + '" data-todo-student="' + a.studentId + '">' +
          (isBonus ? "✓ 已發放" : "✓ 完成") + '</button></div>';
      }).join("") + '</div>';
  }

  function currentWeekHtml(student) {
    const rules = normalizeRules(student.rules);
    if (!rules.length) {
      return '<div class="card settle-week is-current"><div class="settle-week-head"><span class="settle-week-range">本週進行中</span></div>' +
        '<div class="text-faint" style="font-size:calc(12.5px * var(--font-scale, 1));">這位學生還沒有設定任何規矩，<a href="rules-config.html">前往設定 →</a></div></div>';
    }
    const live = computeLiveWeekProgress(student, rules);
    const startMs = typeof student.lastRuleSettlementMs === "number" ? student.lastRuleSettlementMs : null;
    const dueMs = nextFridaySettlementMs(Date.now());
    const remain = dueMs - Date.now();
    const days = Math.floor(remain / 86400000);
    const hours = Math.floor((remain % 86400000) / 3600000);
    const net = live.netJumpingJacks;
    const tone = net > 0 ? "is-punish" : net < 0 ? "is-bonus" : "is-neutral";
    const netText = net > 0 ? "+" + net + " 下" + RULE_UNIT_LABEL + "（目前是處罰）"
      : net < 0 ? net + " 下" + RULE_UNIT_LABEL + "　→　可換 " + fmtMoney(Math.floor(-net / 10)) + " 獎金"
      : "持平，目前沒有處罰也沒有獎金";
    const perRule = rules.map((r) => {
      const st = live.perRule[r.id] || { lateMinutes: 0, earlyMinutes: 0, violationCount: 0, jumpingJacks: 0 };
      const desc = r.type === "punctuality"
        ? "遲到 " + st.lateMinutes + " 分・提早 " + st.earlyMinutes + " 分"
        : (st.violationCount > 0 ? st.violationCount + " 下已登記" : "本週無違規");
      return '<div class="settle-live-row"><span class="settle-live-name">' + escapeHtml(r.name) + '</span>' +
        '<span class="settle-live-desc">' + escapeHtml(desc) + '</span>' +
        '<span class="settle-live-jacks ' + (st.jumpingJacks > 0 ? "is-punish" : st.jumpingJacks < 0 ? "is-bonus" : "") + '">' + fmtJacks(st.jumpingJacks) + '</span></div>';
    }).join("");
    return '<div class="card settle-week is-current"><div class="settle-week-head">' +
      '<span class="settle-week-range">📌 本週進行中　' + shortInstant(startMs ? fmtSettlementInstant(startMs) : null) + ' → ' + shortInstant(fmtSettlementInstant(dueMs)) + ' 結算</span>' +
      '<span class="settle-week-countdown">還有 ' + days + ' 天 ' + hours + ' 小時</span></div>' +
      '<div class="settle-week-net ' + tone + '">目前淨值　' + escapeHtml(netText) + '</div>' +
      '<div class="settle-live-list">' + perRule + '</div>' +
      '<div class="settle-week-actions"><button class="btn btn-sm" data-force-settle="' + student.id + '">⏭️ 立即結算本週</button></div></div>';
  }

  function detailRowHtml(d) {
    const tone = d.jumpingJacks > 0 ? "is-punish" : d.jumpingJacks < 0 ? "is-bonus" : "";
    const skipped = !d.countedInNet;
    return '<div class="settle-detail-row' + (skipped ? " is-skipped" : "") + '">' +
      '<span class="settle-detail-kind">' + (d.kind === "arrival" ? "⏰" : "📌") + ' ' + escapeHtml(d.label) + '</span>' +
      '<span class="settle-detail-desc">' + escapeHtml(d.detail) + '</span>' +
      '<span class="settle-detail-jacks ' + tone + '">' + fmtJacks(d.jumpingJacks) + '</span>' +
      '<span class="settle-detail-tag">' + (skipped ? "當場執行・未計入" : "已計入") + '</span></div>';
  }

  function weekCardHtml(week) {
    const s = week.settlement;
    const isPunish = s.netJumpingJacks > 0;
    const bonus = Number(s.bonusAmount) || 0;
    const hasBonus = bonus > 0;
    const punishDone = s.punishmentStatus === "done";
    const bonusPaid = s.bonusStatus === "done";
    const range = shortInstant(s.periodStart) + " → " + shortInstant(s.periodEnd);
    let resultHtml, statusHtml, actionHtml;
    if (isPunish) {
      resultHtml = '<span class="settle-result is-punish" data-view-mode>⚠️ 罰 ' + s.punishmentCount + ' 下' + RULE_UNIT_LABEL + '</span>' +
        '<span class="settle-result is-punish" data-edit-mode style="display:none;">⚠️ 罰 <input type="number" min="1" data-edit-punishment value="' + s.punishmentCount + '" style="width:80px;" /> 下' + RULE_UNIT_LABEL + '</span>';
      statusHtml = '<span class="badge ' + (punishDone ? "badge-done" : "badge-warn") + '">' + (punishDone ? "✓ 已執行" : "待執行") + '</span>';
      actionHtml = '<button class="btn btn-sm ' + (punishDone ? "" : "btn-primary") + '" data-settlement-toggle="' + s.id + '">' + (punishDone ? "↺ 取消" : "✓ 完成") + '</button>';
    } else {
      resultHtml = '<span class="settle-result is-bonus" data-view-mode>🎉 獲得獎金 ' + fmtMoney(bonus) + '</span>' +
        '<span class="settle-result is-bonus" data-edit-mode style="display:none;">🎉 獲得獎金 <input type="number" min="0" data-edit-bonus value="' + bonus + '" style="width:90px;" /> 元</span>';
      statusHtml = hasBonus ? '<span class="badge ' + (bonusPaid ? "badge-done" : "badge-warn") + '">' + (bonusPaid ? "✓ 已發放" : "待發放") + '</span>' : "";
      actionHtml = hasBonus ? '<button class="btn btn-sm ' + (bonusPaid ? "" : "btn-primary") + '" data-bonus-toggle="' + s.id + '">' + (bonusPaid ? "↺ 取消" : "✓ 已發放") + '</button>' : "";
    }
    const detailsHtml = week.details.length
      ? '<details class="settle-details"><summary>展開明細（' + week.details.length + ' 筆）</summary><div class="settle-detail-list">' + week.details.map(detailRowHtml).join("") + '</div></details>'
      : '<div class="settle-details-empty">這一週沒有可展開的原始紀錄</div>';
    return '<div class="card settle-week ' + (isPunish ? "is-punish" : "is-bonus") + '" data-settlement-row="' + s.id + '">' +
      '<div class="settle-week-head"><span class="settle-week-range">' + escapeHtml(range) + '</span></div>' +
      '<div class="settle-week-body">' + resultHtml + statusHtml +
      '<div class="settle-week-btns" data-view-mode>' + actionHtml +
      '<button class="btn btn-sm" data-settlement-edit-btn="' + s.id + '">編輯</button>' +
      '<button class="btn btn-sm" style="color:var(--bad);" data-settlement-del-btn="' + s.id + '">刪除</button></div>' +
      '<div class="settle-week-btns" data-edit-mode style="display:none;">' +
      '<button class="btn btn-sm btn-primary" data-settlement-save-btn="' + s.id + '">儲存</button>' +
      '<button class="btn btn-sm" data-settlement-cancel-btn="' + s.id + '">取消</button></div></div>' + detailsHtml + '</div>';
  }

  function unsettledRowHtml(student, v) {
    const executed = v.executedStatus === "done";
    const ruleName = v.ruleId ? (((student.rules || []).find((r) => r.id === v.ruleId) || {}).name || "（規矩已刪除）") : "臨時登記";
    return '<div class="settle-pending-row" data-violation-row="' + v.id + '">' +
      '<span class="badge badge-normal">' + escapeHtml(ruleName) + '</span>' +
      '<span data-view-mode class="settle-pending-main"><b>' + v.count + '</b> 下' + RULE_UNIT_LABEL +
      ' <span class="text-faint">' + escapeHtml(v.reason || "（無原因）") + '</span></span>' +
      '<span data-edit-mode class="settle-pending-main" style="display:none;">' +
      '<input type="number" min="1" data-edit-count value="' + v.count + '" style="width:70px;" /> 下' + RULE_UNIT_LABEL +
      ' <input type="text" data-edit-reason value="' + escapeHtml(v.reason || "") + '" placeholder="原因" style="width:150px;" /></span>' +
      '<span class="settle-pending-time">' + escapeHtml(fmtSettlementInstant(entryInstantMs(v, "loggedAt", "loggedAtMs"))) + '</span>' +
      '<span class="badge ' + (executed ? "badge-done" : "badge-warn") + '">' + (executed ? "✓ 已執行" : "待執行") + '</span>' +
      '<span class="settle-pending-btns" data-view-mode>' +
      '<button class="btn btn-sm ' + (executed ? "" : "btn-primary") + '" data-toggle-exec="' + v.id + '">' + (executed ? "↺ 取消" : "✓ 完成") + '</button>' +
      '<button class="btn btn-sm" data-edit-btn="' + v.id + '">編輯</button>' +
      '<button class="btn btn-sm" style="color:var(--bad);" data-del-btn="' + v.id + '">刪除</button></span>' +
      '<span class="settle-pending-btns" data-edit-mode style="display:none;">' +
      '<button class="btn btn-sm btn-primary" data-save-btn="' + v.id + '">儲存</button>' +
      '<button class="btn btn-sm" data-cancel-btn="' + v.id + '">取消</button></span></div>';
  }

  function unsettledSectionHtml(student) {
    // 涵蓋兩種「還沒被週結算捲走」的登記：尚未結算的，以及被家長當場標記已執行而排除在結算外的。
    // 若只用 unsettledViolationsOf()，第二種一按「完成」整列就會消失，按錯也找不到地方取消。
    const list = (student.ruleViolations || [])
      .filter((v) => !v.settled || v.settledBy === "manualExecute")
      .slice()
      .sort((a, b) => entryInstantMs(b, "loggedAt", "loggedAtMs") - entryInstantMs(a, "loggedAt", "loggedAtMs"));
    if (!list.length) return "";
    return '<div class="settle-pending-box"><div class="settle-pending-head">本週已登記、尚未結算的單筆處罰（' + list.length + '）</div>' +
      '<div class="text-faint settle-pending-note">這些會在下次結算時併入淨值；若已當場執行完，可直接按「完成」把它排除在結算之外，避免重複處罰。</div>' +
      list.map((v) => unsettledRowHtml(student, v)).join("") + '</div>';
  }

  function tabsHtml() {
    if (students.length < 2) return "";
    return '<div class="student-tab-row">' + students.map((s) => {
      const n = pendingActionsOf(s).length;
      return '<button class="student-tab ' + (s.id === activeStudentId ? "active" : "") + '" data-tab="' + s.id + '">' +
        '<span class="dot" style="background:' + (s.color || "#4f7cff") + ';">' + escapeHtml(initialOf(s.name)) + '</span>' +
        escapeHtml(s.name) + (n ? '<span class="tab-dot">' + n + '</span>' : "") + '</button>';
    }).join("") + '</div>';
  }

  function studentBodyHtml(student) {
    const weeks = settlementWeeksOf(student, student.rules);
    const now = Date.now();
    const recent = [], older = [];
    weeks.forEach((w) => ((now - (w.endMs || 0) <= TWO_WEEKS_MS ? recent : older).push(w)));
    const groups = [], idx = {};
    older.forEach((w) => {
      const key = monthKey(w.endMs || now);
      if (!(key in idx)) { idx[key] = groups.length; groups.push({ key, items: [] }); }
      groups[idx[key]].items.push(w);
    });
    const settledHtml = weeks.length
      ? recent.map(weekCardHtml).join("") + groups.map((g) =>
          '<details class="violation-month-group"><summary>' + escapeHtml(g.key) + '（' + g.items.length + ' 週）</summary>' +
          '<div style="margin-top:8px;">' + g.items.map(weekCardHtml).join("") + '</div></details>').join("")
      : '<div class="text-faint" style="font-size:calc(12.5px * var(--font-scale, 1));">還沒有任何已結算的週次 🎉</div>';
    return '<div>' + currentWeekHtml(student) + unsettledSectionHtml(student) +
      '<div class="settle-section-label">已結算</div>' + settledHtml + '</div>';
  }

  function render() {
    const student = findStudent(activeStudentId) || students[0];
    activeStudentId = student.id;
    wrap.innerHTML = pendingBoardHtml() + tabsHtml() + studentBodyHtml(student);
    bindAll();
  }
  function refreshAfter(u) { replaceStudent(u); render(); }

  function bindAll() {
    wrap.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => { activeStudentId = b.dataset.tab; render(); }));

    wrap.querySelectorAll("[data-todo-type]").forEach((btn) => btn.addEventListener("click", async () => {
      const { todoType, todoId, todoStudent } = btn.dataset;
      const st = findStudent(todoStudent);
      if (!st) return;
      btn.disabled = true;
      try {
        let updated;
        if (todoType === "punishment") ({ student: updated } = await markRulePunishmentDone(st, todoId, true));
        else if (todoType === "bonus") ({ student: updated } = await markRuleBonusPaid(st, todoId, true));
        else ({ student: updated } = await setViolationExecuted(st, todoId, true));
        showToast(todoType === "bonus" ? "已標記為已發放 ✓" : "已標記完成 ✓");
        refreshAfter(updated);
      } catch (e) { alert("標記失敗：" + e.message); btn.disabled = false; }
    }));

    const student = findStudent(activeStudentId);
    if (!student) return;

    wrap.querySelectorAll("[data-force-settle]").forEach((btn) => btn.addEventListener("click", async () => {
      const ok = await confirmDialog("確定要立刻結算「" + student.name + "」目前累積的淨值嗎？不用等到週五，會用「現在」當作這次的截止時刻。", { title: "立即結算本週", confirmText: "立刻結算" });
      if (!ok) return;
      btn.disabled = true;
      try {
        const { student: updated, newSettlement } = await forceSettleNow(student);
        showToast(newSettlement ? "已完成結算 ✓" : "本週沒有需要結算的內容");
        refreshAfter(updated);
      } catch (e) { alert("結算失敗：" + e.message); btn.disabled = false; }
    }));

    wrap.querySelectorAll("[data-settlement-toggle]").forEach((btn) => btn.addEventListener("click", async () => {
      const id = btn.dataset.settlementToggle;
      const s = (student.ruleSettlements || []).find((x) => x.id === id);
      const next = !(s && s.punishmentStatus === "done");
      btn.disabled = true;
      try { const { student: u } = await markRulePunishmentDone(student, id, next); showToast(next ? "已標記執行完成 ✓" : "已改回待執行"); refreshAfter(u); }
      catch (e) { alert("標記失敗：" + e.message); btn.disabled = false; }
    }));

    wrap.querySelectorAll("[data-bonus-toggle]").forEach((btn) => btn.addEventListener("click", async () => {
      const id = btn.dataset.bonusToggle;
      const s = (student.ruleSettlements || []).find((x) => x.id === id);
      const next = !(s && s.bonusStatus === "done");
      btn.disabled = true;
      try { const { student: u } = await markRuleBonusPaid(student, id, next); showToast(next ? "已標記為已發放 ✓" : "已改回待發放"); refreshAfter(u); }
      catch (e) { alert("標記失敗：" + e.message); btn.disabled = false; }
    }));

    wrap.querySelectorAll("[data-settlement-edit-btn]").forEach((btn) => btn.addEventListener("click", () => {
      const row = wrap.querySelector('[data-settlement-row="' + btn.dataset.settlementEditBtn + '"]');
      row.querySelectorAll("[data-view-mode]").forEach((n) => (n.style.display = "none"));
      row.querySelectorAll("[data-edit-mode]").forEach((n) => (n.style.display = "inline-flex"));
    }));
    wrap.querySelectorAll("[data-settlement-cancel-btn]").forEach((btn) => btn.addEventListener("click", () => {
      const row = wrap.querySelector('[data-settlement-row="' + btn.dataset.settlementCancelBtn + '"]');
      row.querySelectorAll("[data-edit-mode]").forEach((n) => (n.style.display = "none"));
      row.querySelectorAll("[data-view-mode]").forEach((n) => (n.style.display = "inline-flex"));
    }));
    wrap.querySelectorAll("[data-settlement-save-btn]").forEach((btn) => btn.addEventListener("click", async () => {
      const id = btn.dataset.settlementSaveBtn;
      const row = wrap.querySelector('[data-settlement-row="' + id + '"]');
      const pIn = row.querySelector("[data-edit-punishment]"), bIn = row.querySelector("[data-edit-bonus]");
      let fields;
      if (pIn) { const c = Number(pIn.value) || 0; if (c <= 0) return alert("請輸入大於 0 的次數"); fields = { punishmentCount: c }; }
      else { const a = Number(bIn.value); if (!(a >= 0)) return alert("請輸入不小於 0 的金額"); fields = { bonusAmount: a }; }
      btn.disabled = true;
      try { const { student: u } = await updateRuleSettlement(student, id, fields); showToast("已更新 ✓"); refreshAfter(u); }
      catch (e) { alert("更新失敗：" + e.message); btn.disabled = false; }
    }));
    wrap.querySelectorAll("[data-settlement-del-btn]").forEach((btn) => btn.addEventListener("click", async () => {
      const ok = await confirmDialog("確定要刪除這筆結算紀錄嗎？此動作無法復原。", { title: "刪除結算紀錄", confirmText: "刪除", danger: true });
      if (!ok) return;
      btn.disabled = true;
      try { const { student: u } = await deleteRuleSettlement(student, btn.dataset.settlementDelBtn); showToast("已刪除"); refreshAfter(u); }
      catch (e) { alert("刪除失敗：" + e.message); btn.disabled = false; }
    }));

    wrap.querySelectorAll("[data-edit-btn]").forEach((btn) => btn.addEventListener("click", () => {
      const row = wrap.querySelector('[data-violation-row="' + btn.dataset.editBtn + '"]');
      row.querySelectorAll("[data-view-mode]").forEach((n) => (n.style.display = "none"));
      row.querySelectorAll("[data-edit-mode]").forEach((n) => (n.style.display = "inline-flex"));
    }));
    wrap.querySelectorAll("[data-cancel-btn]").forEach((btn) => btn.addEventListener("click", () => {
      const row = wrap.querySelector('[data-violation-row="' + btn.dataset.cancelBtn + '"]');
      row.querySelectorAll("[data-edit-mode]").forEach((n) => (n.style.display = "none"));
      row.querySelectorAll("[data-view-mode]").forEach((n) => (n.style.display = "inline-flex"));
    }));
    wrap.querySelectorAll("[data-save-btn]").forEach((btn) => btn.addEventListener("click", async () => {
      const id = btn.dataset.saveBtn;
      const row = wrap.querySelector('[data-violation-row="' + id + '"]');
      const count = Number(row.querySelector("[data-edit-count]").value) || 0;
      const reason = row.querySelector("[data-edit-reason]").value.trim();
      if (count <= 0) return alert("請輸入大於 0 的次數");
      btn.disabled = true;
      try { const { student: u } = await updateRuleViolation(student, id, { count, reason }); showToast("已更新 ✓"); refreshAfter(u); }
      catch (e) { alert("更新失敗：" + e.message); btn.disabled = false; }
    }));
    wrap.querySelectorAll("[data-del-btn]").forEach((btn) => btn.addEventListener("click", async () => {
      const ok = await confirmDialog("確定要刪除這筆處罰登記嗎？此動作無法復原。", { title: "刪除處罰登記", confirmText: "刪除", danger: true });
      if (!ok) return;
      btn.disabled = true;
      try { const { student: u } = await deleteRuleViolation(student, btn.dataset.delBtn); showToast("已刪除"); refreshAfter(u); }
      catch (e) { alert("刪除失敗：" + e.message); btn.disabled = false; }
    }));
    wrap.querySelectorAll("[data-toggle-exec]").forEach((btn) => btn.addEventListener("click", async () => {
      const id = btn.dataset.toggleExec;
      const v = (student.ruleViolations || []).find((x) => x.id === id);
      const next = !(v && v.executedStatus === "done");
      btn.disabled = true;
      try { const { student: u } = await setViolationExecuted(student, id, next); showToast(next ? "已標記為已執行 ✓" : "已改回待執行"); refreshAfter(u); }
      catch (e) { alert("標記失敗：" + e.message); btn.disabled = false; }
    }));
  }

  render();

  document.addEventListener("jfkd:violation-logged", (e) => {
    const u = e.detail;
    if (!u || !findStudent(u.id)) return;
    activeStudentId = u.id;
    refreshAfter(u);
  });
})();
