/* violations.js — 處罰清單：列出每位學生「全部」的處罰登記（不論是否已結算），
   可就地修改次數/原因、刪除登記錯誤的紀錄，也能不用等到週五結算，
   當場執行完就直接標記「已執行處罰」（見 data.js 的 setViolationExecuted）。
   兩週內的紀錄直接展開顯示，更久的依月份分組、可展開/收起，避免清單過長。 */
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

  function ruleNameOf(student, ruleId) {
    if (!ruleId) return "臨時登記";
    const rule = (student.rules || []).find((r) => r.id === ruleId);
    return rule ? rule.name : "（規矩已刪除）";
  }

  function monthKey(ms) {
    const d = new Date(ms);
    return `${d.getFullYear()}年${d.getMonth() + 1}月`;
  }

  function statusBadgesHtml(v) {
    const executed = v.executedStatus === "done";
    const execBadge = executed
      ? '<span class="badge badge-done">✓ 已執行</span>'
      : '<span class="badge badge-warn">待執行</span>';
    const settleBadge = v.settled
      ? '<span class="badge badge-normal">已結算</span>'
      : '<span class="badge badge-normal" style="opacity:.65;">尚未結算</span>';
    return execBadge + " " + settleBadge;
  }

  function rowHtml(student, v) {
    const ms = entryInstantMs(v, "loggedAt", "loggedAtMs");
    const timeStr = fmtSettlementInstant(ms);
    const executed = v.executedStatus === "done";
    return `
      <div class="card" data-violation-row="${v.id}" data-owner="${student.id}" style="display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:8px; padding:10px 12px;">
        <span class="badge badge-normal">${escapeHtml(ruleNameOf(student, v.ruleId))}</span>

        <span data-view-mode style="display:inline-flex; align-items:center; gap:6px; flex-wrap:wrap;">
          <b>${v.count}</b> 下${RULE_UNIT_LABEL}
          <span class="text-faint">${escapeHtml(v.reason || "（無原因）")}</span>
        </span>
        <span data-edit-mode style="display:none; align-items:center; gap:6px; flex-wrap:wrap;">
          <input type="number" min="1" data-edit-count value="${v.count}" style="width:70px;" /> 下${RULE_UNIT_LABEL}
          <input type="text" data-edit-reason value="${escapeHtml(v.reason || "")}" placeholder="原因" style="width:150px;" />
        </span>

        <span class="text-faint" style="font-size:calc(11.5px * var(--font-scale, 1));">${escapeHtml(timeStr)}</span>
        ${statusBadgesHtml(v)}

        <div style="margin-left:auto; display:flex; gap:6px; flex-wrap:wrap;" data-view-mode>
          <button class="btn btn-sm ${executed ? "" : "btn-primary"}" data-toggle-exec="${v.id}">${executed ? "↺ 取消已執行" : "✓ 標記已執行"}</button>
          <button class="btn btn-sm" data-edit-btn="${v.id}">編輯</button>
          <button class="btn btn-sm" style="color:var(--bad);" data-del-btn="${v.id}">刪除</button>
        </div>
        <div style="margin-left:auto; display:none; gap:6px;" data-edit-mode>
          <button class="btn btn-sm btn-primary" data-save-btn="${v.id}">儲存</button>
          <button class="btn btn-sm" data-cancel-btn="${v.id}">取消</button>
        </div>
      </div>`;
  }

  /** 【2026-08-04 UX】把「規矩」頁的週結算紀錄（ruleSettlements）也整合顯示在這裡，
   *  純粹是畫面上兩份清單放在同一張卡片方便一次看到，資料結構完全不動、也不會互相影響。 */
  function settlementSectionHtml(student) {
    const list = [...(student.ruleSettlements || [])].reverse();
    if (!list.length) return "";
    return `
      <details class="violation-month-group" style="margin-top:10px;">
        <summary>📅 規矩週結算紀錄（${list.length} 筆，與上方單筆登記是不同機制）</summary>
        <div style="margin-top:8px;">
          ${list.map((s) => {
            if (s.netJumpingJacks > 0) {
              const pending = s.punishmentStatus !== "done";
              return `<div class="card" data-settlement-row="${s.id}" style="display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:8px; padding:10px 12px;">
                <span class="badge badge-normal">週結算</span>
                <span>${escapeHtml(s.periodEnd)} 結算　罰 ${s.punishmentCount} 下${RULE_UNIT_LABEL}</span>
                <span class="badge ${pending ? "badge-warn" : "badge-done"}">${pending ? "待執行" : "✓ 已執行"}</span>
                ${pending ? `<button class="btn btn-sm btn-primary" style="margin-left:auto;" data-settlement-done="${s.id}">✓ 標記已執行</button>` : ""}
              </div>`;
            }
            return `<div class="card" data-settlement-row="${s.id}" style="display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:8px; padding:10px 12px;">
              <span class="badge badge-normal">週結算</span>
              <span>${escapeHtml(s.periodEnd)} 結算　獲得獎金 ${fmtMoney(s.bonusAmount)}</span>
              <span class="badge badge-done">🎉 表現優秀</span>
            </div>`;
          }).join("")}
        </div>
      </details>`;
  }

  function sectionHtml(student) {
    const all = allViolationsOf(student);
    const header = `
      <div class="flex-between" style="margin-bottom:12px;">
        <div style="display:flex; align-items:center; gap:10px;">
          <span style="width:22px;height:22px;border-radius:50%;background:${student.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:calc(11px * var(--font-scale, 1));font-weight:700;color:#08122e;">${(student.name || "?").slice(0, 1)}</span>
          <span style="font-weight:700;">${escapeHtml(student.name)}</span>
        </div>
        <span class="text-faint" style="font-size:calc(12px * var(--font-scale, 1));">共 ${all.length} 筆</span>
      </div>`;

    if (!all.length) {
      return `<div class="card" data-student-section="${student.id}" style="margin-bottom:18px;">${header}<div class="text-faint" style="font-size:calc(12px * var(--font-scale, 1));">目前沒有任何處罰登記 🎉</div></div>`;
    }

    const now = Date.now();
    const recent = [];
    const older = [];
    all.forEach((v) => {
      const ms = entryInstantMs(v, "loggedAt", "loggedAtMs");
      (now - ms <= TWO_WEEKS_MS ? recent : older).push(v);
    });

    const groups = [];
    const groupIndex = {};
    older.forEach((v) => {
      const ms = entryInstantMs(v, "loggedAt", "loggedAtMs");
      const key = monthKey(ms);
      if (!(key in groupIndex)) {
        groupIndex[key] = groups.length;
        groups.push({ key, items: [] });
      }
      groups[groupIndex[key]].items.push(v);
    });

    const recentHtml = recent.length
      ? recent.map((v) => rowHtml(student, v)).join("")
      : '<div class="text-faint" style="font-size:calc(12px * var(--font-scale, 1)); margin-bottom:6px;">最近兩週沒有登記</div>';

    const groupsHtml = groups
      .map(
        (g) => `
        <details class="violation-month-group">
          <summary>${escapeHtml(g.key)}（${g.items.length} 筆）</summary>
          <div style="margin-top:8px;">${g.items.map((v) => rowHtml(student, v)).join("")}</div>
        </details>`
      )
      .join("");

    return `
      <div class="card" data-student-section="${student.id}" style="margin-bottom:18px;">
        ${header}
        <div data-recent-list="${student.id}">${recentHtml}</div>
        ${groupsHtml}
        ${settlementSectionHtml(student)}
      </div>`;
  }

  function findStudent(id) {
    return students.find((s) => s.id === id);
  }

  function renderSection(student) {
    const el = wrap.querySelector(`[data-student-section="${student.id}"]`);
    const html = sectionHtml(student);
    if (el) {
      el.outerHTML = html;
    }
    bindSection(student);
  }

  function bindSection(student) {
    const section = wrap.querySelector(`[data-student-section="${student.id}"]`);
    if (!section) return;

    section.querySelectorAll("[data-edit-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = section.querySelector(`[data-violation-row="${btn.dataset.editBtn}"]`);
        row.querySelectorAll("[data-view-mode]").forEach((n) => (n.style.display = "none"));
        row.querySelectorAll("[data-edit-mode]").forEach((n) => (n.style.display = "inline-flex"));
      });
    });

    section.querySelectorAll("[data-cancel-btn]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const row = section.querySelector(`[data-violation-row="${btn.dataset.cancelBtn}"]`);
        row.querySelectorAll("[data-edit-mode]").forEach((n) => (n.style.display = "none"));
        row.querySelectorAll("[data-view-mode]").forEach((n) => (n.style.display = "inline-flex"));
      });
    });

    section.querySelectorAll("[data-save-btn]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const violationId = btn.dataset.saveBtn;
        const row = section.querySelector(`[data-violation-row="${violationId}"]`);
        const count = Number(row.querySelector("[data-edit-count]").value) || 0;
        const reason = row.querySelector("[data-edit-reason]").value.trim();
        if (count <= 0) {
          alert("請輸入大於 0 的次數");
          return;
        }
        btn.disabled = true;
        try {
          const { student: updated } = await updateRuleViolation(student, violationId, { count, reason });
          students = students.map((s) => (s.id === student.id ? updated : s));
          showToast("已更新 ✓");
          renderSection(updated);
        } catch (err) {
          alert("更新失敗：" + err.message);
          btn.disabled = false;
        }
      });
    });

    section.querySelectorAll("[data-del-btn]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const violationId = btn.dataset.delBtn;
        const ok = await confirmDialog("確定要刪除這筆處罰登記嗎？此動作無法復原。", {
          title: "刪除處罰登記",
          confirmText: "刪除",
          danger: true,
        });
        if (!ok) return;
        btn.disabled = true;
        try {
          const { student: updated } = await deleteRuleViolation(student, violationId);
          students = students.map((s) => (s.id === student.id ? updated : s));
          showToast("已刪除");
          renderSection(updated);
        } catch (err) {
          alert("刪除失敗：" + err.message);
          btn.disabled = false;
        }
      });
    });

    section.querySelectorAll("[data-toggle-exec]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const violationId = btn.dataset.toggleExec;
        const v = (student.ruleViolations || []).find((x) => x.id === violationId);
        const nextExecuted = !(v && v.executedStatus === "done");
        btn.disabled = true;
        try {
          const { student: updated } = await setViolationExecuted(student, violationId, nextExecuted);
          students = students.map((s) => (s.id === student.id ? updated : s));
          showToast(nextExecuted ? "已標記為已執行 ✓" : "已改回待執行");
          renderSection(updated);
        } catch (err) {
          alert("標記失敗：" + err.message);
          btn.disabled = false;
        }
      });
    });

    section.querySelectorAll("[data-settlement-done]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const settlementId = btn.dataset.settlementDone;
        btn.disabled = true;
        try {
          const { student: updated } = await markRulePunishmentDone(student, settlementId);
          students = students.map((s) => (s.id === student.id ? updated : s));
          showToast("已標記執行完成 ✓");
          renderSection(updated);
        } catch (err) {
          alert("標記失敗：" + err.message);
          btn.disabled = false;
        }
      });
    });
  }

  wrap.innerHTML = students.map((s) => sectionHtml(s)).join("");
  students.forEach((s) => bindSection(s));
})();
