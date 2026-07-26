/* student.js — 學生詳細頁：紀錄列表、趨勢圖、新增紀錄表單 */
(async function () {
  await requireGuard();

  const params = new URLSearchParams(window.location.search);
  const studentId = params.get("id");

  if (!studentId) {
    document.getElementById("studentName").textContent = "找不到學生";
    return;
  }

  const [student, students, rules, records] = await Promise.all([
    getStudent(studentId),
    listStudents(),
    getRules(),
    listExamRecords(studentId),
  ]);

  renderStudentNav(students, studentId);

  if (!student) {
    document.getElementById("studentName").textContent = "找不到這位學生";
    return;
  }

  document.getElementById("studentName").textContent = student.name;
  document.getElementById("studentMeta").textContent = `${records.length} 筆歷史紀錄`;

  const enriched = records.map((r) => {
    const result = calcExamRecord(r.subjects || [], rules);
    const total = typeof r.manualOverrideTotal === "number" ? r.manualOverrideTotal : result.total;
    return { ...r, result, total };
  });

  renderStats(enriched);
  renderChart(enriched);
  renderTable(enriched);
  setupForm(rules, student);

  // ------------------------------------------------------------------
  function renderStats(rows) {
    const totalBonus = rows.reduce((a, r) => a + r.total, 0);
    const recent5 = rows.slice(0, 5);
    const avgRecent = recent5.length
      ? Math.round((recent5.reduce((a, r) => a + r.result.avgScore, 0) / recent5.length) * 10) / 10
      : "-";
    // 累計處罰次數：歷史全部觸發處罰的次數（不論後來是否已執行完畢）
    const punishCount = rows.filter((r) => r.result.hasPunishment).length;
    // 累計進步次數：所有紀錄中，各科目相較上次分數有進步（progressBonus > 0）的總次數
    const progressCount = rows.reduce(
      (acc, r) => acc + (r.result.detail || []).filter((d) => d.progressBonus > 0).length,
      0
    );
    // 累計衛冕次數：所有紀錄中，各科目守住上次高分級距（defenseBonus > 0）的總次數
    const defenseCount = rows.reduce(
      (acc, r) => acc + (r.result.detail || []).filter((d) => d.defenseBonus > 0).length,
      0
    );
    // 連續正常紀錄：從最新一筆往回算，連續多少筆沒有觸發處罰（rows 為新到舊排序）
    let streak = 0;
    for (const r of rows) {
      if (r.result.hasPunishment) break;
      streak++;
    }

    const el = document.getElementById("studentStats");
    el.innerHTML = `
      <div class="card stat-card"><div class="label">累計獎金</div><div class="value">${fmtMoney(totalBonus)}</div></div>
      <div class="card stat-card"><div class="label">平均分（近5次）</div><div class="value">${avgRecent}</div></div>
      <div class="card stat-card"><div class="label">累計處罰次數</div><div class="value">${punishCount}</div></div>
      <div class="card stat-card"><div class="label">累計進步次數</div><div class="value">${progressCount}</div>${progressCount ? '<div class="delta up">持續進步中</div>' : ""}</div>
      <div class="card stat-card"><div class="label">累計衛冕次數</div><div class="value">${defenseCount}</div>${defenseCount ? '<div class="delta up">穩定發揮</div>' : ""}</div>
      <div class="card stat-card"><div class="label">連續正常紀錄</div><div class="value">${streak}</div>${streak ? '<div class="delta up">連續達標中</div>' : ""}</div>
    `;
  }

  function renderChart(rows) {
    const ordered = [...rows].reverse(); // 時間由舊到新
    const container = document.getElementById("trendCharts");
    container.innerHTML = "";

    // 依第一次出現的順序，收集所有出現過的科目名稱
    const subjectNames = [];
    ordered.forEach((r) => {
      (r.subjects || []).forEach((s) => {
        if (!subjectNames.includes(s.name)) subjectNames.push(s.name);
      });
    });

    if (!subjectNames.length) {
      container.innerHTML = `<div class="card empty-state">還沒有科目成績資料</div>`;
      return;
    }

    const palette = ["#4f7cff", "#4fd1c5", "#ffb454", "#ff6b9d", "#a78bfa", "#34d399", "#ffd54a", "#63b3ff"];
    const labels = ordered.map((r) => `${r.semester || ""} ${r.examType || ""}`.trim() || r.date || "");

    function addMiniChart(title, color, scores, isAverage) {
      const validScores = scores.filter((v) => typeof v === "number");
      const minScore = validScores.length ? Math.min(...validScores) : 0;
      // 分數區間預設 60~100；只有最低分低於 60 時才下修，且下限仍取 10 分整數
      // 例：最低 58 分 → 下限 50；最低 32 分 → 下限 30
      const yMin = minScore < 60 ? Math.max(0, Math.floor(minScore / 10) * 10) : 60;

      const card = document.createElement("div");
      card.className = "card mini-chart-card" + (isAverage ? " mini-chart-average" : "");
      card.innerHTML = `
        <div class="mini-chart-head">
          <div class="mini-chart-title"><span class="dot" style="background:${color}"></span>${escapeHtml(title)}</div>
          <div class="mini-chart-range">${yMin} ~ 100</div>
        </div>
        <canvas height="${isAverage ? 60 : 160}"></canvas>
      `;
      container.appendChild(card);

      new Chart(card.querySelector("canvas"), {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: title,
              data: scores,
              borderColor: color,
              backgroundColor: color + "22",
              fill: true,
              tension: 0.3,
              spanGaps: true,
              pointRadius: 3,
            },
          ],
        },
        options: {
          responsive: true,
          interaction: { mode: "index", intersect: false },
          plugins: { legend: { display: false } },
          scales: {
            y: { min: yMin, max: 100, ticks: { color: "#93a0c2" }, grid: { color: "#263354" } },
            x: { ticks: { color: "#93a0c2" }, grid: { color: "#1a2440" } },
          },
        },
      });
    }

    // 最上方先放「平均」趨勢圖（取每次紀錄所有科目的平均分）
    const avgScores = ordered.map((r) => (typeof r.result?.avgScore === "number" ? r.result.avgScore : null));
    addMiniChart("平均", "#e7ecf7", avgScores, true);

    subjectNames.forEach((name, i) => {
      const color = palette[i % palette.length];
      const scores = ordered.map((r) => {
        const s = (r.subjects || []).find((x) => x.name === name);
        return s ? s.score : null;
      });
      addMiniChart(name, color, scores, false);
    });
  }

  function renderTable(rows) {
    const tbody = document.querySelector("#recordsTable tbody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="8" class="empty-state">還沒有任何紀錄，點右上角「新增考試紀錄」開始記錄吧！</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((r) => {
        const subjectsText = (r.subjects || [])
          .map((s) => `${escapeHtml(s.name)} ${s.score}分`)
          .join("、");
        return `<tr>
          <td>${r.date || "-"}</td>
          <td>${escapeHtml(r.semester || "-")}</td>
          <td>${escapeHtml(r.examType || "-")}</td>
          <td class="text-dim">${subjectsText}</td>
          <td class="num">${r.result.avgScore}</td>
          <td class="num">${fmtMoney(r.total)}</td>
          <td>${
            r.result.hasPunishment
              ? r.punishmentStatus === "done"
                ? '<span class="badge badge-done">已執行處罰</span>'
                : '<span class="badge badge-penalty">需處罰</span>'
              : '<span class="badge badge-normal">正常</span>'
          }</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-sm" data-edit-id="${r.id}">編輯</button>
            <button class="btn btn-sm btn-danger" data-del-id="${r.id}">刪除</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("button[data-del-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("確定要刪除這筆紀錄嗎？此動作無法復原。")) return;
        await deleteExamRecord(btn.dataset.delId);
        window.location.reload();
      });
    });

    tbody.querySelectorAll("button[data-edit-id]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const record = rows.find((r) => r.id === btn.dataset.editId);
        if (record && window.__loadRecordIntoForm) window.__loadRecordIntoForm(record);
      });
    });
  }

  // ------------------------------------------------------------------
  function setupForm(rules, student) {
    const formEl = document.getElementById("recordForm");
    const formTitleEl = document.getElementById("recordFormTitle");
    const saveBtn = document.getElementById("saveRecordBtn");
    let editingRecordId = null;

    function setFormMode(mode) {
      // mode: "create" | "edit"
      if (formTitleEl) formTitleEl.textContent = mode === "edit" ? "編輯考試紀錄" : "新增考試紀錄";
      saveBtn.textContent = mode === "edit" ? "更新紀錄" : "儲存紀錄";
    }

    const subjectRowsEl = document.getElementById("subjectRows");
    let rowCount = 0;

    // ---- 學制 / 學期連動下拉選單 ----
    const schoolLevelEl = document.getElementById("fSchoolLevel");
    const semesterEl = document.getElementById("fSemester");
    const SCHOOL_LEVELS = {
      elementary: ["一", "二", "三", "四", "五", "六"],
      middle: ["國一", "國二", "國三"],
      high: ["高一", "高二", "高三"],
    };

    // 依選定學制，重新產生學期下拉選單的選項（每個年級各有上/下兩個學期）
    function populateSemesterOptions(levelKey, preferredValue) {
      const grades = SCHOOL_LEVELS[levelKey] || SCHOOL_LEVELS.elementary;
      const options = [];
      grades.forEach((g) => {
        options.push(`${g}上`);
        options.push(`${g}下`);
      });
      semesterEl.innerHTML = options.map((o) => `<option value="${o}">${o}</option>`).join("");
      if (preferredValue && options.includes(preferredValue)) {
        semesterEl.value = preferredValue;
      }
    }

    // 依學期文字（例如「四下」「國一上」「高三下」）判斷屬於哪個學制，供編輯/帶出上次紀錄時使用
    function detectSchoolLevel(semesterText) {
      const s = (semesterText || "").trim();
      if (s.startsWith("國")) return "middle";
      if (s.startsWith("高")) return "high";
      return "elementary";
    }

    schoolLevelEl.addEventListener("change", () => populateSemesterOptions(schoolLevelEl.value));
    populateSemesterOptions(schoolLevelEl.value);

    function populateDefaultRows() {
      subjectRowsEl.innerHTML = "";
      ["國語", "數學", "英文"].forEach((n) => addSubjectRow(n));
    }

    document.getElementById("openFormBtn").addEventListener("click", () => {
      editingRecordId = null;
      setFormMode("create");
      document.getElementById("fDate").valueAsDate = new Date();
      document.getElementById("fExamType").value = "期中";
      document.getElementById("fOverride").value = "";
      document.getElementById("fNote").value = "";
      const punishmentSelectReset = document.getElementById("fPunishmentStatus");
      if (punishmentSelectReset) punishmentSelectReset.value = "pending";

      const lastRecord = records[0]; // records 已依學制排序新到舊排序（外層 IIFE 抓取）
      // 預設學制/學期沿用最近一筆紀錄，若無歷史紀錄則預設國小一上
      const defaultLevel = lastRecord ? detectSchoolLevel(lastRecord.semester) : "elementary";
      schoolLevelEl.value = defaultLevel;
      populateSemesterOptions(defaultLevel, lastRecord ? lastRecord.semester : null);

      let loadedFromLast = false;
      if (lastRecord && (lastRecord.subjects || []).length) {
        const useLast = confirm(
          `偵測到最近一筆紀錄（${lastRecord.date || ""} ${lastRecord.semester || ""} ${lastRecord.examType || ""}），要直接帶出該次的科目與分數，作為這次的「上次分數」嗎？`
        );
        if (useLast) {
          subjectRowsEl.innerHTML = "";
          lastRecord.subjects.forEach((s) => addSubjectRow(s.name, "", s.score));
          loadedFromLast = true;
        }
      }
      if (!loadedFromLast) populateDefaultRows();

      updatePreview();
      formEl.style.display = "block";
      formEl.scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("cancelFormBtn").addEventListener("click", () => {
      formEl.style.display = "none";
      editingRecordId = null;
    });

    document.getElementById("fDate").valueAsDate = new Date();

    // ---- 分數區間驗證（0-100） ----
    function validateScoreInput(input) {
      const v = input.value;
      const invalid = v !== "" && (Number(v) < 0 || Number(v) > 100 || Number.isNaN(Number(v)));
      input.classList.toggle("input-error", invalid);
      let msg = input.parentElement.querySelector(".field-error");
      if (invalid) {
        if (!msg) {
          msg = document.createElement("div");
          msg.className = "field-error";
          msg.style.cssText = "color:var(--bad); font-size:11px; margin-top:4px;";
          input.parentElement.appendChild(msg);
        }
        msg.textContent = "分數需介於 0-100";
      } else if (msg) {
        msg.remove();
      }
      return !invalid;
    }

    // ---- 拖曳排序 ----
    let draggedRow = null;
    function getDragAfterElement(container, y) {
      const els = [...container.querySelectorAll(".subject-row:not(.dragging)")];
      return els.reduce(
        (closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = y - box.top - box.height / 2;
          if (offset < 0 && offset > closest.offset) return { offset, element: child };
          return closest;
        },
        { offset: Number.NEGATIVE_INFINITY, element: null }
      ).element;
    }
    subjectRowsEl.addEventListener("dragover", (e) => {
      e.preventDefault();
      if (!draggedRow) return;
      const afterEl = getDragAfterElement(subjectRowsEl, e.clientY);
      if (afterEl == null) subjectRowsEl.appendChild(draggedRow);
      else subjectRowsEl.insertBefore(draggedRow, afterEl);
    });

    function addSubjectRow(name = "", score = "", prevScore = "") {
      rowCount++;
      const rowId = "row" + rowCount;
      const row = document.createElement("div");
      row.className = "subject-row";
      row.style.gridTemplateColumns = "auto 1.2fr 1fr 1fr auto";
      row.dataset.rowId = rowId;
      row.innerHTML = `
        <div style="display:flex; align-items:flex-end; padding-bottom:9px;">
          <span class="drag-handle" title="按住拖曳調整順序">⠿</span>
        </div>
        <div>
          <label>科目</label>
          <input type="text" class="f-subject-name" placeholder="例如：英文" value="${escapeHtml(name)}" />
        </div>
        <div>
          <label>本次分數</label>
          <input type="number" class="f-subject-score" min="0" max="100" value="${score}" />
        </div>
        <div>
          <label>上次分數（選填，用於計算進步獎金）</label>
          <input type="number" class="f-subject-prev" min="0" max="100" value="${prevScore}" />
        </div>
        <div>
          <button class="btn btn-sm btn-danger" type="button" data-remove>移除</button>
        </div>
      `;
      subjectRowsEl.appendChild(row);
      row.querySelector("[data-remove]").addEventListener("click", () => {
        row.remove();
        updatePreview();
      });

      const handle = row.querySelector(".drag-handle");
      handle.addEventListener("mousedown", () => {
        row.draggable = true;
      });
      row.addEventListener("dragstart", (e) => {
        draggedRow = row;
        row.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", rowId);
      });
      row.addEventListener("dragend", () => {
        row.classList.remove("dragging");
        row.draggable = false;
        draggedRow = null;
        updatePreview();
      });

      const scoreInput = row.querySelector(".f-subject-score");
      const prevInput = row.querySelector(".f-subject-prev");
      [scoreInput, prevInput].forEach((inp) => {
        inp.addEventListener("input", () => {
          validateScoreInput(inp);
          updatePreview();
        });
      });
      row.querySelector(".f-subject-name").addEventListener("input", updatePreview);
    }

    document.getElementById("addSubjectBtn").addEventListener("click", () => addSubjectRow());

    // 提示：科目的上下順序會影響「同分時」的名次判定（分數不同時不影響總金額），
    // 可以按住科目左邊的「⠿」拖曳調整順序。

    async function autofillPrevScores() {
      const rows = [...subjectRowsEl.children];
      for (const row of rows) {
        const nameInput = row.querySelector(".f-subject-name");
        const prevInput = row.querySelector(".f-subject-prev");
        if (nameInput.value && !prevInput.value) {
          const last = await getLastScoreForSubject(studentId, nameInput.value.trim());
          if (last !== null) prevInput.value = last;
        }
      }
      updatePreview();
    }
    subjectRowsEl.addEventListener(
      "blur",
      (e) => {
        if (e.target.classList.contains("f-subject-name")) autofillPrevScores();
      },
      true
    );

    function collectSubjects() {
      return [...subjectRowsEl.children]
        .map((row) => ({
          name: row.querySelector(".f-subject-name").value.trim(),
          score: Number(row.querySelector(".f-subject-score").value),
          prevScore: row.querySelector(".f-subject-prev").value
            ? Number(row.querySelector(".f-subject-prev").value)
            : undefined,
        }))
        .filter((s) => s.name && !Number.isNaN(s.score));
    }

    function updatePreview() {
      const subjects = collectSubjects();
      const previewEl = document.getElementById("calcPreview");
      const punishmentRow = document.getElementById("punishmentStatusRow");
      if (!subjects.length) {
        previewEl.innerHTML = "請至少輸入一科分數";
        if (punishmentRow) punishmentRow.style.display = "none";
        return;
      }
      const result = calcExamRecord(subjects, rules);
      if (punishmentRow) punishmentRow.style.display = result.hasPunishment ? "block" : "none";
      previewEl.innerHTML = `
        <div class="grid grid-cols-4" style="margin-bottom:10px;">
          ${result.detail
            .map(
              (d) => `<div>
                <span class="badge badge-${d.tierKey}">${d.tierLabel}</span>
                <div style="font-size:13px; margin-top:6px;">${escapeHtml(d.name)}：${fmtMoney(d.subtotal)}</div>
                <div class="text-faint" style="font-size:11px;">基礎${fmtMoney(d.baseBonus)}｜進步${fmtMoney(d.progressBonus)}｜衛冕${fmtMoney(d.defenseBonus)}</div>
              </div>`
            )
            .join("")}
        </div>
        <div class="flex-between">
          <span>全科加碼：${fmtMoney(result.comboBonus)}</span>
          <span style="font-weight:800; font-size:16px;">預估總計：${fmtMoney(result.total)}</span>
        </div>
        ${result.hasPunishment ? `<div class="delta down" style="margin-top:8px;">⚠️ ${result.punishmentSubjects.join("、")} 低於 80 分，需執行處罰機制</div>` : ""}
      `;
    }
    updatePreview();

    saveBtn.addEventListener("click", async () => {
      const allScoreInputs = [...subjectRowsEl.querySelectorAll(".f-subject-score, .f-subject-prev")];
      const allValid = allScoreInputs.map((inp) => validateScoreInput(inp)).every(Boolean);
      if (!allValid) {
        alert("有分數超出 0-100 的範圍，請修正後再儲存（已用紅框標示）");
        return;
      }

      const subjects = collectSubjects();
      if (!subjects.length) {
        alert("請至少輸入一科分數");
        return;
      }
      const date = document.getElementById("fDate").value;
      if (!date) {
        alert("請選擇日期");
        return;
      }
      const overrideVal = document.getElementById("fOverride").value;
      const record = {
        studentId,
        date,
        semester: document.getElementById("fSemester").value.trim(),
        examType: document.getElementById("fExamType").value,
        subjects,
        note: document.getElementById("fNote").value.trim(),
      };
      if (overrideVal !== "") record.manualOverrideTotal = Number(overrideVal);

      const isEdit = !!editingRecordId;
      const calcResult = calcExamRecord(subjects, rules);
      if (calcResult.hasPunishment) {
        const statusSelect = document.getElementById("fPunishmentStatus");
        record.punishmentStatus = statusSelect ? statusSelect.value : "pending";
      } else if (isEdit) {
        // 分數已修正到不再需要處罰，若編輯時清掉了先前的處罰狀態欄位
        record.punishmentStatus = firebase.firestore.FieldValue.delete();
      }

      saveBtn.disabled = true;
      saveBtn.textContent = isEdit ? "更新中..." : "儲存中...";
      try {
        if (isEdit) {
          await updateExamRecord(editingRecordId, record);
        } else {
          await addExamRecord(record);
        }
        window.location.reload();
      } catch (err) {
        alert((isEdit ? "更新失敗：" : "儲存失敗：") + err.message);
        saveBtn.disabled = false;
        setFormMode(isEdit ? "edit" : "create");
      }
    });

    // 提供給歷史紀錄表格的「編輯」按鈕呼叫：把既有紀錄載入表單
    window.__loadRecordIntoForm = function (record) {
      editingRecordId = record.id;
      setFormMode("edit");

      document.getElementById("fDate").value = record.date || "";
      const editLevel = detectSchoolLevel(record.semester);
      schoolLevelEl.value = editLevel;
      populateSemesterOptions(editLevel, record.semester);
      document.getElementById("fExamType").value = record.examType || "期中";
      document.getElementById("fOverride").value =
        typeof record.manualOverrideTotal === "number" ? record.manualOverrideTotal : "";
      document.getElementById("fNote").value = record.note || "";
      const punishmentSelectLoad = document.getElementById("fPunishmentStatus");
      if (punishmentSelectLoad) punishmentSelectLoad.value = record.punishmentStatus === "done" ? "done" : "pending";

      subjectRowsEl.innerHTML = "";
      (record.subjects || []).forEach((s) => addSubjectRow(s.name, s.score, s.prevScore ?? ""));
      if (!(record.subjects || []).length) addSubjectRow();

      formEl.style.display = "block";
      formEl.scrollIntoView({ behavior: "smooth" });
      updatePreview();
    };
  }
})();
