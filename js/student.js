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
    const punishCount = rows.filter((r) => r.result.hasPunishment).length;

    const el = document.getElementById("studentStats");
    el.innerHTML = `
      <div class="card stat-card"><div class="label">累計紀錄</div><div class="value">${rows.length}</div></div>
      <div class="card stat-card"><div class="label">累計獎金</div><div class="value">${fmtMoney(totalBonus)}</div></div>
      <div class="card stat-card"><div class="label">平均分（近5次）</div><div class="value">${avgRecent}</div></div>
      <div class="card stat-card"><div class="label">需處罰次數</div><div class="value">${punishCount}</div>${punishCount ? '<div class="delta down">需留意</div>' : ""}</div>
    `;
  }

  function renderChart(rows) {
    const ordered = [...rows].reverse(); // 時間由舊到新
    const ctx = document.getElementById("trendChart");
    new Chart(ctx, {
      type: "line",
      data: {
        labels: ordered.map((r) => `${r.date || ""} ${r.examType || ""}`),
        datasets: [
          {
            label: "總獎金 (NT$)",
            data: ordered.map((r) => r.total),
            borderColor: "#4f7cff",
            backgroundColor: "rgba(79,124,255,0.15)",
            tension: 0.3,
            fill: true,
            yAxisID: "y",
          },
          {
            label: "平均分數",
            data: ordered.map((r) => r.result.avgScore),
            borderColor: "#4fd1c5",
            backgroundColor: "transparent",
            tension: 0.3,
            yAxisID: "y1",
          },
        ],
      },
      options: {
        responsive: true,
        interaction: { mode: "index", intersect: false },
        scales: {
          y: { position: "left", ticks: { color: "#93a0c2" }, grid: { color: "#263354" } },
          y1: { position: "right", min: 0, max: 100, ticks: { color: "#93a0c2" }, grid: { drawOnChartArea: false } },
          x: { ticks: { color: "#93a0c2" }, grid: { color: "#1a2440" } },
        },
        plugins: { legend: { labels: { color: "#e7ecf7" } } },
      },
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
          <td>${r.result.hasPunishment ? '<span class="badge badge-penalty">需處罰</span>' : '<span class="badge badge-normal">正常</span>'}</td>
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

    function populateDefaultRows() {
      subjectRowsEl.innerHTML = "";
      ["國語", "數學", "英文"].forEach((n) => addSubjectRow(n));
    }

    document.getElementById("openFormBtn").addEventListener("click", () => {
      editingRecordId = null;
      setFormMode("create");
      document.getElementById("fDate").valueAsDate = new Date();
      document.getElementById("fSemester").value = "";
      document.getElementById("fExamType").value = "期中";
      document.getElementById("fOverride").value = "";
      document.getElementById("fNote").value = "";

      const lastRecord = records[0]; // records 已依日期新到舊排序（外層 IIFE 抓取）
      let loadedFromLast = false;
      if (lastRecord && (lastRecord.subjects || []).length) {
        const useLast = confirm(
          `偵測到最近一筆紀錄（${lastRecord.date || ""} ${lastRecord.semester || ""} ${lastRecord.examType || ""}），要直接帶出該次的科目與分數，作為這次的「上次分數」嗎？`
        );
        if (useLast) {
          subjectRowsEl.innerHTML = "";
          lastRecord.subjects.forEach((s) => addSubjectRow(s.name, "", s.score));
          document.getElementById("fSemester").value = lastRecord.semester || "";
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
      if (!subjects.length) {
        previewEl.innerHTML = "請至少輸入一科分數";
        return;
      }
      const result = calcExamRecord(subjects, rules);
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
      document.getElementById("fSemester").value = record.semester || "";
      document.getElementById("fExamType").value = record.examType || "期中";
      document.getElementById("fOverride").value =
        typeof record.manualOverrideTotal === "number" ? record.manualOverrideTotal : "";
      document.getElementById("fNote").value = record.note || "";

      subjectRowsEl.innerHTML = "";
      (record.subjects || []).forEach((s) => addSubjectRow(s.name, s.score, s.prevScore ?? ""));
      if (!(record.subjects || []).length) addSubjectRow();

      formEl.style.display = "block";
      formEl.scrollIntoView({ behavior: "smooth" });
      updatePreview();
    };
  }
})();
