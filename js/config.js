/* config.js — 獎懲規則設定頁 */
(async function () {
  await requireGuard();

  let [students, rules] = await Promise.all([listStudents(), getRules()]);
  renderStudentNav(students, null);
  renderStudentList();
  renderTiersTable();
  renderComboRows("combo3Rows", "comboBonus3");
  renderComboRows("combo5Rows", "comboBonus5");
  document.getElementById("progressPerPoint").value = rules.progressBonusPerPoint;
  document.getElementById("punishmentText").value = rules.punishmentText || "";

  // ---- 學生管理 ----
  function renderStudentList() {
    const el = document.getElementById("studentList");
    if (!students.length) {
      el.innerHTML = '<span class="text-faint" style="font-size:13px;">尚未新增任何學生</span>';
      return;
    }
    el.innerHTML = students
      .map(
        (s) => `<span class="chip">${escapeHtml(s.name)}
          <span data-del="${s.id}" style="cursor:pointer; color:var(--bad); margin-left:6px;">✕</span>
        </span>`
      )
      .join("");
    el.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("刪除學生不會刪除其歷史紀錄，但學生清單會少一位，確定嗎？")) return;
        await deleteStudent(btn.dataset.del);
        students = await listStudents();
        renderStudentList();
        renderStudentNav(students, null);
      });
    });
  }

  document.getElementById("addStudentBtn").addEventListener("click", async () => {
    const input = document.getElementById("newStudentName");
    const name = input.value.trim();
    if (!name) return;
    await addStudent(name);
    input.value = "";
    students = await listStudents();
    renderStudentList();
    renderStudentNav(students, null);
  });

  // ---- 級距表 ----
  function renderTiersTable() {
    const tbody = document.querySelector("#tiersTable tbody");
    tbody.innerHTML = rules.tiers
      .map(
        (t, i) => `<tr data-idx="${i}">
          <td><span class="badge badge-${t.key}">${t.label}</span></td>
          <td class="text-dim">${t.min} ~ ${t.max} 分</td>
          <td class="num"><input type="number" class="t-base" value="${t.baseBonus}" style="width:90px; text-align:right;" /></td>
          <td class="num"><input type="number" class="t-defense" value="${t.defenseBonus}" style="width:90px; text-align:right;" /></td>
          <td>${t.punishment ? "是" : "否"}</td>
        </tr>`
      )
      .join("");
  }

  // ---- 全科加碼 ----
  function renderComboRows(containerId, key) {
    const el = document.getElementById(containerId);
    const nonPenaltyTiers = rules.tiers.filter((t) => !t.punishment);
    el.innerHTML = nonPenaltyTiers
      .map(
        (t) => `<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; margin-bottom:10px;">
          <span class="badge badge-${t.key}">${t.label}</span>
          <input type="number" data-combo="${key}" data-tier="${t.key}" value="${rules[key]?.[t.key] || 0}" style="max-width:140px; text-align:right;" />
        </div>`
      )
      .join("");
  }

  // ---- 儲存 ----
  document.getElementById("saveRulesBtn").addEventListener("click", async () => {
    const rows = [...document.querySelectorAll("#tiersTable tbody tr")];
    const newTiers = rules.tiers.map((t, i) => {
      const row = rows[i];
      return {
        ...t,
        baseBonus: Number(row.querySelector(".t-base").value) || 0,
        defenseBonus: Number(row.querySelector(".t-defense").value) || 0,
      };
    });

    const comboBonus3 = {};
    document.querySelectorAll('[data-combo="comboBonus3"]').forEach((inp) => {
      comboBonus3[inp.dataset.tier] = Number(inp.value) || 0;
    });
    const comboBonus5 = {};
    document.querySelectorAll('[data-combo="comboBonus5"]').forEach((inp) => {
      comboBonus5[inp.dataset.tier] = Number(inp.value) || 0;
    });

    const updated = {
      tiers: newTiers,
      progressBonusPerPoint: Number(document.getElementById("progressPerPoint").value) || 0,
      comboBonus3,
      comboBonus5,
      punishmentText: document.getElementById("punishmentText").value,
    };

    const btn = document.getElementById("saveRulesBtn");
    const msg = document.getElementById("saveMsg");
    btn.disabled = true;
    msg.textContent = "儲存中...";
    try {
      await saveRules(updated);
      rules = updated;
      msg.textContent = "已儲存 ✓";
      setTimeout(() => (msg.textContent = ""), 2500);
    } catch (err) {
      msg.textContent = "儲存失敗：" + err.message;
    } finally {
      btn.disabled = false;
    }
  });
})();
