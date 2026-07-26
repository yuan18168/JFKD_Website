/* student.js — 學生詳細頁：紀錄列表、趨勢圖、新增紀錄表單 */
(async function () {
  await requireGuard();

  const params = new URLSearchParams(window.location.search);
  const studentId = params.get("id");

  if (!studentId) {
    document.getElementById("studentName").textContent = "找不到學生";
    return;
  }

  const [student, students, rules, records, subjectPresets] = await Promise.all([
    getStudent(studentId),
    listStudents(),
    getRules(),
    listExamRecords(studentId),
    getSubjectPresets(),
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

  // 依學期文字（例如「四下」「國一上」「高三下」）判斷屬於哪個學制，轉成表格顯示用文字
  function schoolLevelLabel(semesterText) {
    const s = (semesterText || "").trim();
    if (s.startsWith("國")) return "國中";
    if (s.startsWith("高")) return "高中";
    return s ? "國小" : "-";
  }

  function renderTable(rows) {
    const tbody = document.querySelector("#recordsTable tbody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty-state">還沒有任何紀錄，點右上角「新增考試紀錄」開始記錄吧！</td></tr>`;
      return;
    }
    tbody.innerHTML = rows
      .map((r) => {
        const subjectsText = (r.subjects || [])
          .map((s) => `${escapeHtml(s.name)} ${s.score}分`)
          .join("、");
        return `<tr>
          <td>${r.date || "-"}</td>
          <td>${schoolLevelLabel(r.semester)}</td>
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
    let subjectsBlocked = false;

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

    // 依學期文字取出「年級」鍵值（去掉上/下），用來查科目對照表，例如「四下」→「四」、「國一上」→「國一」
    function extractGradeKey(semesterText) {
      return (semesterText || "").trim().replace(/(上|下)$/, "");
    }

    schoolLevelEl.addEventListener("change", () => {
      populateSemesterOptions(schoolLevelEl.value);
      // 新增模式下，學制切換會連動重新產生學期選項，科目清單也要跟著重新套用對照表
      if (editingRecordId === null) {
        populateSubjectsForGrade(extractGradeKey(semesterEl.value));
        updatePreview();
      }
    });
    semesterEl.addEventListener("change", () => {
      // 編輯模式尊重既有紀錄的科目，不因切換學期而強制覆蓋
      if (editingRecordId !== null) return;
      populateSubjectsForGrade(extractGradeKey(semesterEl.value));
      updatePreview();
    });
    populateSemesterOptions(schoolLevelEl.value);

    // 科目與分數區塊：有對照表設定就帶出固定科目清單（僅能回填分數）；
    // 沒有設定（例如目前的五、六年級）就整個區塊改顯示提示，引導使用者先去「科目對照表」設定，
    // 自由輸入科目的舊模式已完全移除。
    const subjectsBlockedMsgEl = document.getElementById("subjectsBlockedMsg");
    const subjectsTableWrapEl = document.getElementById("subjectsTableWrap");
    function setSubjectsBlocked(blocked) {
      subjectsBlocked = blocked;
      if (subjectsBlockedMsgEl) subjectsBlockedMsgEl.style.display = blocked ? "block" : "none";
      if (subjectsTableWrapEl) subjectsTableWrapEl.style.display = blocked ? "none" : "";
      saveBtn.disabled = blocked;
      if (blocked) {
        const previewEl = document.getElementById("calcPreview");
        const punishmentRow = document.getElementById("punishmentStatusRow");
        if (previewEl) previewEl.innerHTML = "";
        if (punishmentRow) punishmentRow.style.display = "none";
      }
    }

    function populateSubjectsForGrade(gradeKey) {
      const preset = subjectPresets[gradeKey];
      const hasPreset = Array.isArray(preset) && preset.length > 0;
      subjectRowsEl.innerHTML = "";
      if (hasPreset) {
        setSubjectsBlocked(false);
        preset.forEach((name) => addSubjectRow(name, ""));
      } else {
        setSubjectsBlocked(true);
      }
    }

    // 新增／編輯表單展開時，隱藏上方統計卡片與趨勢圖表，讓畫面聚焦在表單本身；
    // 關閉表單（取消／儲存後重新整理）時才恢復顯示。
    const dashboardSummaryEl = document.getElementById("dashboardSummarySection");
    function setDashboardSummaryVisible(visible) {
      if (dashboardSummaryEl) dashboardSummaryEl.style.display = visible ? "" : "none";
    }

    document.getElementById("openFormBtn").addEventListener("click", () => {
      editingRecordId = null;
      setFormMode("create");
      setDashboardSummaryVisible(false);
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

      populateSubjectsForGrade(extractGradeKey(semesterEl.value));

      updatePreview();
      formEl.style.display = "block";
      formEl.scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("cancelFormBtn").addEventListener("click", () => {
      formEl.style.display = "none";
      editingRecordId = null;
      setDashboardSummaryVisible(true);
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

    // 科目清單已完全固定（來自「科目對照表」），此表單只負責回填分數，
    // 不再提供新增/移除/拖曳排序等操作——科目的增刪與順序統一到「科目對照表」管理頁面調整。
    // 每一列同時是「科目與級距/首次成績徽章」＋「本次分數」＋「基礎/進步/衛冕/小計」的完整計算表格列。
    function addSubjectRow(name = "", score = "") {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>
          <span class="subject-badges"></span>
          <span class="subj-label">${escapeHtml(name)}</span>
          <input type="hidden" class="f-subject-name" value="${escapeHtml(name)}" />
        </td>
        <td class="num"><input type="number" class="f-subject-score" min="0" max="100" value="${score}" /></td>
        <td class="num" data-cell="base">–</td>
        <td class="num" data-cell="progress">–</td>
        <td class="num" data-cell="defense">–</td>
        <td class="num" data-cell="subtotal">–</td>
      `;
      subjectRowsEl.appendChild(row);

      const scoreInput = row.querySelector(".f-subject-score");
      scoreInput.addEventListener("input", () => {
        validateScoreInput(scoreInput);
        updatePreview();
      });
    }

    // 依「這筆紀錄的學期＋考試類型」判斷學制順序，從已載入的歷史紀錄中自動找出
    // 每個科目「前一次」的分數，不需要使用者手動輸入「上次分數」。
    // excludeRecordId：編輯既有紀錄時，排除自己這一筆，避免拿自己當作「前一次」。
    function getPrevScoresMap(currentMeta, excludeRecordId) {
      const currentOrdinal = getCurriculumOrdinal(currentMeta);
      const map = {};
      for (const r of records) {
        if (excludeRecordId && r.id === excludeRecordId) continue;
        const ord = getCurriculumOrdinal(r);
        const isEarlier =
          currentOrdinal !== null && ord !== null
            ? ord < currentOrdinal
            : (r.date || "") < (currentMeta.date || "");
        if (!isEarlier) continue;
        (r.subjects || []).forEach((s) => {
          if (!(s.name in map)) map[s.name] = s.score;
        });
      }
      return map;
    }

    function collectSubjects() {
      return [...subjectRowsEl.children]
        .map((row) => ({
          name: row.querySelector(".f-subject-name").value.trim(),
          score: Number(row.querySelector(".f-subject-score").value),
        }))
        .filter((s) => s.name && !Number.isNaN(s.score));
    }

    function updatePreview() {
      const previewEl = document.getElementById("calcPreview");
      const punishmentRow = document.getElementById("punishmentStatusRow");
      if (subjectsBlocked) {
        previewEl.innerHTML = "";
        if (punishmentRow) punishmentRow.style.display = "none";
        return;
      }
      const subjects = collectSubjects();
      if (!subjects.length) {
        previewEl.innerHTML = "請至少輸入一科分數";
        if (punishmentRow) punishmentRow.style.display = "none";
        return;
      }
      const currentMeta = {
        date: document.getElementById("fDate").value,
        semester: semesterEl.value,
        examType: document.getElementById("fExamType").value,
      };
      const prevMap = getPrevScoresMap(currentMeta, editingRecordId);
      const subjectsWithPrev = subjects.map((s) =>
        s.name in prevMap ? { ...s, prevScore: prevMap[s.name] } : { ...s }
      );
      // 沒有前一次分數可比對的科目（例如升上新學年後新增的科目），
      // 標示為「首次成績」，讓使用者了解為什麼沒有進步／衛冕獎金
      const firstTimeNames = new Set(subjects.filter((s) => !(s.name in prevMap)).map((s) => s.name));
      const result = calcExamRecord(subjectsWithPrev, rules);
      if (punishmentRow) punishmentRow.style.display = result.hasPunishment ? "block" : "none";

      // 直接把每科的級距/首次成績徽章與基礎/進步/衛冕/小計數字，填回同一張表格對應的列，
      // 不重新產生分數輸入框，避免使用者輸入到一半游標被打斷。
      const rowEls = [...subjectRowsEl.children];
      result.detail.forEach((d, i) => {
        const rowEl = rowEls[i];
        if (!rowEl) return;
        const badgesEl = rowEl.querySelector(".subject-badges");
        if (badgesEl) {
          badgesEl.innerHTML = `
            <span class="badge badge-${d.tierKey}">${d.tierLabel}</span>
            ${firstTimeNames.has(d.name) ? '<span class="badge badge-first" title="沒有前一次分數可比對，暫不計算進步／衛冕獎金">首次成績</span>' : ""}
          `;
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
          <span style="font-weight:800; font-size:16px;">預估總計：${fmtMoney(result.total)}</span>
        </div>
        ${result.hasPunishment ? `<div class="delta down" style="margin-top:8px;">⚠️ ${result.punishmentSubjects.join("、")} 低於 80 分，需執行處罰機制</div>` : ""}
      `;
    }
    updatePreview();

    saveBtn.addEventListener("click", async () => {
      const allScoreInputs = [...subjectRowsEl.querySelectorAll(".f-subject-score")];
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
      const semesterVal = document.getElementById("fSemester").value.trim();
      const examTypeVal = document.getElementById("fExamType").value;
      // 自動與歷史紀錄比對「前一次」分數，不需使用者手動輸入
      const currentMeta = { date, semester: semesterVal, examType: examTypeVal };
      const prevMap = getPrevScoresMap(currentMeta, editingRecordId);
      const subjectsWithPrev = subjects.map((s) =>
        s.name in prevMap ? { ...s, prevScore: prevMap[s.name] } : { ...s }
      );

      const overrideVal = document.getElementById("fOverride").value;
      const record = {
        studentId,
        date,
        semester: semesterVal,
        examType: examTypeVal,
        subjects: subjectsWithPrev,
        note: document.getElementById("fNote").value.trim(),
      };
      if (overrideVal !== "") record.manualOverrideTotal = Number(overrideVal);

      const isEdit = !!editingRecordId;
      const calcResult = calcExamRecord(subjectsWithPrev, rules);
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
      setDashboardSummaryVisible(false);

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

      // 編輯既有紀錄時，一律顯示這筆紀錄「實際儲存」的科目（尊重歷史資料），
      // 不因為目前的對照表設定而擋住編輯——既然資料已經存在，就是可以編輯的。
      const recordSubjects = record.subjects || [];
      setSubjectsBlocked(false);
      subjectRowsEl.innerHTML = "";
      recordSubjects.forEach((s) => addSubjectRow(s.name, s.score));

      formEl.style.display = "block";
      formEl.scrollIntoView({ behavior: "smooth" });
      updatePreview();
    };
  }
})();
