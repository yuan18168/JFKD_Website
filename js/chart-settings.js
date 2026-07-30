/* chart-settings.js — 圖表顯示設定：全域預設 + 每位學生可個別覆寫 */
(async function () {
  await requireGuard();
  await requireParentPin();
  await applySiteFontScale();

  const [students, globalSettings] = await Promise.all([listStudents(), getChartSettings()]);
  renderStudentNav(students, null);

  // ---- 圖表相關設定：全域預設 ----
  const gYMin = document.getElementById("gYMin");
  const gYMax = document.getElementById("gYMax");
  const gXCount = document.getElementById("gXCount");
  const gXCountLabel = document.getElementById("gXCountLabel");
  const gShowPointLabels = document.getElementById("gShowPointLabels");

  function fillForm(values, els) {
    els.yMin.value = values.yMin;
    els.yMax.value = values.yMax;
    els.xCount.value = values.xCount;
    els.showPointLabels.value = String(!!values.showPointLabels);
    updateXCountLabel(els.xCount, els.xCountLabel);
  }

  function readForm(els) {
    return {
      yMin: Number(els.yMin.value),
      yMax: Number(els.yMax.value),
      xCount: Number(els.xCount.value),
      showPointLabels: els.showPointLabels.value === "true",
    };
  }

  function updateXCountLabel(input, labelEl) {
    const v = Number(input.value);
    labelEl.textContent = v === 0 ? "全部" : `近 ${v} 筆`;
  }

  const globalEls = { yMin: gYMin, yMax: gYMax, xCount: gXCount, xCountLabel: gXCountLabel, showPointLabels: gShowPointLabels };
  fillForm(globalSettings, globalEls);
  gXCount.addEventListener("input", () => updateXCountLabel(gXCount, gXCountLabel));

  // ---- 整體設定：全站字體大小（單一全域設定，不分學生）----
  const siteFontScaleEl = document.getElementById("siteFontScale");
  siteFontScaleEl.value = window.SITE_FONT_SCALE || "md";
  document.getElementById("saveFontScaleBtn").addEventListener("click", async () => {
    const btn = document.getElementById("saveFontScaleBtn");
    const msg = document.getElementById("fontScaleSaveMsg");
    btn.disabled = true;
    btn.textContent = "儲存中...";
    try {
      await saveSiteFontScale(siteFontScaleEl.value);
      await applySiteFontScale();
      msg.style.color = "var(--good)";
      msg.textContent = "已儲存 ✓";
      btn.textContent = "儲存整體設定";
      flashButtonSuccess(btn);
      setTimeout(() => {
        msg.textContent = "";
        msg.style.color = "";
      }, 2500);
    } catch (err) {
      msg.style.color = "var(--bad)";
      msg.textContent = "儲存失敗：" + err.message;
      btn.textContent = "儲存整體設定";
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("saveGlobalBtn").addEventListener("click", async () => {
    const btn = document.getElementById("saveGlobalBtn");
    const msg = document.getElementById("globalSaveMsg");
    btn.disabled = true;
    btn.textContent = "儲存中...";
    try {
      await saveChartSettings(readForm(globalEls));
      msg.style.color = "var(--good)";
      msg.textContent = "已儲存 ✓";
      btn.textContent = "儲存全域預設";
      flashButtonSuccess(btn);
      setTimeout(() => {
        msg.textContent = "";
        msg.style.color = "";
      }, 2500);
    } catch (err) {
      msg.style.color = "var(--bad)";
      msg.textContent = "儲存失敗：" + err.message;
      btn.textContent = "儲存全域預設";
    } finally {
      btn.disabled = false;
    }
  });

  // ---- 個別學生覆寫 ----
  const overridesEl = document.getElementById("studentOverrides");
  if (!students.length) {
    overridesEl.innerHTML = '<div class="empty-state">尚未新增學生，請至「學生名單」新增</div>';
    return;
  }

  overridesEl.innerHTML = students
    .map(
      (s) => `
      <div class="card" style="margin-bottom:14px;" data-student-card="${s.id}">
        <div class="flex-between" style="margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:10px;">
            <span style="width:22px;height:22px;border-radius:50%;background:${s.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:calc(11px * var(--font-scale, 1));font-weight:700;color:#08122e;">${(s.name || "?").slice(0, 1)}</span>
            <span style="font-weight:700;">${escapeHtml(s.name)}</span>
          </div>
          <label style="display:flex; align-items:center; gap:6px; margin:0; font-size:calc(12px * var(--font-scale, 1)); color:var(--text-dim); cursor:pointer;">
            <input type="checkbox" data-use-custom="${s.id}" style="width:auto;" />
            使用自訂設定（不勾選則套用全域預設）
          </label>
        </div>
        <div data-custom-fields="${s.id}" style="display:none;">
          <div class="grid grid-cols-2">
            <div>
              <label>Y 軸最小值</label>
              <input type="number" min="0" max="100" data-field="yMin" data-student="${s.id}" />
            </div>
            <div>
              <label>Y 軸最大值</label>
              <input type="number" min="0" max="100" data-field="yMax" data-student="${s.id}" />
            </div>
          </div>
          <div style="margin-top:14px;">
            <label>X 軸顯示筆數：<span data-xcount-label="${s.id}" class="text-dim"></span></label>
            <input type="range" min="0" max="30" step="1" data-field="xCount" data-student="${s.id}" />
          </div>
          <div style="margin-top:14px; max-width:280px;">
            <label>點位分數顯示</label>
            <select data-field="showPointLabels" data-student="${s.id}">
              <option value="false">滑鼠悉停才顯示（預設）</option>
              <option value="true">一律直接顯示分數</option>
            </select>
          </div>
        </div>
        <div style="margin-top:16px;">
          <button class="btn btn-primary" data-save-student="${s.id}">儲存這位學生的設定</button>
          <span class="text-faint" style="margin-left:10px; font-size:calc(12px * var(--font-scale, 1));" data-save-msg="${s.id}"></span>
        </div>
      </div>`
    )
    .join("");

  students.forEach((s) => {
    const hasOverride = !!s.chartOverride;
    const checkbox = overridesEl.querySelector(`[data-use-custom="${s.id}"]`);
    const fieldsWrap = overridesEl.querySelector(`[data-custom-fields="${s.id}"]`);
    const els = {
      yMin: overridesEl.querySelector(`[data-field="yMin"][data-student="${s.id}"]`),
      yMax: overridesEl.querySelector(`[data-field="yMax"][data-student="${s.id}"]`),
      xCount: overridesEl.querySelector(`[data-field="xCount"][data-student="${s.id}"]`),
      xCountLabel: overridesEl.querySelector(`[data-xcount-label="${s.id}"]`),
      showPointLabels: overridesEl.querySelector(`[data-field="showPointLabels"][data-student="${s.id}"]`),
    };

    checkbox.checked = hasOverride;
    fieldsWrap.style.display = hasOverride ? "block" : "none";
    fillForm(hasOverride ? { ...defaultChartSettings(), ...globalSettings, ...s.chartOverride } : { ...defaultChartSettings(), ...globalSettings }, els);

    checkbox.addEventListener("change", () => {
      fieldsWrap.style.display = checkbox.checked ? "block" : "none";
    });
    els.xCount.addEventListener("input", () => updateXCountLabel(els.xCount, els.xCountLabel));

    const saveBtn = overridesEl.querySelector(`[data-save-student="${s.id}"]`);
    saveBtn.addEventListener("click", async () => {
      const msg = overridesEl.querySelector(`[data-save-msg="${s.id}"]`);
      saveBtn.disabled = true;
      saveBtn.textContent = "儲存中...";
      try {
        if (checkbox.checked) {
          await updateStudent(s.id, { chartOverride: readForm(els) });
        } else {
          await updateStudent(s.id, { chartOverride: firebase.firestore.FieldValue.delete() });
        }
        saveBtn.textContent = "儲存這位學生的設定";
        flashButtonSuccess(saveBtn);
        msg.style.color = "var(--good)";
        msg.textContent = "已儲存 ✓";
        setTimeout(() => {
          msg.textContent = "";
          msg.style.color = "";
        }, 2500);
      } catch (err) {
        msg.style.color = "var(--bad)";
        msg.textContent = "儲存失敗：" + err.message;
        saveBtn.textContent = "儲存這位學生的設定";
      } finally {
        saveBtn.disabled = false;
      }
    });
  });
})();

/* ---------- 家長模式 PIN 碼設定（2026-07-31 新增）----------
   存在 config/settings.parentPin，預設 1234。只接受 4 位數字。 */
(async function setupParentPin() {
  const input = document.getElementById("parentPinInput");
  const btn = document.getElementById("saveParentPinBtn");
  const msg = document.getElementById("parentPinMsg");
  if (!input || !btn) return;

  try {
    input.value = await getParentPin();
  } catch (e) {
    input.value = "1234";
  }

  btn.addEventListener("click", async () => {
    const val = (input.value || "").trim();
    if (!/^\d{4}$/.test(val)) {
      msg.style.color = "var(--bad)";
      msg.textContent = "請輸入 4 位數字";
      return;
    }
    btn.disabled = true;
    const original = btn.textContent;
    btn.textContent = "儲存中...";
    try {
      await saveParentPin(val);
      msg.style.color = "var(--good)";
      msg.textContent = "已儲存 ✓";
      flashButtonSuccess(btn);
      setTimeout(() => { msg.textContent = ""; msg.style.color = ""; }, 2500);
    } catch (err) {
      msg.style.color = "var(--bad)";
      msg.textContent = "儲存失敗：" + err.message;
    } finally {
      btn.disabled = false;
      btn.textContent = original;
    }
  });
})();
