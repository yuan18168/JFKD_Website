/* rules-config.js — 規矩設定：家長為每位學生建立/編輯/刪除規矩（出門紀律／固定次數型），
   並在頁面上方看到所有「待執行的處罰」可以一鍵標記已執行。
   規矩清單存在 students/{id}.rules；打卡與登記則是孩子在 app.html／家長端快速登記工具寫入的。 */
(async function () {
  await requireGuard();
  await requireParentPin();
  await applySiteFontScale();

  let students = await listStudents();
  renderStudentNav(students, null);

  const wrap = document.getElementById("studentRuleCards");
  const pendingWrap = document.getElementById("pendingPunishments");

  if (!students.length) {
    wrap.innerHTML = '<div class="empty-state">尚未新增學生，請至「學生名單」新增</div>';
    pendingWrap.innerHTML = "";
    return;
  }

  // 每位學生一份「草稿」規矩清單，跟 daily-tasks 的做法一致：新增/刪除只改草稿＋局部重畫
  const drafts = {};
  students.forEach((s) => {
    drafts[s.id] = normalizeRules(s.rules);
  });

  function renderPending() {
    const rows = [];
    students.forEach((s) => {
      (s.ruleSettlements || [])
        .filter((st) => st.punishmentStatus === "pending")
        .forEach((st) => rows.push({ student: s, settlement: st }));
    });
    if (!rows.length) {
      pendingWrap.innerHTML = '<div class="text-faint" style="font-size:calc(13px * var(--font-scale, 1));">目前沒有待執行的處罰 🎉</div>';
      return;
    }
    pendingWrap.innerHTML = rows
      .map(
        ({ student, settlement }) => `
      <div class="card" style="display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:8px; padding:10px 14px;" data-pending-row="${settlement.id}">
        <span style="width:22px;height:22px;border-radius:50%;background:${student.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;color:#08122e;">${(student.name || "?").slice(0, 1)}</span>
        <span style="font-weight:700;">${escapeHtml(student.name)}</span>
        <span class="badge badge-penalty">待執行 ${settlement.punishmentCount} 下開合跳</span>
        <span class="text-faint" style="font-size:calc(12px * var(--font-scale, 1));">結算週期至 ${escapeHtml(settlement.periodEnd)}</span>
        <button class="btn btn-sm btn-primary" style="margin-left:auto;" data-mark-done="${settlement.id}" data-owner="${student.id}">✓ 標記已執行</button>
      </div>`
      )
      .join("");

    pendingWrap.querySelectorAll("[data-mark-done]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const sid = btn.dataset.owner;
        const settlementId = btn.dataset.markDone;
        const student = students.find((s) => s.id === sid);
        btn.disabled = true;
        try {
          const { student: updated } = await markRulePunishmentDone(student, settlementId);
          students = students.map((s) => (s.id === sid ? updated : s));
          showToast("已標記執行完成 ✓");
          renderPending();
        } catch (err) {
          alert("標記失敗：" + err.message);
          btn.disabled = false;
        }
      });
    });
  }

  function templatePickerHtml(studentId) {
    return Object.values(RULE_TEMPLATES)
      .map((tpl) => `<button class="btn btn-sm" data-add-rule="${studentId}" data-rule-type="${tpl.type}">＋ ${tpl.label}</button>`)
      .join(" ");
  }

  function ruleConfigFieldsHtml(rule) {
    if (rule.type === "punctuality") {
      return `
        <label class="text-faint" style="font-size:calc(12px * var(--font-scale, 1));">規定時間
          <input type="time" data-rule-field="deadlineTime" value="${escapeHtml(rule.config.deadlineTime || "07:35")}" style="width:120px;" />
        </label>
        <label class="text-faint" style="font-size:calc(12px * var(--font-scale, 1));">倍率（分鐘 × 倍率 = 開合跳）
          <input type="number" min="1" data-rule-field="multiplier" value="${rule.config.multiplier || 10}" style="width:70px;" />
        </label>`;
    }
    return `
      <label class="text-faint" style="font-size:calc(12px * var(--font-scale, 1));">每次違規固定次數（開合跳）
        <input type="number" min="1" data-rule-field="defaultCount" value="${rule.config.defaultCount || 100}" style="width:90px;" />
      </label>`;
  }

  function ruleRowHtml(studentId, rule) {
    const tpl = RULE_TEMPLATES[rule.type];
    return `
      <div class="card" data-rule-row="${rule.id}" data-owner="${studentId}" data-rule-type="${rule.type}" style="display:flex; flex-wrap:wrap; align-items:center; gap:10px; margin-bottom:8px; padding:10px 12px;">
        <span class="badge badge-normal">${tpl ? tpl.label : rule.type}</span>
        <input type="text" value="${escapeHtml(rule.name || "")}" data-rule-name placeholder="規矩名稱" style="width:140px;" />
        <label style="display:flex; align-items:center; gap:4px; font-size:calc(12px * var(--font-scale, 1));">
          <input type="checkbox" data-rule-enabled ${rule.enabled ? "checked" : ""} /> 啟用中
        </label>
        ${ruleConfigFieldsHtml(rule)}
        <span data-rule-del="${rule.id}" data-owner-del="${studentId}" style="cursor:pointer; color:var(--bad); font-size:calc(12px * var(--font-scale, 1)); margin-left:auto;">刪除</span>
      </div>`;
  }

  function cardHtml(student) {
    const rules = drafts[student.id];
    return `
      <div class="card" style="margin-bottom:14px;" data-student-card="${student.id}">
        <div class="flex-between" style="margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:22px;height:22px;border-radius:50%;background:${student.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:calc(11px * var(--font-scale, 1));font-weight:700;color:#08122e;">${(student.name || "?").slice(0, 1)}</span>
            <span style="font-weight:700;">${escapeHtml(student.name)}</span>
          </div>
        </div>

        <div data-rule-list="${student.id}">
          ${rules.length ? rules.map((r) => ruleRowHtml(student.id, r)).join("") : '<div class="text-faint" style="font-size:calc(12px * var(--font-scale, 1)); margin-bottom:8px;">尚未設定任何規矩</div>'}
        </div>

        <div style="display:flex; gap:8px; margin-top:6px; flex-wrap:wrap;">
          ${templatePickerHtml(student.id)}
        </div>

        <div style="margin-top:16px;">
          <button class="btn btn-primary" data-save-rules="${student.id}">儲存這位學生的規矩</button>
          <span class="text-faint" style="margin-left:10px; font-size:calc(12px * var(--font-scale, 1));" data-save-msg="${student.id}"></span>
        </div>
      </div>`;
  }

  function readDraftFromDom(studentId) {
    const rows = wrap.querySelectorAll(`[data-rule-row][data-owner="${studentId}"]`);
    return [...rows].map((row) => {
      const type = row.dataset.ruleType;
      const config = {};
      row.querySelectorAll("[data-rule-field]").forEach((input) => {
        const key = input.dataset.ruleField;
        config[key] = key === "deadlineTime" ? input.value : Number(input.value) || 0;
      });
      return {
        id: row.dataset.ruleRow,
        type,
        name: row.querySelector("[data-rule-name]").value.trim() || RULE_TEMPLATES[type].defaultName,
        enabled: row.querySelector("[data-rule-enabled]").checked,
        config: { ...defaultRuleConfig(type), ...config },
      };
    });
  }

  function renderCard(student) {
    const el = wrap.querySelector(`[data-student-card="${student.id}"]`);
    const html = cardHtml(student);
    if (el) el.outerHTML = html;
    bindCard(student);
  }

  function bindCard(student) {
    const card = wrap.querySelector(`[data-student-card="${student.id}"]`);
    if (!card) return;

    card.querySelectorAll("[data-rule-del]").forEach((link) => {
      link.addEventListener("click", () => {
        drafts[student.id] = readDraftFromDom(student.id).filter((r) => r.id !== link.dataset.ruleDel);
        renderCard(student);
      });
    });

    card.querySelectorAll("[data-add-rule]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const draft = newRuleDraft(btn.dataset.ruleType);
        drafts[student.id] = [...readDraftFromDom(student.id), draft];
        renderCard(student);
      });
    });

    const saveBtn = card.querySelector(`[data-save-rules="${student.id}"]`);
    saveBtn.addEventListener("click", async () => {
      const msg = card.querySelector(`[data-save-msg="${student.id}"]`);
      const rules = readDraftFromDom(student.id);
      saveBtn.disabled = true;
      saveBtn.textContent = "儲存中...";
      try {
        await saveStudentRules(student.id, rules);
        drafts[student.id] = normalizeRules(rules);
        student.rules = drafts[student.id];
        msg.style.color = "var(--good)";
        msg.textContent = "已儲存 ✓";
        saveBtn.textContent = "儲存這位學生的規矩";
        flashButtonSuccess(saveBtn);
        setTimeout(() => {
          msg.textContent = "";
          msg.style.color = "";
        }, 2500);
      } catch (err) {
        msg.style.color = "var(--bad)";
        msg.textContent = "儲存失敗：" + err.message;
        saveBtn.textContent = "儲存這位學生的規矩";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  wrap.innerHTML = students.map((s) => cardHtml(s)).join("");
  students.forEach((s) => bindCard(s));
  renderPending();
})();
