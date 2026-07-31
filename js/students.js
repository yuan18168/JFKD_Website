/* students.js — 學生名單管理頁（管理「新增／刪除學生」＋個人資料：姓名／學校／班級／座號／年級；
   主題造型已搬到「學生主題造型」頁、許願池已搬到「許願池」頁獨立管理） */
(async function () {
  await requireGuard();
  await requireParentPin();
  await applySiteFontScale();

  const GRADE_OPTIONS = ["", "小一", "小二", "小三", "小四", "小五", "小六", "國一", "國二", "國三", "高一", "高二", "高三"];

  // 【2026-08-01】圖鑑（徽章）重置：測試時常常會不小心解鎖到不是孩子真正達成的徽章，
  // 這裡讓家長可以逐一勾選、移除；移除後如果條件又符合，孩子模式會自動重新判定解鎖。
  // ★ 這行必須在下面第一次呼叫 renderList() 之前宣告（renderList 會用到它），
  //   不然會因為 const 的 TDZ 直接讓整頁噴錯、學生名單頁全白。
  const openBadgePanels = new Set(); // 記住哪些學生的面板是展開的，重畫列表時不要自動收合

  let students = await listStudents();
  renderStudentNav(students, null);
  renderList();

  function unlockedBadgesOf(s) {
    const map = (s && s.badges) || {};
    return BADGES
      .filter((b) => map[b.id])
      .map((b) => ({ ...b, unlockedDate: map[b.id] }))
      .sort((a, b) => (b.unlockedDate || "").localeCompare(a.unlockedDate || ""));
  }

  function badgePanelHtml(s) {
    const list = unlockedBadgesOf(s);
    const open = openBadgePanels.has(s.id);
    return `
      <div style="margin-top:14px; border-top:1px solid var(--border); padding-top:12px;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <span style="font-weight:700; font-size:calc(13px * var(--font-scale,1));">
            🏅 圖鑑管理 <span class="text-faint" style="font-weight:400;">（已解鎖 ${list.length} 個）</span>
          </span>
          <button class="btn btn-sm" data-toggle-badges="${s.id}">${open ? "收合" : "展開"}</button>
        </div>
        <div data-badges-panel="${s.id}" style="display:${open ? "block" : "none"}; margin-top:10px;">
          ${list.length ? `
            <div class="text-faint" style="font-size:calc(11px * var(--font-scale,1)); margin-bottom:8px;">
              勾選要移除的徽章（例如測試時不小心解鎖的），移除後如果條件又符合，孩子模式會自動重新解鎖。
            </div>
            <div style="display:flex; flex-direction:column; gap:6px; max-height:280px; overflow-y:auto;">
              ${list.map((b) => `
                <label style="display:flex; align-items:center; gap:8px; font-size:calc(12px * var(--font-scale,1));">
                  <input type="checkbox" data-badge-check="${s.id}" value="${b.id}" style="width:16px; height:16px; flex-shrink:0; margin:0;" />
                  <span>${b.hidden ? "❓" : b.i}</span>
                  <span style="flex:1;">${escapeHtml(b.hidden ? b.n + "（隱藏版）" : b.n)}</span>
                  <span class="text-faint" style="font-size:calc(10.5px * var(--font-scale,1));">${b.unlockedDate}</span>
                </label>`).join("")}
            </div>
            <button class="btn btn-sm" style="margin-top:10px; color:var(--bad); border-color:var(--bad);" data-remove-badges="${s.id}">移除勾選的徽章</button>
            <span class="text-faint" data-badges-msg="${s.id}" style="margin-left:10px; font-size:calc(12px * var(--font-scale, 1));"></span>
          ` : '<div class="text-faint" style="font-size:calc(12px * var(--font-scale,1));">目前還沒有解鎖任何徽章</div>'}
        </div>
      </div>`;
  }

  function bindBadgePanel(s) {
    const root = document.getElementById("studentList");

    const toggleBtn = root.querySelector(`[data-toggle-badges="${s.id}"]`);
    if (toggleBtn) {
      toggleBtn.addEventListener("click", () => {
        if (openBadgePanels.has(s.id)) openBadgePanels.delete(s.id);
        else openBadgePanels.add(s.id);
        renderList();
      });
    }

    const removeBtn = root.querySelector(`[data-remove-badges="${s.id}"]`);
    if (removeBtn) {
      removeBtn.addEventListener("click", async () => {
        const checked = [...root.querySelectorAll(`[data-badge-check="${s.id}"]:checked`)].map((c) => c.value);
        const msg = root.querySelector(`[data-badges-msg="${s.id}"]`);
        if (!checked.length) {
          msg.style.color = "var(--bad)";
          msg.textContent = "請先勾選要移除的徽章";
          return;
        }
        const ok = await confirmDialog(
          `確定要移除這 ${checked.length} 個徽章嗎？如果之後條件又符合，會自動重新解鎖。`,
          { title: "移除徽章", confirmText: "移除" }
        );
        if (!ok) return;
        removeBtn.disabled = true;
        removeBtn.textContent = "移除中...";
        try {
          await removeBadges(s.id, checked);
          checked.forEach((id) => { if (s.badges) delete s.badges[id]; });
          openBadgePanels.add(s.id);
          renderList();
        } catch (err) {
          msg.style.color = "var(--bad)";
          msg.textContent = "移除失敗：" + err.message;
          removeBtn.disabled = false;
          removeBtn.textContent = "移除勾選的徽章";
        }
      });
    }
  }

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
        ${badgePanelHtml(s)}
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

    students.forEach((s) => bindBadgePanel(s));
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
