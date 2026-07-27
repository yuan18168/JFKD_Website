/* students.js — 學生名單管理頁（從獎懲規則設定頁獨立出來） */
(async function () {
  await requireGuard();

  let students = await listStudents();
  renderStudentNav(students, null);
  renderList();

  function renderList() {
    const el = document.getElementById("studentList");
    if (!students.length) {
      el.innerHTML = '<div class="card empty-state">尚未新增任何學生</div>';
      return;
    }
    el.innerHTML = students
      .map(
        (s) => `
      <div class="card" style="margin-bottom:12px;">
        <div class="flex-between">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:26px;height:26px;border-radius:50%;background:${s.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#08122e;">${(s.name || "?").slice(0, 1)}</span>
            <span style="font-weight:700; font-size:15px;">${escapeHtml(s.name)}</span>
          </div>
          <span data-del="${s.id}" style="cursor:pointer; color:var(--bad); font-size:13px;">刪除</span>
        </div>
        <div style="margin-top:12px; max-width:280px;">
          <label>專屬主題造型</label>
          <select data-theme-select="${s.id}">
            <option value="">無主題（標準樣式）</option>
            ${Object.values(STUDENT_THEMES)
              .map(
                (t) =>
                  `<option value="${t.id}" ${s.themeId === t.id ? "selected" : ""}>${escapeHtml(t.name)}</option>`
              )
              .join("")}
          </select>
        </div>
      </div>`
      )
      .join("");

    el.querySelectorAll("[data-del]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.del;
        const student = students.find((s) => s.id === id);
        const records = await listExamRecords(id);
        const ok = await confirmDialog(
          `確定要刪除學生「${student ? student.name : ""}」嗎？這會一併刪除他的 ${records.length} 筆歷史考試紀錄，此動作無法復原。`,
          { title: "刪除學生", confirmText: "刪除" }
        );
        if (!ok) return;
        btn.textContent = "刪除中...";
        await deleteStudentCascade(id);
        students = await listStudents();
        renderList();
        renderStudentNav(students, null);
      });
    });

    el.querySelectorAll("[data-theme-select]").forEach((select) => {
      select.addEventListener("change", async () => {
        const id = select.dataset.themeSelect;
        select.disabled = true;
        try {
          if (select.value) {
            await updateStudent(id, { themeId: select.value });
          } else {
            await updateStudent(id, { themeId: firebase.firestore.FieldValue.delete() });
          }
          students = await listStudents();
          flashSelectSuccess(select);
        } catch (err) {
          alert("更新主題失敗：" + err.message);
        } finally {
          select.disabled = false;
        }
      });
    });
  }

  // 主題下拉選單儲存成功時，邊框短暫變綠色提示「已儲存」
  function flashSelectSuccess(select) {
    select.classList.add("select-flash-success");
    setTimeout(() => select.classList.remove("select-flash-success"), 1200);
  }

  document.getElementById("addStudentBtn").addEventListener("click", async () => {
    const input = document.getElementById("newStudentName");
    const btn = document.getElementById("addStudentBtn");
    const name = input.value.trim();
    if (!name) return;
    btn.disabled = true;
    await addStudent(name);
    input.value = "";
    students = await listStudents();
    renderList();
    renderStudentNav(students, null);
    btn.disabled = false;
    flashButtonSuccess(btn, "已新增 ✓");
  });
})();
