/* simulate.js — 試算表：挑一次歷史成績當「上次分數」，試算下次預測分數的獎懲結果。
   純前端試算，不會寫入 Firestore，也不會影響任何歷史紀錄。*/
(async function () {
  await requireGuard();
  await requireParentPin();
  await applySiteFontScale();

  const [students, profiles, settings] = await Promise.all([
    listStudents(),
    listRuleProfiles(),
    getSettings(),
  ]);
  const defaultProfileId = settings.defaultProfileId || profiles[0]?.id || null;

  renderStudentNav(students, null);

  const studentSelectEl = document.getElementById("simStudent");
  const recordSelectEl = document.getElementById("simRecord");
  const profileSelectEl = document.getElementById("simProfile");
  const emptyMsgEl = document.getElementById("simEmptyMsg");
  const tableWrapEl = document.getElementById("simTableWrap");
  const dividerEl = document.getElementById("simDivider");
  const previewEl = document.getElementById("simPreview");
  const resetWrapEl = document.getElementById("simResetWrap");
  const rowsEl = document.getElementById("simRows");

  let studentRecords = [];
  let rules = defaultRules();

  // ---- 學生下拉 ----
  studentSelectEl.innerHTML =
    '<option value="">請選擇學生</option>' +
    students.map((s) => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join("");

  // ---- 設定檔下拉（預設用家庭目前的預設設定檔，可切換）----
  profileSelectEl.innerHTML = profiles
    .map((p) => `<option value="${p.id}">${escapeHtml(p.name || "未命名設定檔")}${p.id === defaultProfileId ? "（預設）" : ""}</option>`)
    .join("");
  profileSelectEl.value = defaultProfileId || (profiles[0] && profiles[0].id) || "";

  function refreshRulesFromSelectedProfile() {
    const profile = profiles.find((p) => p.id === profileSelectEl.value);
    rules = profile ? { ...defaultRules(), ...profile } : defaultRules();
  }
  refreshRulesFromSelectedProfile();

  function schoolLevelLabel(semesterText) {
    const s = (semesterText || "").trim();
    if (s.startsWith("國")) return "國中";
    if (s.startsWith("高")) return "高中";
    return s ? "國小" : "-";
  }

  function showEmptyState() {
    emptyMsgEl.style.display = "block";
    tableWrapEl.style.display = "none";
    dividerEl.style.display = "none";
    resetWrapEl.style.display = "none";
    previewEl.innerHTML = "";
  }

  function showSimulator() {
    emptyMsgEl.style.display = "none";
    tableWrapEl.style.display = "";
    dividerEl.style.display = "block";
    resetWrapEl.style.display = "block";
  }

  showEmptyState();

  // ---- 學生變更：重新載入該學生的成績紀錄清單 ----
  studentSelectEl.addEventListener("change", async () => {
    const studentId = studentSelectEl.value;
    recordSelectEl.innerHTML = "";
    if (!studentId) {
      recordSelectEl.innerHTML = '<option value="">請先選擇學生</option>';
      studentRecords = [];
      showEmptyState();
      return;
    }
    recordSelectEl.innerHTML = '<option value="">載入中...</option>';
    studentRecords = await listExamRecords(studentId);
    if (!studentRecords.length) {
      recordSelectEl.innerHTML = '<option value="">這位學生還沒有任何成績紀錄</option>';
      showEmptyState();
      return;
    }
    recordSelectEl.innerHTML =
      '<option value="">請選擇一次成績</option>' +
      studentRecords
        .map(
          (r, i) =>
            `<option value="${i}">${r.date || "-"}　${escapeHtml(r.semester || "-")}　${escapeHtml(r.examType || "-")}（${schoolLevelLabel(r.semester)}）</option>`
        )
        .join("");
    showEmptyState();
  });

  // ---- 選定一次成績當基準：建立每科的「上次分數」列 ----
  recordSelectEl.addEventListener("change", () => {
    const idx = recordSelectEl.value;
    if (idx === "") {
      showEmptyState();
      return;
    }
    const record = studentRecords[Number(idx)];
    if (!record) {
      showEmptyState();
      return;
    }
    buildRows(record);
    showSimulator();
    updatePreview();
  });

  profileSelectEl.addEventListener("change", () => {
    refreshRulesFromSelectedProfile();
    updatePreview();
  });

  function buildRows(record) {
    rowsEl.innerHTML = "";
    (record.subjects || []).forEach((s) => {
      const row = document.createElement("tr");
      row.dataset.name = s.name;
      row.dataset.prev = s.score;
      row.innerHTML = `
        <td>
          <span class="subject-name-cell">
            <span class="subject-badges"></span>
            <span class="subj-label">${escapeHtml(s.name)}</span>
          </span>
        </td>
        <td class="num text-dim">${s.score}</td>
        <td class="num"><input type="number" class="sim-score" min="0" max="100" value="${s.score}" /></td>
        <td class="num" data-cell="base">–</td>
        <td class="num" data-cell="progress">–</td>
        <td class="num" data-cell="defense">–</td>
        <td class="num" data-cell="subtotal">–</td>
      `;
      rowsEl.appendChild(row);
      const input = row.querySelector(".sim-score");
      input.addEventListener("input", () => {
        validateScoreInput(input);
        updatePreview();
      });
    });
  }

  function validateScoreInput(input) {
    const v = input.value;
    const invalid = v !== "" && (Number(v) < 0 || Number(v) > 100 || Number.isNaN(Number(v)));
    input.classList.toggle("input-error", invalid);
    return !invalid;
  }

  function collectSimSubjects() {
    return [...rowsEl.children]
      .map((row) => ({
        name: row.dataset.name,
        score: Number(row.querySelector(".sim-score").value),
        prevScore: Number(row.dataset.prev),
      }))
      .filter((s) => s.name && !Number.isNaN(s.score));
  }

  function updatePreview() {
    const subjects = collectSimSubjects();
    if (!subjects.length) {
      previewEl.innerHTML = "";
      return;
    }
    const result = calcExamRecord(subjects, rules);

    const rowEls = [...rowsEl.children];
    result.detail.forEach((d, i) => {
      const rowEl = rowEls[i];
      if (!rowEl) return;
      const badgesEl = rowEl.querySelector(".subject-badges");
      if (badgesEl) {
        badgesEl.innerHTML = `<span class="badge badge-${d.tierKey}">${d.tierLabel}</span>`;
      }
      rowEl.querySelector('[data-cell="base"]').textContent = fmtMoney(d.baseBonus);
      rowEl.querySelector('[data-cell="progress"]').textContent = fmtMoney(d.progressBonus);
      rowEl.querySelector('[data-cell="defense"]').textContent = fmtMoney(d.defenseBonus);
      rowEl.querySelector('[data-cell="subtotal"]').textContent = fmtMoney(d.subtotal);
      rowEl.classList.toggle("row-punishment", !!d.punishment);
    });

    previewEl.innerHTML = `
      <div class="flex-between">
        <span>全科加碼：${fmtMoney(result.comboBonus)}</span>
        <span style="font-weight:800; font-size:calc(16px * var(--font-scale, 1));">預估總計：${fmtMoney(result.total)}</span>
      </div>
      ${result.hasPunishment ? `<div class="delta down" style="margin-top:8px;">⚠️ ${result.punishmentSubjects.join("、")} 低於 80 分，若真的考出這個結果，將會觸發處罰機制</div>` : ""}
    `;
  }

  document.getElementById("simResetBtn").addEventListener("click", () => {
    rowsEl.querySelectorAll(".sim-score").forEach((input) => {
      const row = input.closest("tr");
      input.value = row.dataset.prev;
      input.classList.remove("input-error");
    });
    updatePreview();
  });
})();
