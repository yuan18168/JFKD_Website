/* wishlist.js — 許願池獨立管理頁：上方頁籤切換學生，一次只看一位；
   支援新增／編輯／刪除／拖曳排序，以及進行中／達成／未達成三態切換＋標記兌換，
   跟學生紀錄頁的邏輯共用（wishlistItemTotal / wishlistStatusLabel / promptDateDialog / attachDragReorder 都在 nav.js）。 */
(async function () {
  await requireGuard();
  await applySiteFontScale();

  let students = await listStudents();
  renderStudentNav(students, null);

  const params = new URLSearchParams(location.search);
  let activeId = params.get("id") || (students[0] && students[0].id) || null;
  let editingItemId = null; // 目前正在編輯的願望項目 id（同時間只能編輯一筆）

  // 「其他人加碼」多位出資者暫存草稿：新增表單一份、編輯表單一份（同時間只會用到其中一份）。
  // 只在使用者按下「新增項目」button 才由外層的姓名/條件/自付/父母加碼輸入框一起讀取送出，
  // 平常新增/刪除一位出資者只會局部更新這個小工具自己的 DOM，不會動到表單裡其他還沒送出的欄位。
  let newContributorsDraft = [];
  let editContributorsDraft = [];

  renderTabs();
  renderPage();

  // 出資者小計
  function contributorsSum(list) {
    return (list || []).reduce((s, c) => s + (Number(c.amount) || 0), 0);
  }

  // 「其他人加碼」可新增多組名字+金額的小工具，new/edit 表單共用同一套 markup 與綁定邏輯
  function otherContributorsWidgetHtml(prefix, list) {
    return `
      <div data-contrib-widget="${prefix}">
        <label>其他人加碼（可新增多位出資者，自動加總）</label>
        <div data-contrib-list="${prefix}" style="display:flex; flex-direction:column; gap:4px; margin-bottom:6px;">
          ${(list || [])
            .map(
              (c, i) => `
            <div style="display:flex; align-items:center; gap:8px;">
              <span class="text-dim" style="flex:1;">${escapeHtml(c.name || "其他人")}</span>
              <span class="text-faint" style="font-family:var(--mono);">${fmtMoney(c.amount)}</span>
              <span data-contrib-del="${prefix}" data-idx="${i}" style="cursor:pointer; color:var(--bad); font-size:calc(12px * var(--font-scale, 1));">✕</span>
            </div>`
            )
            .join("")}
        </div>
        <div style="display:flex; gap:6px;">
          <input type="text" placeholder="出資者名字" data-contrib-name="${prefix}" style="flex:1;" />
          <input type="number" placeholder="金額" min="0" data-contrib-amount="${prefix}" style="width:100px;" />
          <button type="button" class="btn btn-sm" data-contrib-add="${prefix}">＋新增</button>
        </div>
        <div class="text-faint" style="font-size:calc(12px * var(--font-scale, 1)); margin-top:4px;" data-contrib-total="${prefix}">
          其他人加碼小計：${fmtMoney(contributorsSum(list))}
        </div>
      </div>`;
  }

  // 綁定小工具的「新增一位出資者」／「刪除某一位」事件；draftList 是外層閉包變數（陣列參照），
  // 每次異動只重畫這個小工具自己的 innerHTML，不會影響同一張表單裡其他還在輸入中的欄位。
  function bindOtherContributorsWidget(root, prefix, getDraft, setDraft) {
    const widget = root.querySelector(`[data-contrib-widget="${prefix}"]`);
    if (!widget) return;

    function rerenderWidget() {
      widget.outerHTML = otherContributorsWidgetHtml(prefix, getDraft());
      bindOtherContributorsWidget(root, prefix, getDraft, setDraft);
    }

    const addBtn = widget.querySelector(`[data-contrib-add="${prefix}"]`);
    addBtn.addEventListener("click", () => {
      const nameInput = widget.querySelector(`[data-contrib-name="${prefix}"]`);
      const amountInput = widget.querySelector(`[data-contrib-amount="${prefix}"]`);
      const name = nameInput.value.trim();
      const amount = Number(amountInput.value) || 0;
      if (!name) {
        alert("請輸入出資者名字");
        return;
      }
      if (amount <= 0) {
        alert("請輸入大於 0 的金額");
        return;
      }
      const list = getDraft();
      setDraft([...list, { name, amount }]);
      rerenderWidget();
    });

    widget.querySelectorAll(`[data-contrib-del="${prefix}"]`).forEach((btn) => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const list = getDraft();
        setDraft(list.filter((_, i) => i !== idx));
        rerenderWidget();
      });
    });
  }

  function renderTabs() {
    const el = document.getElementById("wishlistStudentTabs");
    if (!el) return;
    if (!students.length) {
      el.innerHTML = "";
      return;
    }
    el.innerHTML = students
      .map((s) => {
        const active = s.id === activeId ? "active" : "";
        const initial = (s.name || "?").slice(0, 1);
        return `<button type="button" class="student-tab ${active}" data-tab="${s.id}">
          <span class="dot" style="background:${s.color || "#4f7cff"};">${escapeHtml(initial)}</span>
          ${escapeHtml(s.name)}
        </button>`;
      })
      .join("");
    el.querySelectorAll("[data-tab]").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.tab === activeId) return;
        activeId = btn.dataset.tab;
        editingItemId = null;
        renderTabs();
        renderPage();
      });
    });
  }

  function renderPage() {
    const el = document.getElementById("wishlistPage");
    if (!el) return;
    if (!students.length) {
      el.innerHTML = '<div class="card empty-state">尚未新增學生，請至「學生名單」新增</div>';
      return;
    }
    const student = students.find((s) => s.id === activeId) || students[0];
    activeId = student.id;
    const items = student.wishlist || [];
    newContributorsDraft = []; // 每次整頁重繪都是新的一次「新增」表單，其他欄位也會一起重置

    el.innerHTML = `
      ${
        items.length
          ? `<div class="grid grid-cols-3 wishlist-grid" id="wishlistCardGrid">
              ${items.map((item) => (item.id === editingItemId ? wishlistEditCardHtml(item) : wishlistCardHtml(item))).join("")}
            </div>`
          : `<div class="card empty-state" style="margin-bottom:18px;">尚未新增任何願望項目</div><div id="wishlistCardGrid"></div>`
      }

      <div class="card" style="margin-top:4px; max-width:640px;">
        <label>新增願望項目</label>
        <div style="display:flex; flex-direction:column; gap:8px;">
          <input type="text" placeholder="項目名稱" id="wlNewName" />
          <input type="text" placeholder="達成所需的特殊條件（選填，例如：連續3次段考進步）" id="wlNewCondition" />
          <div style="display:flex; gap:8px;">
            <input type="number" placeholder="自付金額" min="0" id="wlNewSelf" style="flex:1;" />
            <input type="number" placeholder="父母加碼" min="0" id="wlNewParent" style="flex:1;" />
          </div>
          ${otherContributorsWidgetHtml("new", newContributorsDraft)}
          <button class="btn btn-primary" id="wlAddBtn" style="align-self:flex-start;">新增願望項目</button>
        </div>
      </div>`;

    bindOtherContributorsWidget(
      el,
      "new",
      () => newContributorsDraft,
      (v) => (newContributorsDraft = v)
    );

    attachDragReorder(document.getElementById("wishlistCardGrid"), ".wishlist-card", async (newIdOrder) => {
      const current = student.wishlist || [];
      const reordered = newIdOrder.map((id) => current.find((it) => it.id === id)).filter(Boolean);
      try {
        await updateStudent(student.id, { wishlist: reordered });
        student.wishlist = reordered;
      } catch (err) {
        alert("排序儲存失敗：" + err.message);
        renderPage();
      }
    });

    bindCardEvents(student);
    bindAddForm(student);
  }

  // 一般顯示模式的卡片：名稱／條件／金額來源／狀態切換／兌換／編輯／刪除
  function wishlistCardHtml(item) {
    const total = wishlistItemTotal(item);
    // 相容舊資料：舊版只有 redeemedDate、沒有 status 欄位時，視為「達成」而非「進行中」
    const status = item.status || (item.redeemedDate ? "achieved" : "progress");
    const redeemed = status === "achieved" && !!item.redeemedDate;
    const cardStateClass = status === "notAchieved" ? "wishlist-not-achieved" : status === "achieved" ? "wishlist-achieved" : "";
    const icon = status === "notAchieved" ? "😅" : redeemed ? "🎉" : "🎁";
    return `
      <div class="card wishlist-card ${cardStateClass}" draggable="true" data-drag-id="${item.id}">
        <div class="score-progress-head">
          <span><span class="wishlist-drag-handle" title="按住拖曳可調整順序">⠿</span> ${icon} ${escapeHtml(item.name)}</span>
          <span class="text-faint">合計 ${fmtMoney(total)}</span>
        </div>
        ${item.condition ? `<div class="text-faint" style="font-size:calc(12px * var(--font-scale, 1)); margin:-4px 0 8px;">🔖 達成條件：${escapeHtml(item.condition)}</div>` : ""}
        <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
          ${item.amountSelf > 0 ? `<span class="badge badge-normal">自付 ${fmtMoney(item.amountSelf)}</span>` : ""}
          ${item.amountParent > 0 ? `<span class="badge badge-normal">父母加碼 ${fmtMoney(item.amountParent)}</span>` : ""}
          ${otherContributorsBadgeHtml(item)}
        </div>

        <div class="wishlist-status-row">
          <span class="text-faint" style="font-size:calc(12px * var(--font-scale, 1));">達成狀態：</span>
          <div class="wishlist-status-btns">
            <button type="button" class="btn btn-sm ${status === "progress" ? "btn-primary" : ""}" data-wishlist-status="${item.id}" data-status="progress">進行中</button>
            <button type="button" class="btn btn-sm ${status === "achieved" ? "btn-primary" : ""}" data-wishlist-status="${item.id}" data-status="achieved">達成</button>
            <button type="button" class="btn btn-sm ${status === "notAchieved" ? "btn-primary" : ""}" data-wishlist-status="${item.id}" data-status="notAchieved">未達成</button>
          </div>
        </div>

        ${status === "notAchieved" ? `<div class="wishlist-sorry-msg">殘念，這次差一點點！下次再挑戰 💪</div>` : ""}

        ${
          status === "achieved"
            ? `<div class="wishlist-redeem-row">
                ${
                  redeemed
                    ? `<span style="font-size:calc(12px * var(--font-scale, 1)); color:var(--good);">🎉 已於 ${escapeHtml(item.redeemedDate)} 兌現完成</span>`
                    : `<button type="button" class="btn btn-sm btn-primary" data-wishlist-redeem="${item.id}">標記已兌換</button>`
                }
              </div>`
            : ""
        }

        <div style="display:flex; gap:12px; margin-top:10px;">
          <span data-wishlist-edit="${item.id}" style="cursor:pointer; color:var(--brand); font-size:calc(12px * var(--font-scale, 1));">編輯</span>
          <span data-wishlist-del="${item.id}" style="cursor:pointer; color:var(--bad); font-size:calc(12px * var(--font-scale, 1));">刪除</span>
        </div>
      </div>`;
  }

  // 編輯模式的卡片：就地取代顯示卡，欄位跟新增表單一致，但預先帶入現有資料（拖曳排序時暫不可拖動這張）。
  // 「其他人加碼」明細：有 otherContributors 陣列就直接帶入；舊資料只有單一 amountOther 數字時，
  // 先自動轉成一筆「其他人 $金額」，使用者之後可以自行改名或再新增其他人，儲存後就會變成正式明細。
  function wishlistEditCardHtml(item) {
    editContributorsDraft =
      Array.isArray(item.otherContributors) && item.otherContributors.length
        ? [...item.otherContributors]
        : item.amountOther > 0
        ? [{ name: "其他人", amount: item.amountOther }]
        : [];
    return `
      <div class="card wishlist-card" data-drag-id="${item.id}">
        <div style="display:flex; flex-direction:column; gap:8px;">
          <input type="text" placeholder="項目名稱" data-edit-name value="${escapeHtml(item.name || "")}" />
          <input type="text" placeholder="達成所需的特殊條件（選填）" data-edit-condition value="${escapeHtml(item.condition || "")}" />
          <div style="display:flex; gap:8px;">
            <input type="number" placeholder="自付金額" min="0" data-edit-self style="flex:1;" value="${item.amountSelf || ""}" />
            <input type="number" placeholder="父母加碼" min="0" data-edit-parent style="flex:1;" value="${item.amountParent || ""}" />
          </div>
          ${otherContributorsWidgetHtml("edit", editContributorsDraft)}
          <div style="display:flex; gap:8px;">
            <button class="btn btn-sm btn-primary" data-wishlist-edit-save="${item.id}">儲存</button>
            <button class="btn btn-sm" data-wishlist-edit-cancel="${item.id}">取消</button>
          </div>
        </div>
      </div>`;
  }

  function bindCardEvents(student) {
    const grid = document.getElementById("wishlistCardGrid");
    if (!grid) return;

    // 目前有一張卡片在編輯模式時，順便把「其他人加碼」小工具的新增/刪除事件接上
    if (editingItemId) {
      bindOtherContributorsWidget(
        grid,
        "edit",
        () => editContributorsDraft,
        (v) => (editContributorsDraft = v)
      );
    }

    // ---- 達成狀態切換：進行中／達成／未達成，三者可自由互相切換 ----
    grid.querySelectorAll("[data-wishlist-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemId = btn.dataset.wishlistStatus;
        const newStatus = btn.dataset.status;
        const wishlist = student.wishlist || [];
        const item = wishlist.find((it) => it.id === itemId);
        if (!item || (item.status || "progress") === newStatus) return;
        const updated = wishlist.map((it) => {
          if (it.id !== itemId) return it;
          const clone = { ...it, status: newStatus };
          // 離開「達成」狀態時，自動清除先前登記的兌現日期，避免狀態與日期兜不起來
          if (newStatus !== "achieved") delete clone.redeemedDate;
          // 記錄狀態改變時間，供學生紀錄頁挑選「最近 3 筆達成/未達成」使用
          if (newStatus === "achieved" || newStatus === "notAchieved") {
            clone.statusUpdatedAt = new Date().toISOString();
          } else {
            delete clone.statusUpdatedAt;
          }
          return clone;
        });
        btn.disabled = true;
        try {
          await updateStudent(student.id, { wishlist: updated });
          student.wishlist = updated;
          renderPage();
        } catch (err) {
          alert("更新失敗：" + err.message);
          btn.disabled = false;
        }
      });
    });

    // ---- 標記已兌換：用自訂日期彈窗，只有「達成」狀態才會出現這顆按鈕 ----
    grid.querySelectorAll("[data-wishlist-redeem]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemId = btn.dataset.wishlistRedeem;
        const today = new Date().toISOString().slice(0, 10);
        const input = await promptDateDialog("請選擇兌現完成日期：", today, { title: "標記已兌換" });
        if (input === null) return;
        const redeemedDate = input || today;
        const wishlist = student.wishlist || [];
        const updated = wishlist.map((it) => (it.id === itemId ? { ...it, redeemedDate } : it));
        try {
          await updateStudent(student.id, { wishlist: updated });
          student.wishlist = updated;
          renderPage();
        } catch (err) {
          alert("更新失敗：" + err.message);
        }
      });
    });

    // ---- 進入編輯模式 ----
    grid.querySelectorAll("[data-wishlist-edit]").forEach((link) => {
      link.addEventListener("click", () => {
        editingItemId = link.dataset.wishlistEdit;
        renderPage();
      });
    });

    // ---- 刪除項目 ----
    grid.querySelectorAll("[data-wishlist-del]").forEach((link) => {
      link.addEventListener("click", async () => {
        const itemId = link.dataset.wishlistDel;
        const ok = await confirmDialog("確定要從許願池移除這個項目嗎？", { title: "移除願望項目", confirmText: "移除" });
        if (!ok) return;
        const wishlist = (student.wishlist || []).filter((it) => it.id !== itemId);
        try {
          await updateStudent(student.id, { wishlist });
          student.wishlist = wishlist;
          renderPage();
        } catch (err) {
          alert("移除失敗：" + err.message);
        }
      });
    });

    // ---- 儲存編輯 ----
    grid.querySelectorAll("[data-wishlist-edit-save]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemId = btn.dataset.wishlistEditSave;
        const card = btn.closest(".wishlist-card");
        const name = card.querySelector("[data-edit-name]").value.trim();
        const condition = card.querySelector("[data-edit-condition]").value.trim();
        const amountSelf = Number(card.querySelector("[data-edit-self]").value) || 0;
        const amountParent = Number(card.querySelector("[data-edit-parent]").value) || 0;
        const amountOther = contributorsSum(editContributorsDraft);
        if (!name) {
          alert("請輸入項目名稱");
          return;
        }
        if (amountSelf <= 0 && amountParent <= 0 && amountOther <= 0) {
          alert("請至少輸入一項大於 0 的金額（自付／父母加碼／其他人加碼）");
          return;
        }
        const otherContributors = editContributorsDraft.filter((c) => c && c.name && c.amount > 0);
        const wishlist = (student.wishlist || []).map((it) => {
          if (it.id !== itemId) return it;
          // 注意：wishlist 是陣列欄位，整包覆寫，陣列元素內不可使用 FieldValue.delete()，
          // 所以這裡用「淺拷貝 + delete 屬性」的方式移除 otherContributors，而不是塞入刪除哨兵值。
          const next = { ...it, name, condition, amountSelf, amountParent, amountOther };
          if (otherContributors.length) {
            next.otherContributors = otherContributors;
          } else {
            delete next.otherContributors;
          }
          return next;
        });
        btn.disabled = true;
        try {
          await updateStudent(student.id, { wishlist });
          student.wishlist = wishlist;
          editingItemId = null;
          renderPage();
        } catch (err) {
          alert("儲存失敗：" + err.message);
          btn.disabled = false;
        }
      });
    });

    // ---- 取消編輯 ----
    grid.querySelectorAll("[data-wishlist-edit-cancel]").forEach((btn) => {
      btn.addEventListener("click", () => {
        editingItemId = null;
        renderPage();
      });
    });
  }

  function bindAddForm(student) {
    const btn = document.getElementById("wlAddBtn");
    if (!btn) return;
    btn.addEventListener("click", async () => {
      const name = document.getElementById("wlNewName").value.trim();
      const condition = document.getElementById("wlNewCondition").value.trim();
      const amountSelf = Number(document.getElementById("wlNewSelf").value) || 0;
      const amountParent = Number(document.getElementById("wlNewParent").value) || 0;
      const amountOther = contributorsSum(newContributorsDraft);
      if (!name) {
        alert("請輸入項目名稱");
        return;
      }
      if (amountSelf <= 0 && amountParent <= 0 && amountOther <= 0) {
        alert("請至少輸入一項大於 0 的金額（自付／父母加碼／其他人加碼）");
        return;
      }
      const otherContributors = newContributorsDraft.filter((c) => c && c.name && c.amount > 0);
      const newItem = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
        name,
        condition,
        amountSelf,
        amountParent,
        amountOther,
        ...(otherContributors.length ? { otherContributors } : {}),
      };
      const wishlist = [...(student.wishlist || []), newItem];
      btn.disabled = true;
      try {
        await updateStudent(student.id, { wishlist });
        student.wishlist = wishlist;
        newContributorsDraft = [];
        renderPage();
      } catch (err) {
        alert("新增失敗：" + err.message);
        btn.disabled = false;
      }
    });
  }
})();
