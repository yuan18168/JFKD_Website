/* effects.js — 特效設定頁：4 條觸發規則各自搭配素材庫、播放秒數、觸發方式 */
(async function () {
  await requireGuard();

  const [students, settings] = await Promise.all([listStudents(), getEffectSettings()]);
  renderStudentNav(students, null);

  const RULE_KEYS = ["final100", "both", "defense", "progress"]; // 顯示順序：優先層級高的排前面
  const RULE_DESC = {
    final100: "只看該科目「最新一次紀錄」是不是剛好 100 分，不需要同時進步或衛冕。優先層級最高。",
    both: "該科目最新一次紀錄同時符合「有進步」且「有衛冕」（連續兩次都 ≥ 90 分）。",
    defense: "該科目最新一次紀錄「有衛冕」：這次和上一次都 ≥ 90 分。",
    progress: "該科目最新一次紀錄「有進步」：分數比上一次高。",
  };

  const container = document.getElementById("ruleCards");
  container.innerHTML = RULE_KEYS.map((key) => {
    const rule = settings[key];
    const effectOptions = EFFECT_CATALOG.map(
      (e) => `<option value="${e.id}" ${rule.effect === e.id ? "selected" : ""}>${e.label}</option>`
    ).join("");
    return `
      <div class="card" style="margin-bottom:14px;" data-rule="${key}">
        <div class="flex-between" style="margin-bottom:6px;">
          <div style="font-weight:700; font-size:15px;">${EFFECT_RULE_LABELS[key]}</div>
          <label style="display:flex; align-items:center; gap:6px; margin:0; font-size:12px; color:var(--text-dim); cursor:pointer;">
            <input type="checkbox" data-field="enabled" data-rule="${key}" style="width:auto;" ${rule.enabled ? "checked" : ""} />
            啟用這條規則
          </label>
        </div>
        <div class="text-faint" style="font-size:12px; margin-bottom:12px;">${RULE_DESC[key]}</div>
        <div class="grid grid-cols-3">
          <div>
            <label>播放素材</label>
            <select data-field="effect" data-rule="${key}">${effectOptions}</select>
          </div>
          <div>
            <label>播放秒數</label>
            <input type="number" min="0.5" max="30" step="0.5" data-field="durationSec" data-rule="${key}" value="${(rule.duration / 1000).toFixed(1)}" />
          </div>
          <div>
            <label>觸發方式</label>
            <select data-field="trigger" data-rule="${key}">
              <option value="auto" ${rule.trigger === "auto" ? "selected" : ""}>自動（桌面滑鼠移入／觸控點一下）</option>
              <option value="hover" ${rule.trigger === "hover" ? "selected" : ""}>強制：滑鼠移入</option>
              <option value="click" ${rule.trigger === "click" ? "selected" : ""}>強制：點擊</option>
            </select>
          </div>
        </div>
      </div>`;
  }).join("");

  function readForm() {
    const result = {};
    RULE_KEYS.forEach((key) => {
      const card = container.querySelector(`[data-rule="${key}"]`);
      const enabled = card.querySelector('[data-field="enabled"]').checked;
      const effect = card.querySelector('[data-field="effect"]').value;
      const durationSec = Number(card.querySelector('[data-field="durationSec"]').value) || 2;
      const trigger = card.querySelector('[data-field="trigger"]').value;
      result[key] = { enabled, effect, duration: Math.round(durationSec * 1000), trigger };
    });
    return result;
  }

  document.getElementById("saveEffectsBtn").addEventListener("click", async () => {
    const btn = document.getElementById("saveEffectsBtn");
    const msg = document.getElementById("effectsSaveMsg");
    btn.disabled = true;
    btn.textContent = "儲存中...";
    try {
      await saveEffectSettings(readForm());
      btn.textContent = "儲存特效設定";
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
      btn.textContent = "儲存特效設定";
    } finally {
      btn.disabled = false;
    }
  });
})();
