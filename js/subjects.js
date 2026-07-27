/* subjects.js — 科目對照表管理頁：設定每個年級固定會考的科目與順序（上下學期共用） */
(async function () {
  await requireGuard();

  const GRADE_GROUPS = [
    { title: "國小", grades: ["一", "二", "三", "四", "五", "六"] },
    { title: "國中", grades: ["國一", "國二", "國三"] },
    { title: "高中", grades: ["高一", "高二", "高三"] },
  ];
  const GRADE_LABELS = {
    一: "國小一年級", 二: "國小二年級", 三: "國小三年級",
    四: "國小四年級", 五: "國小五年級", 六: "國小六年級",
    國一: "國中一年級", 國二: "國中二年級", 國三: "國中三年級",
    高一: "高中一年級", 高二: "高中二年級", 高三: "高中三年級",
  };
  // 已知的年級固定科目（使用者確認過的內容），尚未儲存過設定時先以此顯示供確認
  const DEFAULT_PRESETS = {
    一: ["國語", "英文", "數學"],
    二: ["國語", "英文", "數學"],
    三: ["國語", "英文", "數學", "自然", "社會"],
    四: ["國語", "英文", "數學", "自然", "社會"],
    五: [], 六: [],
    國一: [], 國二: [], 國三: [],
    高一: [], 高二: [], 高三: [],
  };

  // 依序展開成一維陣列，讓「帶入上一年級科目」可以跨學制邊界找到真正的「上一個年級」
  // （例如國一的上一個年級是國小六年級，高一的上一個年級是國中三年級）
  const FLAT_GRADES = GRADE_GROUPS.flatMap((g) => g.grades);
  function previousGradeOf(grade) {
    const idx = FLAT_GRADES.indexOf(grade);
    return idx > 0 ? FLAT_GRADES[idx - 1] : null;
  }

  const [students, savedPresets] = await Promise.all([listStudents(), getSubjectPresets()]);
  renderStudentNav(students, null);

  const presets = {};
  GRADE_GROUPS.forEach((g) =>
    g.grades.forEach((grade) => {
      presets[grade] = Array.isArray(savedPresets[grade])
        ? [...savedPresets[grade]]
        : [...(DEFAULT_PRESETS[grade] || [])];
    })
  );

  const container = document.getElementById("presetGroups");
  container.innerHTML = GRADE_GROUPS.map(
    (g, gi) => `
    <div class="section-title ${gi === 0 ? "mt-0" : ""}">${g.title}</div>
    <div class="card" data-group="${g.title}" style="margin-bottom:14px;">
      ${g.grades
        .map(
          (grade) => `
        <div class="grade-preset-row" data-grade="${grade}" style="margin-bottom:18px; padding-bottom:18px; border-bottom:1px solid var(--border);">
          <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <div style="font-size:13px; font-weight:700;">${GRADE_LABELS[grade]}</div>
            ${
              previousGradeOf(grade)
                ? `<button type="button" class="btn btn-sm" data-copy-prev="${grade}">⬇ 帶入上一年級科目（${GRADE_LABELS[previousGradeOf(grade)]}）</button>`
                : ""
            }
          </div>
          <div class="chip-row subject-chip-list" data-grade-chips="${grade}"></div>
          <div style="display:flex; gap:8px; margin-top:10px;">
            <input type="text" class="subject-add-input" data-grade-input="${grade}" placeholder="輸入科目名稱，按 Enter 新增" style="max-width:220px;" />
          </div>
        </div>`
        )
        .join("")}
    </div>`
  ).join("");

  // 每組最後一列不需要下邊框，畫面更乾淨
  container.querySelectorAll('[data-group]').forEach((card) => {
    const rows = card.querySelectorAll(".grade-preset-row");
    if (rows.length) {
      rows[rows.length - 1].style.marginBottom = "0";
      rows[rows.length - 1].style.paddingBottom = "0";
      rows[rows.length - 1].style.borderBottom = "none";
    }
  });

  function renderChips(grade) {
    const el = container.querySelector(`[data-grade-chips="${grade}"]`);
    if (!presets[grade].length) {
      el.innerHTML =
        '<span class="text-faint" style="font-size:12px;">尚未設定，新增考試紀錄時這個年級將維持目前的自由輸入科目方式</span>';
      return;
    }
    el.innerHTML = presets[grade]
      .map(
        (name) => `<span class="chip subject-chip" draggable="true" data-name="${escapeHtml(name)}">
          <span class="drag-handle" title="拖曳調整順序" style="cursor:grab; margin-right:4px; font-size:13px;">⠿</span>${escapeHtml(name)}
          <span data-remove-subject="${escapeHtml(name)}" style="cursor:pointer; color:var(--bad); margin-left:6px;">✕</span>
        </span>`
      )
      .join("");

    el.querySelectorAll("[data-remove-subject]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const name = btn.dataset.removeSubject;
        presets[grade] = presets[grade].filter((n) => n !== name);
        renderChips(grade);
      });
    });

    el.querySelectorAll(".subject-chip").forEach((chip) => {
      chip.addEventListener("dragstart", () => {
        chip.classList.add("dragging");
      });
      chip.addEventListener("dragend", () => {
        chip.classList.remove("dragging");
        presets[grade] = [...el.querySelectorAll(".subject-chip")].map((c) => c.dataset.name);
        renderChips(grade);
      });
    });
    el.addEventListener("dragover", (e) => {
      e.preventDefault();
      const dragging = el.querySelector(".dragging");
      if (!dragging) return;
      const afterEl = [...el.querySelectorAll(".subject-chip:not(.dragging)")].reduce(
        (closest, child) => {
          const box = child.getBoundingClientRect();
          const offset = e.clientX - box.left - box.width / 2;
          if (offset < 0 && offset > closest.offset) return { offset, element: child };
          return closest;
        },
        { offset: Number.NEGATIVE_INFINITY, element: null }
      ).element;
      if (afterEl == null) el.appendChild(dragging);
      else el.insertBefore(dragging, afterEl);
    });
  }

  GRADE_GROUPS.forEach((g) => g.grades.forEach((grade) => renderChips(grade)));

  container.querySelectorAll("[data-copy-prev]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const grade = btn.dataset.copyPrev;
      const prevGrade = previousGradeOf(grade);
      if (!prevGrade) return;
      if (presets[grade].length) {
        const ok = await confirmDialog(
          `${GRADE_LABELS[grade]}目前已經有科目設定，確定要用「${GRADE_LABELS[prevGrade]}」的科目清單覆蓋嗎？（尚未按下方「儲存科目對照表」前都可以再調整或還原）`,
          { title: "覆蓋科目設定", confirmText: "覆蓋", danger: false }
        );
        if (!ok) return;
      }
      presets[grade] = [...presets[prevGrade]];
      renderChips(grade);
    });
  });

  container.querySelectorAll(".subject-add-input").forEach((input) => {
    input.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      const grade = input.dataset.gradeInput;
      const name = input.value.trim();
      if (!name || presets[grade].includes(name)) {
        input.value = "";
        return;
      }
      presets[grade].push(name);
      input.value = "";
      renderChips(grade);
    });
  });

  document.getElementById("saveSubjectPresetsBtn").addEventListener("click", async () => {
    const btn = document.getElementById("saveSubjectPresetsBtn");
    const msg = document.getElementById("saveSubjectMsg");
    btn.disabled = true;
    msg.style.color = "";
    msg.textContent = "儲存中...";
    try {
      await saveSubjectPresets(presets);
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
