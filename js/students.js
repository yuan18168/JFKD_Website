/* students.js — 學生名單管理頁（從獎懲規則設定頁獨立出來） */
(async function () {
  await requireGuard();

  let students = await listStudents();
  renderStudentNav(students, null);
  renderList();

  function renderList() {
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
        const id = btn.dataset.del;
        const student = students.find((s) => s.id === id);
        const records = await listExamRecords(id);
        const ok = confirm(
          `確定要刪除學生「${student ? student.name : ""}」嗎？這會一併刪除他的 ${records.length} 筆歷史考試紀錄，此動作無法復原。`
        );
        if (!ok) return;
        btn.textContent = "刪除中...";
        await deleteStudentCascade(id);
        students = await listStudents();
        renderList();
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
    renderList();
    renderStudentNav(students, null);
  });
})();
