/* daily-tasks.js — 每日任務設定：家長為每位學生自由新增/編輯/刪除任務清單，
   設定完成後發放的 XP 數量。任務清單存在 students/{id}.dailyTasks。
   舊資料的 foodReward + coinReward 會由 data.js 的 normalizeDailyTasks() 自動合併成 xpReward。 */
(async function () {
  await requireGuard();
  await requireParentPin();
  await applySiteFontScale();

  const students = await listStudents();
  renderStudentNav(students, null);

  const wrap = document.getElementById("studentTaskCards");
  if (!students.length) {
    wrap.innerHTML = '<div class="empty-state">尚未新增學生，請至「學生名單」新增</div>';
    return;
  }

  // 每位學生一份「草稿」任務清單（新增/刪除時只改這裡＋局部重畫，不會動到其他學生的卡片）
  const drafts = {};
  students.forEach((s) => {
    drafts[s.id] = normalizeDailyTasks(s.dailyTasks);
  });

  function taskRowHtml(studentId, task) {
    return `
      <div class="card" data-task-row="${task.id}" data-owner="${studentId}" style="display:flex; align-items:center; gap:8px; margin-bottom:8px; padding:10px 12px;">
        <input type="text" value="${escapeHtml(task.name || "")}" data-task-name placeholder="任務名稱" style="flex:1;" />
        <input type="number" min="0" value="${task.xpReward || 0}" data-task-xp placeholder="XP" style="width:80px;" />
        <span class="text-faint" style="font-size:calc(11px * var(--font-scale, 1));">XP</span>
        <span data-task-del="${task.id}" data-owner-del="${studentId}" style="cursor:pointer; color:var(--bad); font-size:calc(12px * var(--font-scale, 1));">刪除</span>
      </div>`;
  }

  function cardHtml(student) {
    const tasks = drafts[student.id];
    return `
      <div class="card" style="margin-bottom:14px;" data-student-card="${student.id}">
        <div class="flex-between" style="margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:22px;height:22px;border-radius:50%;background:${student.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:calc(11px * var(--font-scale, 1));font-weight:700;color:#08122e;">${(student.name || "?").slice(0, 1)}</span>
            <span style="font-weight:700;">${escapeHtml(student.name)}</span>
          </div>
        </div>

        <div data-task-list="${student.id}">
          ${tasks.length ? tasks.map((t) => taskRowHtml(student.id, t)).join("") : '<div class="text-faint" style="font-size:calc(12px * var(--font-scale, 1)); margin-bottom:8px;">尚未設定任何任務</div>'}
        </div>

        <div style="display:flex; gap:8px; margin-top:6px;">
          <input type="text" placeholder="新任務名稱（例如：閱讀15分鐘）" data-new-name="${student.id}" style="flex:1;" />
          <input type="number" min="0" placeholder="XP" data-new-xp="${student.id}" style="width:80px;" />
          <button class="btn btn-sm" data-add-task="${student.id}">＋新增任務</button>
        </div>

        <div style="margin-top:16px;">
          <button class="btn btn-primary" data-save-tasks="${student.id}">儲存這位學生的任務清單</button>
          <span class="text-faint" style="margin-left:10px; font-size:calc(12px * var(--font-scale, 1));" data-save-msg="${student.id}"></span>
        </div>
      </div>`;
  }

  function renderCard(student) {
    const el = wrap.querySelector(`[data-student-card="${student.id}"]`);
    const html = cardHtml(student);
    if (el) {
      el.outerHTML = html;
    }
    bindCard(student);
  }

  function readDraftFromDom(studentId) {
    const rows = wrap.querySelectorAll(`[data-task-row][data-owner="${studentId}"]`);
    return [...rows]
      .map((row) => ({
        id: row.dataset.taskRow,
        name: row.querySelector("[data-task-name]").value.trim(),
        xpReward: Number(row.querySelector("[data-task-xp]").value) || 0,
      }))
      .filter((t) => t.name);
  }

  function bindCard(student) {
    const card = wrap.querySelector(`[data-student-card="${student.id}"]`);
    if (!card) return;

    card.querySelectorAll(`[data-task-del]`).forEach((link) => {
      link.addEventListener("click", () => {
        drafts[student.id] = readDraftFromDom(student.id).filter((t) => t.id !== link.dataset.taskDel);
        renderCard(student);
      });
    });

    const addBtn = card.querySelector(`[data-add-task="${student.id}"]`);
    addBtn.addEventListener("click", () => {
      const nameEl = card.querySelector(`[data-new-name="${student.id}"]`);
      const xpEl = card.querySelector(`[data-new-xp="${student.id}"]`);
      const name = nameEl.value.trim();
      if (!name) {
        alert("請輸入任務名稱");
        return;
      }
      const newTask = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        name,
        xpReward: Number(xpEl.value) || 0,
      };
      drafts[student.id] = [...readDraftFromDom(student.id), newTask];
      renderCard(student);
    });

    const saveBtn = card.querySelector(`[data-save-tasks="${student.id}"]`);
    saveBtn.addEventListener("click", async () => {
      const msg = card.querySelector(`[data-save-msg="${student.id}"]`);
      const tasks = readDraftFromDom(student.id);
      saveBtn.disabled = true;
      saveBtn.textContent = "儲存中...";
      try {
        await saveDailyTasks(student.id, tasks);
        drafts[student.id] = tasks;
        student.dailyTasks = tasks;
        msg.style.color = "var(--good)";
        msg.textContent = "已儲存 ✓";
        saveBtn.textContent = "儲存這位學生的任務清單";
        flashButtonSuccess(saveBtn);
        setTimeout(() => {
          msg.textContent = "";
          msg.style.color = "";
        }, 2500);
      } catch (err) {
        msg.style.color = "var(--bad)";
        msg.textContent = "儲存失敗：" + err.message;
        saveBtn.textContent = "儲存這位學生的任務清單";
      } finally {
        saveBtn.disabled = false;
      }
    });
  }

  wrap.innerHTML = students.map((s) => cardHtml(s)).join("");
  students.forEach((s) => bindCard(s));
})();
