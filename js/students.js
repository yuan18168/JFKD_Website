/* students.js — 學生名單管理頁（從獎懲規則設定頁獨立出來） */
(async function () {
  await requireGuard();

  let students = await listStudents();
  renderStudentNav(students, null);
  let editingWishlistItemId = null; // 目前正在編輯的願望項目 id（同時間只能編輯一筆）
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
        <div style="margin-top:16px; max-width:520px;">
          <label>🎁 願望清單（項目、金額、達成條件在這裡管理；達成/未達成/兌現狀態請到該生的「紀錄頁」直接標記）</label>
          <div data-wishlist-list="${s.id}">
            ${
              (s.wishlist || []).length
                ? s.wishlist
                    .map((item) => {
                      if (item.id === editingWishlistItemId) return wishlistEditFormHtml(s.id, item);
                      const totalAmt = wishlistItemTotal(item);
                      // 相容舊資料：舊版只有 redeemedDate、沒有 status 欄位時，視為「達成」而非「進行中」
                      const status = item.status || (item.redeemedDate ? "achieved" : "progress");
                      return `
              <div style="padding:8px 0; border-bottom:1px solid var(--border); font-size:13px;">
                <div class="flex-between" style="align-items:flex-start;">
                  <div style="flex:1;">
                    <div style="font-weight:700;">${escapeHtml(item.name)} <span class="text-faint" style="font-weight:400;">（合計 ${fmtMoney(totalAmt)}）</span></div>
                    ${item.condition ? `<div class="text-faint" style="font-size:12px; margin-top:2px;">🔖 達成條件：${escapeHtml(item.condition)}</div>` : ""}
                    <div style="display:flex; gap:6px; flex-wrap:wrap; margin-top:6px;">
                      ${item.amountSelf > 0 ? `<span class="badge badge-normal">自付 ${fmtMoney(item.amountSelf)}</span>` : ""}
                      ${item.amountParent > 0 ? `<span class="badge badge-normal">父母加碼 ${fmtMoney(item.amountParent)}</span>` : ""}
                      ${item.amountOther > 0 ? `<span class="badge badge-normal">其他人加碼 ${fmtMoney(item.amountOther)}</span>` : ""}
                    </div>
                    <div class="text-faint" style="font-size:12px; margin-top:6px;">
                      目前狀態：${wishlistStatusLabel(status)}${item.redeemedDate ? `（已於 ${escapeHtml(item.redeemedDate)} 兌現）` : ""}
                    </div>
                  </div>
                  <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end; margin-left:10px;">
                    <span data-wishlist-edit="${s.id}" data-item-id="${item.id}" style="cursor:pointer; color:var(--brand); font-size:12px;">編輯</span>
                    <span data-wishlist-del="${s.id}" data-item-id="${item.id}" style="cursor:pointer; color:var(--bad); font-size:12px;">刪除</span>
                  </div>
                </div>
              </div>`;
                    })
                    .join("")
                : '<div class="text-faint" style="font-size:12px; padding:4px 0;">尚未新增任何項目</div>'
            }
          </div>
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:10px; padding:10px; border:1px dashed var(--border); border-radius:10px;">
            <input type="text" placeholder="項目名稱" data-wishlist-name="${s.id}" />
            <input type="text" placeholder="達成所需的特殊條件（選填，例如：連續3次段考進步）" data-wishlist-condition="${s.id}" />
            <div style="display:flex; gap:8px;">
              <input type="number" placeholder="自付金額" min="0" data-wishlist-self="${s.id}" style="flex:1;" />
              <input type="number" placeholder="父母加碼" min="0" data-wishlist-parent="${s.id}" style="flex:1;" />
              <input type="number" placeholder="其他人加碼" min="0" data-wishlist-other="${s.id}" style="flex:1;" />
            </div>
            <button class="btn btn-sm" data-wishlist-add="${s.id}" style="align-self:flex-start;">新增願望項目</button>
          </div>
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

    // ---- 願望清單：新增項目（名稱＋特殊條件＋自付／父母加碼／其他人加碼三種來源金額）----
    el.querySelectorAll("[data-wishlist-add]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.wishlistAdd;
        const nameInput = el.querySelector(`[data-wishlist-name="${id}"]`);
        const conditionInput = el.querySelector(`[data-wishlist-condition="${id}"]`);
        const selfInput = el.querySelector(`[data-wishlist-self="${id}"]`);
        const parentInput = el.querySelector(`[data-wishlist-parent="${id}"]`);
        const otherInput = el.querySelector(`[data-wishlist-other="${id}"]`);
        const name = nameInput.value.trim();
        const condition = conditionInput.value.trim();
        const amountSelf = Number(selfInput.value) || 0;
        const amountParent = Number(parentInput.value) || 0;
        const amountOther = Number(otherInput.value) || 0;
        if (!name) {
          alert("請輸入項目名稱");
          return;
        }
        if (amountSelf <= 0 && amountParent <= 0 && amountOther <= 0) {
          alert("請至少輸入一項大於 0 的金額（自付／父母加碼／其他人加碼）");
          return;
        }
        const student = students.find((s) => s.id === id);
        const newItem = {
          id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
          name,
          condition,
          amountSelf,
          amountParent,
          amountOther,
        };
        const wishlist = [...(student.wishlist || []), newItem];
        btn.disabled = true;
        try {
          await updateStudent(id, { wishlist });
          students = await listStudents();
          renderList();
        } catch (err) {
          alert("新增失敗：" + err.message);
          btn.disabled = false;
        }
      });
    });

    // ---- 願望清單：刪除項目 ----
    el.querySelectorAll("[data-wishlist-del]").forEach((link) => {
      link.addEventListener("click", async () => {
        const id = link.dataset.wishlistDel;
        const itemId = link.dataset.itemId;
        const student = students.find((s) => s.id === id);
        const ok = await confirmDialog("確定要從願望清單移除這個項目嗎？", { title: "移除願望項目", confirmText: "移除" });
        if (!ok) return;
        const wishlist = (student.wishlist || []).filter((item) => item.id !== itemId);
        try {
          await updateStudent(id, { wishlist });
          students = await listStudents();
          renderList();
        } catch (err) {
          alert("移除失敗：" + err.message);
        }
      });
    });

    // ---- 願望清單：進入編輯模式（名稱／達成條件／三種金額來源，達成狀態與兌現日期請到紀錄頁操作）----
    el.querySelectorAll("[data-wishlist-edit]").forEach((link) => {
      link.addEventListener("click", () => {
        editingWishlistItemId = link.dataset.itemId;
        renderList();
      });
    });

    // ---- 願望清單：儲存編輯 ----
    el.querySelectorAll("[data-wishlist-edit-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.wishlistEditSave;
        const itemId = btn.dataset.itemId;
        const nameInput = el.querySelector(`[data-wishlist-edit-name="${itemId}"]`);
        const conditionInput = el.querySelector(`[data-wishlist-edit-condition="${itemId}"]`);
        const selfInput = el.querySelector(`[data-wishlist-edit-self="${itemId}"]`);
        const parentInput = el.querySelector(`[data-wishlist-edit-parent="${itemId}"]`);
        const otherInput = el.querySelector(`[data-wishlist-edit-other="${itemId}"]`);
        const name = nameInput.value.trim();
        const condition = conditionInput.value.trim();
        const amountSelf = Number(selfInput.value) || 0;
        const amountParent = Number(parentInput.value) || 0;
        const amountOther = Number(otherInput.value) || 0;
        if (!name) {
          alert("請輸入項目名稱");
          return;
        }
        if (amountSelf <= 0 && amountParent <= 0 && amountOther <= 0) {
          alert("請至少輸入一項大於 0 的金額（自付／父母加碼／其他人加碼）");
          return;
        }
        const student = students.find((s) => s.id === id);
        const wishlist = (student.wishlist || []).map((it) =>
          it.id === itemId ? { ...it, name, condition, amountSelf, amountParent, amountOther } : it
        );
        btn.disabled = true;
        try {
          await updateStudent(id, { wishlist });
          students = await listStudents();
          editingWishlistItemId = null;
          renderList();
        } catch (err) {
          alert("儲存失敗：" + err.message);
          btn.disabled = false;
        }
      });
    });

    // ---- 願望清單：取消編輯 ----
    el.querySelectorAll("[data-wishlist-edit-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingWishlistItemId = null;
        renderList();
      });
    });
  }

  // 願望項目編輯表單（就地取代顯示列，欄位跟新增表單一致，但預先帶入現有資料）
  function wishlistEditFormHtml(studentId, item) {
    return `
      <div style="display:flex; flex-direction:column; gap:8px; padding:10px 0; border-bottom:1px solid var(--border);">
        <input type="text" placeholder="項目名稱" data-wishlist-edit-name="${item.id}" value="${escapeHtml(item.name || "")}" />
        <input type="text" placeholder="達成所需的特殊條件（選填）" data-wishlist-edit-condition="${item.id}" value="${escapeHtml(item.condition || "")}" />
        <div style="display:flex; gap:8px;">
          <input type="number" placeholder="自付金額" min="0" data-wishlist-edit-self="${item.id}" style="flex:1;" value="${item.amountSelf || ""}" />
          <input type="number" placeholder="父母加碼" min="0" data-wishlist-edit-parent="${item.id}" style="flex:1;" value="${item.amountParent || ""}" />
          <input type="number" placeholder="其他人加碼" min="0" data-wishlist-edit-other="${item.id}" style="flex:1;" value="${item.amountOther || ""}" />
        </div>
        <div style="display:flex; gap:8px;">
          <button class="btn btn-sm btn-primary" data-wishlist-edit-save="${studentId}" data-item-id="${item.id}">儲存</button>
          <button class="btn btn-sm" data-wishlist-edit-cancel="${item.id}">取消</button>
        </div>
      </div>`;
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
