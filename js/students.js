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
        <div style="margin-top:16px; max-width:520px;">
          <label>🎁 願望清單（累計獎金達到金額即可兌換，會顯示在該生的紀錄頁）</label>
          <div data-wishlist-list="${s.id}">
            ${
              (s.wishlist || []).length
                ? s.wishlist
                    .map((item) => {
                      const totalAmt = wishlistItemTotal(item);
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
                    <div style="font-size:12px; margin-top:6px; ${item.redeemedDate ? "color:var(--good);" : ""}" class="${item.redeemedDate ? "" : "text-faint"}">
                      ${item.redeemedDate ? `🎉 已於 ${escapeHtml(item.redeemedDate)} 兌現完成` : "尚未兌現"}
                    </div>
                  </div>
                  <div style="display:flex; flex-direction:column; gap:8px; align-items:flex-end; margin-left:10px;">
                    <span data-wishlist-redeem="${s.id}" data-item-id="${item.id}" style="cursor:pointer; color:var(--brand); font-size:12px; white-space:nowrap;">${item.redeemedDate ? "取消兌換標記" : "標記已兌換"}</span>
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

    // ---- 願望清單：標記／取消標記已兌換（單一合併日期＝解鎖達成並兌現完成的日期）----
    el.querySelectorAll("[data-wishlist-redeem]").forEach((link) => {
      link.addEventListener("click", async () => {
        const id = link.dataset.wishlistRedeem;
        const itemId = link.dataset.itemId;
        const student = students.find((s) => s.id === id);
        const item = (student.wishlist || []).find((it) => it.id === itemId);
        if (!item) return;
        let redeemedDate;
        if (item.redeemedDate) {
          const ok = await confirmDialog("確定要取消這個項目的「已兌換」標記嗎？", {
            title: "取消兌換標記",
            confirmText: "取消標記",
          });
          if (!ok) return;
          redeemedDate = null;
        } else {
          const today = new Date().toISOString().slice(0, 10);
          const input = await promptDateDialog("請選擇兌現完成日期：", today, { title: "標記已兌換" });
          if (input === null) return;
          redeemedDate = input || today;
        }
        // Firestore 陣列元素無法對單一欄位用 FieldValue.delete()，改用手動組出新物件、
        // 直接不帶 redeemedDate 欄位的方式來處理「取消標記」。
        const cleanedWishlist = (student.wishlist || []).map((it) => {
          if (it.id !== itemId) return it;
          const clone = { ...it };
          if (!redeemedDate) {
            delete clone.redeemedDate;
          } else {
            clone.redeemedDate = redeemedDate;
          }
          return clone;
        });
        try {
          await updateStudent(id, { wishlist: cleanedWishlist });
          students = await listStudents();
          renderList();
        } catch (err) {
          alert("更新失敗：" + err.message);
        }
      });
    });
  }

  // 願望項目合計金額（自付＋父母加碼＋其他人加碼）；相容舊資料的單一 amount 欄位
  function wishlistItemTotal(item) {
    if (typeof item.amountSelf === "number" || typeof item.amountParent === "number" || typeof item.amountOther === "number") {
      return (item.amountSelf || 0) + (item.amountParent || 0) + (item.amountOther || 0);
    }
    return item.amount || 0;
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
