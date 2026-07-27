/* config.js — 獎懲規則設定頁（多設定檔版本） */
(async function () {
  await requireGuard();

  const students = await listStudents();
  renderStudentNav(students, null);

  // 第一次使用（尚未有任何設定檔）時，把舊版單一 config/rules 遷移成第一個設定檔
  await migrateLegacyRulesToProfile();

  let profiles = await listRuleProfiles();
  let settings = await getSettings();
  let selectedProfileId = settings.defaultProfileId && profiles.some((p) => p.id === settings.defaultProfileId)
    ? settings.defaultProfileId
    : profiles[0]?.id || null;
  let rules = null; // 目前畫面上正在編輯的設定檔內容

  renderProfileChips();
  loadSelectedProfileIntoForm();

  // ---- 設定檔 chip 列 ----
  function renderProfileChips() {
    const el = document.getElementById("profileChips");
    if (!profiles.length) {
      el.innerHTML = '<span class="text-faint" style="font-size:13px;">尚未建立任何設定檔</span>';
      return;
    }
    el.innerHTML = profiles
      .map((p) => {
        const isDefault = p.id === settings.defaultProfileId;
        const isActive = p.id === selectedProfileId;
        return `<span class="chip ${isActive ? "active" : ""}" data-profile="${p.id}" style="cursor:pointer;">
          ${escapeHtml(p.name || "未命名設定檔")}${isDefault ? ' <span style="color:var(--good);">★預設</span>' : ""}
        </span>`;
      })
      .join("");
    el.querySelectorAll("[data-profile]").forEach((chip) => {
      chip.addEventListener("click", () => {
        selectedProfileId = chip.dataset.profile;
        renderProfileChips();
        loadSelectedProfileIntoForm();
      });
    });
    updateProfileHint();
  }

  function updateProfileHint() {
    const hintEl = document.getElementById("profileHint");
    const count = profiles.length;
    hintEl.textContent =
      count <= 1
        ? "目前只有一個設定檔，無法刪除；新增紀錄時會自動套用這個設定檔。"
        : "新增考試紀錄時，會自動套用「★預設」設定檔；已存在的紀錄不受新增/切換預設檔影響，除非在編輯畫面手動更換。";
  }

  function loadSelectedProfileIntoForm() {
    const profile = profiles.find((p) => p.id === selectedProfileId);
    rules = profile ? { ...defaultRules(), ...profile } : defaultRules();
    document.getElementById("editingProfileName").textContent = profile ? profile.name || "未命名設定檔" : "-";
    renderTiersTable();
    renderComboRows("combo3Rows", "comboBonus3");
    renderComboRows("combo5Rows", "comboBonus5");
    document.getElementById("progressPerPoint").value = rules.progressBonusPerPoint;
    document.getElementById("punishmentText").value = rules.punishmentText || "";
  }

  // ---- 新增設定檔（複製目前選取設定檔的內容）----
  document.getElementById("addProfileBtn").addEventListener("click", async () => {
    const nameInput = document.getElementById("newProfileName");
    const name = nameInput.value.trim();
    if (!name) {
      alert("請輸入新設定檔的名稱");
      return;
    }
    const base = profiles.find((p) => p.id === selectedProfileId) || defaultRules();
    const { id, name: _n, createdAt, ...baseRules } = base;
    const ref = await addRuleProfile({ name, ...baseRules });
    nameInput.value = "";
    profiles = await listRuleProfiles();
    selectedProfileId = ref.id;
    renderProfileChips();
    loadSelectedProfileIntoForm();
  });

  // ---- 設為家庭預設 ----
  document.getElementById("setDefaultProfileBtn").addEventListener("click", async () => {
    if (!selectedProfileId) return;
    await setDefaultRuleProfileId(selectedProfileId);
    settings = await getSettings();
    renderProfileChips();
  });

  // ---- 刪除設定檔 ----
  document.getElementById("deleteProfileBtn").addEventListener("click", async () => {
    if (!selectedProfileId) return;
    if (profiles.length <= 1) {
      alert("至少要保留一個設定檔，無法刪除最後一個。");
      return;
    }
    const profile = profiles.find((p) => p.id === selectedProfileId);
    const wasDefault = profile && profile.id === settings.defaultProfileId;
    const ok = await confirmDialog(
      `確定要刪除設定檔「${profile ? profile.name : ""}」嗎？已套用這個設定檔的歷史紀錄不會被刪除，會自動改用家庭預設設定檔的數值。此動作無法復原。`,
      { title: "刪除設定檔", confirmText: "刪除" }
    );
    if (!ok) {
      return;
    }
    await deleteRuleProfile(selectedProfileId);
    profiles = await listRuleProfiles();
    if (wasDefault && profiles.length) {
      await setDefaultRuleProfileId(profiles[0].id);
      settings = await getSettings();
    }
    selectedProfileId = profiles[0]?.id || null;
    renderProfileChips();
    loadSelectedProfileIntoForm();
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

  // ---- 儲存目前選取的設定檔 ----
  document.getElementById("saveRulesBtn").addEventListener("click", async () => {
    if (!selectedProfileId) {
      alert("請先新增一個設定檔");
      return;
    }
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
    msg.style.color = "";
    msg.textContent = "儲存中...";
    try {
      await updateRuleProfile(selectedProfileId, updated);
      profiles = await listRuleProfiles();
      rules = { ...rules, ...updated };
      flashButtonSuccess(btn);
      msg.style.color = "var(--good)";
      msg.textContent = "已儲存 ✓";
      setTimeout(() => {
        msg.textContent = "";
        msg.style.color = "";
      }, 2500);
    } catch (err) {
      msg.style.color = "var(--bad)";
      msg.textContent = "儲存失敗：" + err.message;
    } finally {
      btn.disabled = false;
    }
  });
})();
