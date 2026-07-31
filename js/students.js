/* students.js — 學生名單管理頁（管理「新增／刪除學生」＋個人資料：姓名／學校／班級／座號／年級；
   主題造型已搬到「學生主題造型」頁、許願池已搬到「許願池」頁獨立管理） */
(async function () {
  await requireGuard();
  await requireParentPin();
  await applySiteFontScale();

  const GRADE_OPTIONS = ["", "小一", "小二", "小三", "小四", "小五", "小六", "國一", "國二", "國三", "高一", "高二", "高三"];

  let students = await listStudents();
  renderStudentNav(students, null);
  renderList();

  function profileFormHtml(s) {
    return `
      <div class="grid grid-cols-2" style="margin-top:12px; gap:10px 14px;" data-profile-form="${s.id}">
        <div>
          <label style="font-size:calc(11px * var(--font-scale,1));">姓名</label>
          <input type="text" data-f-name value="${escapeHtml(s.name || "")}" />
        </div>
        <div>
          <label style="font-size:calc(11px * var(--font-scale,1));">年級</label>
          <select data-f-grade>
            ${GRADE_OPTIONS.map((g) => `<option value="${g}" ${s.grade === g ? "selected" : ""}>${g || "（未設定）"}</option>`).join("")}
          </select>
        </div>
        <div>
          <label style="font-size:calc(11px * var(--font-scale,1));">學校</label>
          <input type="text" data-f-school value="${escapeHtml(s.schoolName || "")}" placeholder="例如：陽光國小" />
        </div>
        <div style="display:flex; gap:10px;">
          <div style="flex:1;">
            <label style="font-size:calc(11px * var(--font-scale,1));">班級</label>
            <input type="text" data-f-class value="${escapeHtml(s.className || "")}" placeholder="例如：302" />
          </div>
          <div style="flex:1;">
            <label style="font-size:calc(11px * var(--font-scale,1));">座號</label>
            <input type="text" data-f-seat value="${escapeHtml(s.seatNumber || "")}" placeholder="例如：15" />
          </div>
        </div>
      </div>
      <div style="margin-top:12px; display:flex; align-items:center; gap:10px;">
        <button class="btn btn-primary btn-sm" data-save-profile="${s.id}">儲存資料</button>
        <span class="text-faint" data-profile-msg="${s.id}" style="font-size:calc(12px * var(--font-scale, 1));"></span>
      </div>`;
  }

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
            <span style="width:26px;height:26px;border-radius:50%;background:${s.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:calc(12px * var(--font-scale, 1));font-weight:700;color:#08122e;">${(s.name || "?").slice(0, 1)}</span>
            <span style="font-weight:700; font-size:calc(15px * var(--font-scale, 1));">${escapeHtml(s.name)}</span>
          </div>
          <span data-del="${s.id}" style="cursor:pointer; color:var(--bad); font-size:calc(13px * var(--font-scale, 1));">刪除</span>
        </div>
        ${profileFormHtml(s)}
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

    el.querySelectorAll("[data-save-profile]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.saveProfile;
        const form = el.querySelector(`[data-profile-form="${id}"]`);
        const msg = el.querySelector(`[data-profile-msg="${id}"]`);
        const name = form.querySelector("[data-f-name]").value.trim();
        if (!name) {
          msg.style.color = "var(--bad)";
          msg.textContent = "姓名不能空白";
          return;
        }
        const fields = {
          name,
          grade: form.querySelector("[data-f-grade]").value,
          schoolName: form.querySelector("[data-f-school]").value.trim(),
          className: form.querySelector("[data-f-class]").value.trim(),
          seatNumber: form.querySelector("[data-f-seat]").value.trim(),
        };
        btn.disabled = true;
        btn.textContent = "儲存中...";
        try {
          await updateStudent(id, fields);
          const s = students.find((x) => x.id === id);
          if (s) Object.assign(s, fields);
          msg.style.color = "var(--good)";
          msg.textContent = "已儲存 ✓";
          flashButtonSuccess(btn, "儲存資料");
          renderStudentNav(students, null);
          setTimeout(() => { msg.textContent = ""; }, 2500);
        } catch (err) {
          msg.style.color = "var(--bad)";
          msg.textContent = "儲存失敗：" + err.message;
          btn.textContent = "儲存資料";
        } finally {
          btn.disabled = false;
        }
      });
    });
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
