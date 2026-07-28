/* student.js — 學生詳細頁：紀錄列表、趨勢圖、新增紀錄表單 */
(async function () {
  await requireGuard();

  // ---- 觸發方式：桌面滑鼠有 hover 就用 hover，觸控裝置（手機/平板）沒有 hover 就改成點一下 ----
  // 每次 hover／點擊都重新播放一次，沒有節流限制，想重看幾次都可以。
  // （宣告放在檔案最前面，避免 renderChart 內的卡片在頁面載入當下就先執行到這個常數，導致還沒初始化就被讀取而出錯）
  const IS_TOUCH_DEVICE = !window.matchMedia("(hover: hover) and (pointer: fine)").matches;

  // ---- 特效播放中，「點擊在其它地方」要立即中止（只有點擊才中止，滑鼠移開不中止）----
  // activeCardEffects：Map<卡片元素, 中止函式>，每張卡片同時最多一個播放中的特效；
  // activeFullpage：{ overlay, dispose } 或 null，全頁特效（動物派對）目前只會有一個。
  // 用 capture 階段監聽，確保「觸發特效的那次點擊」不會在特效剛註冊前就被誤判成別處點擊。
  const activeCardEffects = new Map();
  let activeFullpage = null;

  function registerCardEffect(card, dispose) {
    const prev = activeCardEffects.get(card);
    if (prev) prev();
    activeCardEffects.set(card, dispose);
  }

  function registerFullpageEffect(overlay, dispose) {
    if (activeFullpage) activeFullpage.dispose();
    activeFullpage = { overlay, dispose };
  }

  document.addEventListener(
    "click",
    (e) => {
      activeCardEffects.forEach((dispose, card) => {
        if (!card.contains(e.target)) dispose();
      });
      if (activeFullpage && e.target === activeFullpage.overlay) {
        activeFullpage.dispose();
      }
    },
    true
  );

  const params = new URLSearchParams(window.location.search);
  const studentId = params.get("id");

  if (!studentId) {
    document.getElementById("studentName").textContent = "找不到學生";
    return;
  }

  const [student, students, profiles, settings, records, subjectPresets, globalChartSettings, effectSettings] = await Promise.all([
    getStudent(studentId),
    listStudents(),
    listRuleProfiles(),
    getSettings(),
    listExamRecords(studentId),
    getSubjectPresets(),
    getChartSettings(),
    getEffectSettings(),
  ]);
  const defaultProfileId = settings.defaultProfileId || profiles[0]?.id || null;
  const chartSettings = resolveChartSettings(student, globalChartSettings);

  renderStudentNav(students, studentId);

  if (!student) {
    document.getElementById("studentName").textContent = "找不到這位學生";
    return;
  }

  document.getElementById("studentName").textContent = student.name;
  document.getElementById("studentMeta").textContent = `${records.length} 筆歷史紀錄`;

  // 套用學生主題造型（原創致敬風格，只影響這一頁）
  const studentTheme = getStudentTheme(student.themeId);
  if (studentTheme) {
    document.body.classList.add(studentTheme.bodyClass);
    const bannerSlot = document.getElementById("themeBannerSlot");
    if (bannerSlot) bannerSlot.innerHTML = themeBannerHtml(student.themeId, student.name, student.bannerTitle, student.bannerTagline);
  }

  // 每一筆紀錄都用「當初套用的設定檔」（沒存過就退回目前的家庭預設檔）來計算，
  // 這樣新增/切換設定檔不會改變舊紀錄已經算出來的結果。
  const enriched = records.map((r) => {
    const result = calcExamRecord(r.subjects || [], pickRulesForRecord(r, profiles, defaultProfileId));
    return { ...r, result, total: result.total };
  });

  const totalBonus = enriched.reduce((a, r) => a + r.total, 0);

  renderStats(enriched);
  renderScoreProgress(enriched[0]);
  renderTargetGoal(student, enriched[0]);
  renderWishlist(student, totalBonus);
  renderChart(enriched);
  setupRecordFilters(enriched);

  // ---- 距離下一個獎金級距還差幾分（用最新一筆紀錄當時套用的設定檔門檻）----
  function renderScoreProgress(latestRow) {
    const el = document.getElementById("scoreProgress");
    if (!el) return;
    if (!latestRow) {
      el.innerHTML = "";
      return;
    }
    const rulesForLatest = pickRulesForRecord(latestRow, profiles, defaultProfileId);
    const avg = latestRow.result.avgScore;
    const sorted = [...rulesForLatest.tiers].sort((a, b) => a.min - b.min);
    const nextTier = sorted.find((t) => t.min > avg);

    if (!nextTier) {
      el.innerHTML = `
        <div class="card score-progress-card">
          <div class="score-progress-head">
            <span>🏆 已經達到最高級距了，太棒了！</span>
            <span class="text-faint">最新平均 ${avg} 分</span>
          </div>
        </div>`;
      return;
    }

    // 進度＝目前平均分 ÷ 下一級距門檻 × 100%（相對於0分計算，跟文字描述「還差X分」的直覺一致，
    // 也跟目標設定卡片的計算邏輯一致，例如95.3分距100分門檻就會顯示95.3%滿）
    const pct = Math.max(4, Math.min(100, (avg / nextTier.min) * 100));
    const diff = Math.round((nextTier.min - avg) * 10) / 10;

    el.innerHTML = `
      <div class="card score-progress-card">
        <div class="score-progress-head">
          <span>距離「${escapeHtml(nextTier.label)}」級距還差 <strong>${diff}</strong> 分</span>
          <span class="text-faint">最新平均 ${avg} 分</span>
        </div>
        <div class="score-progress-track">
          <div class="score-progress-fill" style="width:${pct}%;"></div>
        </div>
      </div>`;
  }

  // ---- 目標設定：家長可設定「下次考試目標平均分」，就地編輯（點筆狀圖示變成輸入框）----
  function renderTargetGoal(studentDoc, latestRow) {
    const el = document.getElementById("targetGoal");
    if (!el) return;
    const target = studentDoc.targetAvgScore;
    const avg = latestRow ? latestRow.result.avgScore : null;

    function draw() {
      if (target == null) {
        el.innerHTML = `
          <div class="card score-progress-card target-goal-card">
            <div class="score-progress-head">
              <span class="text-dim">🎯 尚未設定目標平均分</span>
              <button type="button" class="btn btn-sm" id="setTargetBtn">設定目標</button>
            </div>
          </div>`;
        bindSetBtn();
        return;
      }
      const reached = avg != null && avg >= target;
      const pct = avg != null ? Math.max(4, Math.min(100, (avg / target) * 100)) : 0;
      const diff = avg != null ? Math.round((target - avg) * 10) / 10 : null;
      el.innerHTML = `
        <div class="card score-progress-card target-goal-card">
          <div class="score-progress-head">
            <span>${reached ? "🎉 已達成目標！" : `🎯 距離目標平均 <strong>${target}</strong> 分還差 <strong>${diff}</strong> 分`}</span>
            <span class="text-faint">
              目標 ${target} 分
              <button type="button" class="btn btn-sm" id="setTargetBtn" style="margin-left:8px;">編輯</button>
            </span>
          </div>
          <div class="score-progress-track">
            <div class="score-progress-fill ${reached ? "goal-reached" : ""}" style="width:${pct}%;"></div>
          </div>
        </div>`;
      bindSetBtn();
    }

    function bindSetBtn() {
      const btn = document.getElementById("setTargetBtn");
      if (!btn) return;
      btn.addEventListener("click", () => {
        const input = document.createElement("input");
        input.type = "number";
        input.step = "0.1";
        input.placeholder = "例如 95";
        input.value = target != null ? target : "";
        input.style.maxWidth = "120px";
        const head = btn.closest(".score-progress-head");
        head.innerHTML = "";
        head.appendChild(input);
        const saveBtn = document.createElement("button");
        saveBtn.className = "btn btn-sm btn-primary";
        saveBtn.textContent = "儲存";
        head.appendChild(saveBtn);
        input.focus();

        saveBtn.addEventListener("click", async () => {
          const val = input.value.trim();
          try {
            if (val === "") {
              await updateStudent(studentDoc.id, { targetAvgScore: firebase.firestore.FieldValue.delete() });
              studentDoc.targetAvgScore = null;
            } else {
              const num = Math.round(Number(val) * 10) / 10;
              await updateStudent(studentDoc.id, { targetAvgScore: num });
              studentDoc.targetAvgScore = num;
            }
            showToast("已儲存 ✓");
            renderTargetGoal(studentDoc, latestRow);
          } catch (err) {
            alert("儲存失敗：" + err.message);
          }
        });
        input.addEventListener("keydown", (e) => {
          if (e.key === "Enter") saveBtn.click();
        });
      });
    }

    draw();
  }

  // ---- 願望清單：顯示每個願望項目的達成條件、金額來源拆分、達成/兌現狀態（項目本身在「學生名單」頁管理，
  // 但達成狀態／兌現狀態這裡就能直接編輯，讓小朋友和家長都能在紀錄頁上直接操作）----
  // 設計說明（依家長確認）：
  // ①移除進度條，改成「進行中／達成／未達成」三種手動標記的狀態，三者可以隨時自由切換，
  //   即使標成「未達成」也不是永久判死刑，之後隨時可以再挑戰一次改回「進行中」或「達成」。
  // ②只有「達成」狀態才能標記兌現日期；狀態離開「達成」時，會自動清除先前登記的兌現日期。
  // ③「未達成」的卡片會整張變灰＋顯示鼓勵字樣，當作一個溫和的紀錄，而不是責備。
  // 學生紀錄頁只需要看「還在努力中」跟「最近的結果」，完整清單改到獨立的「願望清單」管理頁查看，
  // 所以這裡只顯示：①全部「進行中」的項目、②最近才變成「達成」或「未達成」的 3 筆（依 statusUpdatedAt 排序）。
  function pickVisibleWishlistItems(items) {
    const withStatus = items.map((item) => ({
      item,
      status: item.status || (item.redeemedDate ? "achieved" : "progress"),
    }));
    const inProgress = withStatus.filter((x) => x.status === "progress").map((x) => x.item);
    const decided = withStatus
      .filter((x) => x.status !== "progress")
      .sort((a, b) => new Date(b.item.statusUpdatedAt || 0) - new Date(a.item.statusUpdatedAt || 0))
      .slice(0, 3)
      .map((x) => x.item);
    return { visible: [...inProgress, ...decided], hiddenCount: items.length - inProgress.length - decided.length };
  }

  function renderWishlist(studentDoc, totalBonus) {
    const el = document.getElementById("wishlistSection");
    if (!el) return;
    const items = studentDoc.wishlist || [];
    if (!items.length) {
      el.innerHTML = `<div class="card empty-state">尚未設定願望清單，請至「願望清單」管理頁新增想兌換的項目</div>`;
      return;
    }
    const { visible, hiddenCount } = pickVisibleWishlistItems(items);
    const sorted = [...visible].sort((a, b) => wishlistItemTotal(a) - wishlistItemTotal(b));
    el.innerHTML = `
      <div class="grid grid-cols-3 wishlist-grid">
        ${sorted
          .map((item) => {
            const total = wishlistItemTotal(item);
            // 相容舊資料：舊版只有 redeemedDate、沒有 status 欄位時，代表當初已經手動標記過兌換，
            // 直接視為「達成」狀態，而不是預設「進行中」卻又附著一個兌現日期造成矛盾顯示。
            const status = item.status || (item.redeemedDate ? "achieved" : "progress");
            const redeemed = status === "achieved" && !!item.redeemedDate;
            const cardStateClass = status === "notAchieved" ? "wishlist-not-achieved" : status === "achieved" ? "wishlist-achieved" : "";
            const icon = status === "notAchieved" ? "😅" : redeemed ? "🎉" : "🎁";
            return `
            <div class="card wishlist-card ${cardStateClass}" data-wishlist-item="${item.id}">
              <div class="score-progress-head">
                <span>${icon} ${escapeHtml(item.name)}</span>
                <span class="text-faint">合計 ${fmtMoney(total)}</span>
              </div>
              ${item.condition ? `<div class="text-faint" style="font-size:12px; margin:-4px 0 8px;">🔖 達成條件：${escapeHtml(item.condition)}</div>` : ""}
              <div style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:8px;">
                ${item.amountSelf > 0 ? `<span class="badge badge-normal">自付 ${fmtMoney(item.amountSelf)}</span>` : ""}
                ${item.amountParent > 0 ? `<span class="badge badge-normal">父母加碼 ${fmtMoney(item.amountParent)}</span>` : ""}
                ${item.amountOther > 0 ? `<span class="badge badge-normal">其他人加碼 ${fmtMoney(item.amountOther)}</span>` : ""}
              </div>

              <div class="wishlist-status-row">
                <span class="text-faint" style="font-size:12px;">達成狀態：</span>
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
                          ? `<span style="font-size:12px; color:var(--good);">🎉 已於 ${escapeHtml(item.redeemedDate)} 兌現完成</span>`
                          : `<button type="button" class="btn btn-sm btn-primary" data-wishlist-redeem="${item.id}">標記已兌換</button>`
                      }
                    </div>`
                  : ""
              }
            </div>`;
          })
          .join("")}
      </div>
      ${
        hiddenCount > 0
          ? `<div class="text-faint" style="font-size:12px; margin-top:10px;">還有 ${hiddenCount} 個較早的願望項目沒有顯示，<a href="wishlist.html?id=${studentDoc.id}">前往「願望清單」管理頁查看完整清單 →</a></div>`
          : `<div class="text-faint" style="font-size:12px; margin-top:10px;"><a href="wishlist.html?id=${studentDoc.id}">前往「願望清單」管理頁新增／編輯／排序 →</a></div>`
      }`;

    // ---- 達成狀態切換：進行中／達成／未達成，三者可自由互相切換 ----
    el.querySelectorAll("[data-wishlist-status]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemId = btn.dataset.wishlistStatus;
        const newStatus = btn.dataset.status;
        const wishlist = studentDoc.wishlist || [];
        const item = wishlist.find((it) => it.id === itemId);
        if (!item || (item.status || "progress") === newStatus) return;
        const updatedWishlist = wishlist.map((it) => {
          if (it.id !== itemId) return it;
          const clone = { ...it, status: newStatus };
          // 離開「達成」狀態時，自動清除先前登記的兌現日期，避免狀態與日期兜不起來
          if (newStatus !== "achieved") delete clone.redeemedDate;
          // 記錄「狀態改變的時間」，讓學生紀錄頁能挑出「最近的 3 筆達成/未達成」來顯示
          if (newStatus === "achieved" || newStatus === "notAchieved") {
            clone.statusUpdatedAt = new Date().toISOString();
          } else {
            delete clone.statusUpdatedAt;
          }
          return clone;
        });
        btn.disabled = true;
        try {
          await updateStudent(studentDoc.id, { wishlist: updatedWishlist });
          studentDoc.wishlist = updatedWishlist;
          renderWishlist(studentDoc, totalBonus);
        } catch (err) {
          alert("更新失敗：" + err.message);
          btn.disabled = false;
        }
      });
    });

    // ---- 標記已兌換：用自訂日期彈窗（見 nav.js promptDateDialog），只有「達成」狀態才會出現這顆按鈕 ----
    el.querySelectorAll("[data-wishlist-redeem]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const itemId = btn.dataset.wishlistRedeem;
        const today = new Date().toISOString().slice(0, 10);
        const input = await promptDateDialog("請選擇兌現完成日期：", today, { title: "標記已兌換" });
        if (input === null) return;
        const redeemedDate = input || today;
        const wishlist = studentDoc.wishlist || [];
        const updatedWishlist = wishlist.map((it) => (it.id === itemId ? { ...it, redeemedDate } : it));
        try {
          await updateStudent(studentDoc.id, { wishlist: updatedWishlist });
          studentDoc.wishlist = updatedWishlist;
          renderWishlist(studentDoc, totalBonus);
        } catch (err) {
          alert("更新失敗：" + err.message);
        }
      });
    });

    // 註：不需要「取消兌換標記」按鈕——想取消兌換時，直接點上方的「進行中」或「未達成」即可，
    // 那兩個按鈕本來就會自動清除兌現日期，不用額外重複一個功能相同的操作。
  }

  setupForm(profiles, defaultProfileId, student);

  // ---- 歷史紀錄篩選（依學制／學期）----
  function setupRecordFilters(rows) {
    const levelEl = document.getElementById("recordLevelFilter");
    const semesterEl = document.getElementById("recordSemesterFilter");
    if (!levelEl || !semesterEl) {
      renderTable(rows);
      return;
    }
    const levels = [...new Set(rows.map((r) => schoolLevelLabel(r.semester)))].filter((l) => l && l !== "-");
    levelEl.innerHTML = '<option value="">全部學制</option>' + levels.map((l) => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join("");

    function refreshSemesterOptions() {
      const level = levelEl.value;
      const pool = level ? rows.filter((r) => schoolLevelLabel(r.semester) === level) : rows;
      const semesters = [...new Set(pool.map((r) => r.semester).filter(Boolean))];
      const current = semesterEl.value;
      semesterEl.innerHTML = '<option value="">全部學期</option>' + semesters.map((s) => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
      if (semesters.includes(current)) semesterEl.value = current;
    }

    function applyFilters() {
      const level = levelEl.value;
      const semester = semesterEl.value;
      let filtered = rows;
      if (level) filtered = filtered.filter((r) => schoolLevelLabel(r.semester) === level);
      if (semester) filtered = filtered.filter((r) => r.semester === semester);
      renderTable(filtered);
    }

    refreshSemesterOptions();
    levelEl.addEventListener("change", () => {
      refreshSemesterOptions();
      applyFilters();
    });
    semesterEl.addEventListener("change", applyFilters);
    applyFilters();
  }

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

    renderBadges({ rows, progressCount, defenseCount, streak, punishCount });
  }

  // ---- 成就徽章：把累計數字包裝成可解鎖的徽章，達成前顯示「還差幾次解鎖」增加動力 ----
  // 設計原則（家長明確要求）：任何徽章都不能因為「單一一次失手」就永久無法達成。
  // 因此每個徽章都設計成以下三種安全類型之一：
  //   ①累計型：只會越來越多、永遠不會倒退（例如累計次數／累計金額）
  //   ②里程碑型：只要歷史上發生過一次就永久成立的事實（例如「曾經考過100分」）
  //   ③滾動型：像連續達標一樣可能重置，但永遠可以再挑戰一次，不會被「打入永久冷宮」
  // 舊版「零處罰紀錄」（一次處罰就永遠無緣）已被移除，改為「📈 分數新高」等安全設計。
  function renderBadges({ rows, progressCount, defenseCount, streak }) {
    const el = document.getElementById("achievementBadges");
    if (!el) return;

    const oldestFirst = [...rows].reverse(); // 由舊到新，方便做「歷史上是否發生過」的判斷

    // 4. 💯 滿分紀錄（里程碑型）：任一科目曾經拿到最高級距
    const hasPerfectScore = rows.some((r) => (r.result.detail || []).some((d) => d.tierKey === "A"));

    // 5. 📈 分數新高（里程碑型）：歷史上曾經有一次紀錄的平均分，超越在它之前所有紀錄的最高平均分
    let hasNewHigh = false;
    {
      let runningMax = null;
      oldestFirst.forEach((r, idx) => {
        const avg = r.result.avgScore;
        if (idx > 0 && avg > runningMax) hasNewHigh = true;
        runningMax = runningMax === null ? avg : Math.max(runningMax, avg);
      });
    }

    // 6. 🚀 大躍進（里程碑型）：任一科目單次進步幅度達 10 分以上
    const hasBigJump = rows.some((r) =>
      (r.subjects || []).some((s) => typeof s.prevScore === "number" && s.score - s.prevScore >= 10)
    );

    // 7. 🌟 全科同框（里程碑型）：同一次紀錄裡，所有科目都達 90 分以上
    const hasAllSubjects90 = rows.some((r) => (r.subjects || []).length > 0 && r.subjects.every((s) => s.score >= 90));

    // 8. 🎖️ 連續衛冕（里程碑型）：曾經連續兩次紀錄都至少有一科衛冕成功
    let hasConsecutiveDefense = false;
    for (let i = 0; i < rows.length - 1; i++) {
      const a = (rows[i].result.detail || []).some((d) => d.defenseBonus > 0);
      const b = (rows[i + 1].result.detail || []).some((d) => d.defenseBonus > 0);
      if (a && b) {
        hasConsecutiveDefense = true;
        break;
      }
    }

    // 9. 🧗 谷底翻身（里程碑型）：任一科目曾經從 80 分以下進步到 80 分以上
    const hasComeback80 = rows.some((r) =>
      (r.subjects || []).some((s) => typeof s.prevScore === "number" && s.prevScore < 80 && s.score >= 80)
    );

    // 10. 🔁 五連勝（里程碑型）：歷史上曾經連續 5 次紀錄，平均分都達 90 分以上
    let hasFiveStreak90 = false;
    for (let i = 0; i <= rows.length - 5; i++) {
      if (rows.slice(i, i + 5).every((r) => r.result.avgScore >= 90)) {
        hasFiveStreak90 = true;
        break;
      }
    }

    // 12. 🌈 全科進步（里程碑型）：同一次紀錄中，所有「有前次分數可比對」的科目都進步了
    const hasAllImproved = rows.some((r) => {
      const withPrev = (r.subjects || []).filter((s) => typeof s.prevScore === "number");
      return withPrev.length > 0 && withPrev.every((s) => s.score > s.prevScore);
    });

    // 13. 🥇 常勝軍（累計型）：累計「全科加碼」達成次數
    const comboCount = rows.filter((r) => r.result.comboBonus > 0).length;

    // 14. 🕰️ 持之以恆（累計型）：最早與最新紀錄的日期相差達半年（182天）以上
    let longHaulDays = 0;
    {
      const dates = rows.map((r) => r.date).filter(Boolean).sort();
      if (dates.length >= 2) {
        const first = new Date(dates[0]);
        const last = new Date(dates[dates.length - 1]);
        longHaulDays = Math.round((last - first) / (1000 * 60 * 60 * 24));
      }
    }

    // 16. 🎓 科科精通（累計型）：曾經考過 100 分的「不同科目數」
    const subjectsHit100 = new Set();
    rows.forEach((r) => (r.subjects || []).forEach((s) => { if (s.score >= 100) subjectsHit100.add(s.name); }));
    const masterCount = subjectsHit100.size;

    // 17. 🦸 逆風翻盤（里程碑型）：曾經處罰後，下一次紀錄就恢復正常
    let hasComebackAfterPunishment = false;
    for (let i = 0; i < oldestFirst.length - 1; i++) {
      if (oldestFirst[i].result.hasPunishment && !oldestFirst[i + 1].result.hasPunishment) {
        hasComebackAfterPunishment = true;
        break;
      }
    }

    // 18. 🌻 穩健成長（滾動型，跟「連續達標」一樣可重來）：最近 5 次紀錄，最新一次比 5 次前更好
    let hasSteadyGrowth = false;
    if (rows.length >= 5) {
      const windowRows = rows.slice(0, 5); // index0=最新，index4=這個區間內最舊的一筆
      hasSteadyGrowth = windowRows[0].result.avgScore > windowRows[4].result.avgScore;
    }

    // 19. 🎁 願望達成（累計型）：願望清單中曾經有項目標記為已兌換
    const wishlistRedeemed = ((student && student.wishlist) || []).some((item) => !!item.redeemedDate);

    // 20. 🧩 全能挑戰（里程碑型）：同一次紀錄同時出現「進步獎金」＋「衛冕獎金」＋「全科加碼」
    const hasAllInOne = rows.some((r) => {
      const detail = r.result.detail || [];
      const hasProgress = detail.some((d) => d.progressBonus > 0);
      const hasDefense = detail.some((d) => d.defenseBonus > 0);
      return hasProgress && hasDefense && r.result.comboBonus > 0;
    });

    // 每個徽章都有兩種文字：
    // ・hint：只有「未解鎖」時顯示在徽章下方的小字，會動態倒數還差幾次／幾分（給還沒達成的人看的進度提示）
    // ・desc：不管解鎖與否，滑鼠移上去（title tooltip）永遠顯示的「解鎖條件」固定說明，
    //         這樣已經解鎖的徽章也能讓小朋友知道自己「為什麼」拿到這個徽章，而不是只顯示「已解鎖！」
    const badges = [
      { icon: "🔥", label: "進步達人", unlocked: progressCount >= 5, desc: "累計進步達 5 次即可解鎖", hint: `再進步 ${Math.max(0, 5 - progressCount)} 次解鎖` },
      { icon: "🏆", label: "衛冕高手", unlocked: defenseCount >= 5, desc: "累計衛冕達 5 次即可解鎖", hint: `再衛冕 ${Math.max(0, 5 - defenseCount)} 次解鎖` },
      { icon: "🎯", label: "連續達標", unlocked: streak >= 3, desc: "連續 3 次紀錄都沒有處罰即可解鎖", hint: `連續 3 次沒有處罰即可解鎖（目前連續 ${streak} 次）` },
      { icon: "💯", label: "滿分紀錄", unlocked: hasPerfectScore, desc: "任一科目考到最高級距即可解鎖", hint: "任一科目考到最高級距即可解鎖" },
      { icon: "📈", label: "分數新高", unlocked: hasNewHigh, desc: "刷新個人歷史最高平均分即可解鎖", hint: "刷新個人歷史最高平均分即可解鎖" },
      { icon: "🚀", label: "大躍進", unlocked: hasBigJump, desc: "單科單次進步達 10 分以上即可解鎖", hint: "單科單次進步達 10 分以上即可解鎖" },
      { icon: "🌟", label: "全科同框", unlocked: hasAllSubjects90, desc: "同一次紀錄所有科目都達 90 分以上即可解鎖", hint: "同一次紀錄所有科目都達 90 分以上即可解鎖" },
      { icon: "🎖️", label: "連續衛冕", unlocked: hasConsecutiveDefense, desc: "連續兩次紀錄都有科目衛冕成功即可解鎖", hint: "連續兩次紀錄都有科目衛冕成功即可解鎖" },
      { icon: "🧗", label: "谷底翻身", unlocked: hasComeback80, desc: "任一科目從 80 分以下進步到 80 分以上即可解鎖", hint: "任一科目從 80 分以下進步到 80 分以上即可解鎖" },
      { icon: "🔁", label: "五連勝", unlocked: hasFiveStreak90, desc: "連續 5 次紀錄平均分都達 90 分以上即可解鎖", hint: "連續 5 次紀錄平均分都達 90 分以上即可解鎖" },
      { icon: "📚", label: "全勤紀錄", unlocked: rows.length >= 10, desc: "累計紀錄達 10 筆即可解鎖", hint: `再新增 ${Math.max(0, 10 - rows.length)} 筆紀錄即可解鎖` },
      { icon: "🌈", label: "全科進步", unlocked: hasAllImproved, desc: "同一次紀錄中，有比較對象的科目全部都要進步即可解鎖", hint: "同一次紀錄中，有比較對象的科目全部都要進步即可解鎖" },
      { icon: "🥇", label: "常勝軍", unlocked: comboCount >= 3, desc: "累計 3 次全科加碼即可解鎖", hint: `再達成 ${Math.max(0, 3 - comboCount)} 次全科加碼即可解鎖` },
      { icon: "🕰️", label: "持之以恆", unlocked: longHaulDays >= 182, desc: "記錄時間橫跨半年（182天）以上即可解鎖", hint: "記錄時間橫跨半年（182天）以上即可解鎖" },
      { icon: "💰", label: "小富翁", unlocked: totalBonus >= 5000, desc: "累計獎金達 NT$5,000 即可解鎖", hint: `累計獎金再達 ${fmtMoney(Math.max(0, 5000 - totalBonus))} 即可解鎖` },
      { icon: "🎓", label: "科科精通", unlocked: masterCount >= 3, desc: "3 個不同科目都考到 100 分即可解鎖", hint: `再有 ${Math.max(0, 3 - masterCount)} 個不同科目考到 100 分即可解鎖` },
      { icon: "🦸", label: "逆風翻盤", unlocked: hasComebackAfterPunishment, desc: "處罰後，下一次紀錄恢復正常即可解鎖", hint: "處罰後，下一次紀錄恢復正常即可解鎖" },
      { icon: "🌻", label: "穩健成長", unlocked: hasSteadyGrowth, desc: "最近 5 次紀錄要比 5 次之前更好即可解鎖", hint: "最近 5 次紀錄要比 5 次之前更好即可解鎖" },
      { icon: "🎁", label: "願望達成", unlocked: wishlistRedeemed, desc: "完成兌換任一願望清單項目即可解鎖", hint: "完成兌換任一願望清單項目即可解鎖" },
      { icon: "🧩", label: "全能挑戰", unlocked: hasAllInOne, desc: "同一次紀錄同時有進步獎金、衛冕獎金、全科加碼即可解鎖", hint: "同一次紀錄同時有進步獎金、衛冕獎金、全科加碼即可解鎖" },
    ];

    el.innerHTML = badges
      .map(
        (b) => `
      <div class="badge-chip ${b.unlocked ? "unlocked" : "locked"}" title="${escapeHtml(b.desc)}">
        <span class="badge-chip-icon">${b.icon}</span>
        <span class="badge-chip-label">${b.label}</span>
        ${!b.unlocked ? `<span class="badge-chip-hint">${escapeHtml(b.hint)}</span>` : ""}
      </div>`
      )
      .join("");
  }

  function renderChart(rows) {
    let ordered = [...rows].reverse(); // 時間由舊到新
    // X 軸筆數：0 代表全部，否則只取最近 N 筆（沿用「靠近現在」= 陣列尾端）
    if (chartSettings.xCount > 0 && ordered.length > chartSettings.xCount) {
      ordered = ordered.slice(-chartSettings.xCount);
    }
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
    const fontPx = chartFontSizePx(chartSettings.fontSize);
    const yMin = chartSettings.yMin;
    const yMax = chartSettings.yMax;

    // ---- 科目卡片華麗特效：依「最近一次紀錄」該科目的進步/衛冕/滿分狀況，判斷要播哪一條規則的特效 ----
    // 判斷邏輯沿用 calc.js 既有的獎金計算欄位（progressBonus/defenseBonus/tierKey），
    // 跟獎金算法保持一致。四條規則彼此互斥，判斷優先順序：
    //   final100（最新一次滿分100，獨立判斷，不需要同時進步或衛冕）
    //   > both（進步＋衛冕）> defense（衛冕）> progress（進步）
    function getSubjectRuleKey(name) {
      for (let i = ordered.length - 1; i >= 0; i--) {
        const d = (ordered[i].result?.detail || []).find((x) => x.name === name);
        if (!d) continue;
        const isProgress = d.progressBonus > 0;
        const isDefense = d.defenseBonus > 0;
        const isHundred = d.tierKey === "A";
        if (isHundred) return "final100";
        if (isProgress && isDefense) return "both";
        if (isDefense) return "defense";
        if (isProgress) return "progress";
        return null;
      }
      return null;
    }

    function addMiniChart(title, color, scores, isAverage, ruleKey) {
      const card = document.createElement("div");
      card.className = "card mini-chart-card" + (isAverage ? " mini-chart-average" : "");
      card.innerHTML = `
        <div class="mini-chart-head">
          <div class="mini-chart-title" style="font-size:${fontPx + 1}px;"><span class="dot" style="background:${color}"></span>${escapeHtml(title)}</div>
          <div class="mini-chart-range" style="font-size:${fontPx - 1}px;">${yMin} ~ ${yMax}</div>
        </div>
        <canvas height="${isAverage ? 60 : 160}"></canvas>
      `;
      container.appendChild(card);
      if (!isAverage && ruleKey) bindSubjectCardEffect(card, ruleKey, effectSettings, student.name);

      const chart = new Chart(card.querySelector("canvas"), {
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
          // 開啟點位分數顯示時，在圖表最上方預留空間，讓分數標籤永遠畫在點的上方，不會被裁切或蓋住
          layout: { padding: { top: chartSettings.showPointLabels ? fontPx + 14 : 6 } },
          scales: {
            y: { min: yMin, max: yMax, ticks: { color: "#93a0c2", font: { size: fontPx } }, grid: { color: "#263354" } },
            x: { ticks: { color: "#93a0c2", font: { size: fontPx } }, grid: { color: "#1a2440" } },
          },
        },
      });
      chart.config._jfkdPointLabelOpts = { enabled: chartSettings.showPointLabels, fontSize: fontPx, color: color };
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
      addMiniChart(name, color, scores, false, getSubjectRuleKey(name));
    });
  }

  // 依「規則設定」決定觸發方式：trigger="click"／"hover" 為管理者強制指定，
  // "auto"（預設）則沿用裝置判斷（桌面 hover、觸控點一下）。
  function bindSubjectCardEffect(card, ruleKey, effectSettings, studentName) {
    const rule = effectSettings && effectSettings[ruleKey];
    if (!rule || !rule.enabled) return;
    const useClick = rule.trigger === "click" || (rule.trigger !== "hover" && IS_TOUCH_DEVICE);
    const trigger = () => playEffectById(rule.effect, card, rule.duration, studentName);
    if (useClick) {
      card.addEventListener("click", trigger);
    } else {
      card.addEventListener("mouseenter", trigger);
    }
  }

  // 特效總開關：依素材庫 id 分派到對應的播放函式
  function playEffectById(effectId, card, duration, studentName) {
    const dur = typeof duration === "number" && duration > 0 ? duration : 2000;
    if (effectId === "thumbsUp") playCardEmojiEffect(card, "👍", dur, "pop-effect");
    else if (effectId === "crownSpin") playCardEmojiEffect(card, "👑", dur, "spin-effect");
    else if (effectId === "rocketChart") playCardRocketChart(card, dur);
    else if (effectId === "starburst") playCardStarburst(card, dur);
    else if (effectId === "cardConfetti") playCardConfetti(card, dur);
    else if (effectId === "animalParty") playAnimalParty(studentName, dur);
  }

  // 比讚／皇冠衛冕：卡片內彈出一個大 emoji（約佔卡片一半大小），播完自動淡出移除。
  // CSS 動畫時長會依實際 duration 動態調整，確保不管在管理頁把秒數調長或調短，視覺節奏都對得上。
  function playCardEmojiEffect(card, emoji, duration, animClass) {
    const el = document.createElement("div");
    el.className = "subject-effect-emoji " + animClass;
    el.style.animationDuration = duration / 1000 + "s";
    el.textContent = emoji;
    card.appendChild(el);
    const timer = setTimeout(finish, duration);
    function finish() {
      clearTimeout(timer);
      el.remove();
      activeCardEffects.delete(card);
    }
    registerCardEffect(card, finish);
  }

  // 火箭衝天：一枚大火箭從卡片左下角快速衝向右上角（約佔整段時長的前 40%），
  // 抵達後完全靜止懸停在該處（不飛出畫面、不被卡片邊界裁切），剩餘時間尾端
  // 持續噴出閃爍的錐形燃燒火焰，並隨機噴出向下飄散淡出的小火星，象徵「衝高、往上飛」。
  function playCardRocketChart(card, duration) {
    const wrap = document.createElement("div");
    wrap.className = "subject-effect-rocket";
    const durSec = Math.max(duration / 1000, 0.4);
    const sparkCount = 6;
    let sparksHtml = "";
    for (let i = 0; i < sparkCount; i++) {
      const sx = (-10 - Math.random() * 22).toFixed(1);
      const sy = (28 + Math.random() * 30).toFixed(1);
      const leftJitter = (Math.random() * 10 - 5).toFixed(1);
      const sparkDur = (0.8 + Math.random() * 0.6).toFixed(2);
      const sparkDelay = (-Math.random() * sparkDur).toFixed(2);
      sparksHtml += `<div class="rocket-spark" style="--sx:${sx}px; --sy:${sy}px; left:calc(-4px + ${leftJitter}px); animation-duration:${sparkDur}s; animation-delay:${sparkDelay}s;"></div>`;
    }
    wrap.innerHTML = `
      <div class="rocket-unit">
        <div class="rocket-flame">
          <div class="flame-layer flame-outer"></div>
          <div class="flame-layer flame-mid"></div>
          <div class="flame-layer flame-core"></div>
        </div>
        ${sparksHtml}
        <div class="rocket-emoji">🚀</div>
      </div>
    `;
    card.appendChild(wrap);
    wrap.querySelector(".rocket-unit").style.animationDuration = durSec + "s";
    const timer = setTimeout(finish, duration);
    function finish() {
      clearTimeout(timer);
      wrap.remove();
      activeCardEffects.delete(card);
    }
    registerCardEffect(card, finish);
  }

  // 星光閃耀＋放射光芒：中央一顆大星星彈出，搭配旋轉放射光暈與向外飛散的星芒碎片。
  function playCardStarburst(card, duration) {
    const wrap = document.createElement("div");
    wrap.className = "subject-effect-starburst";
    const sparkCount = 10;
    let sparksHtml = "";
    for (let i = 0; i < sparkCount; i++) {
      sparksHtml += `<div class="starburst-spark" style="--a:${(360 / sparkCount) * i}deg"></div>`;
    }
    wrap.innerHTML = `<div class="starburst-rays"></div><div class="starburst-core">⭐</div>${sparksHtml}`;
    card.appendChild(wrap);
    const durSec = Math.max(duration / 1000, 0.4);
    wrap.querySelectorAll(".starburst-rays, .starburst-core, .starburst-spark").forEach((el) => {
      el.style.animationDuration = durSec + "s";
    });
    const timer = setTimeout(finish, duration);
    function finish() {
      clearTimeout(timer);
      wrap.remove();
      activeCardEffects.delete(card);
    }
    registerCardEffect(card, finish);
  }

  // 卡片內灑花：用 canvas-confetti 把畫布侷限在這張卡片自己的範圍內施放，
  // 不會噴到卡片外面，也不會跟其他科目卡片的效果互相干擾。
  function playCardConfetti(card, duration) {
    if (typeof confetti === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.className = "subject-effect-canvas";
    card.appendChild(canvas);
    const myConfetti = confetti.create(canvas, { resize: true, useWorker: false });
    const end = Date.now() + duration;
    let rafId = null;
    let stopped = false;
    (function frame() {
      if (stopped) return;
      myConfetti({
        particleCount: 6,
        startVelocity: 24,
        spread: 75,
        gravity: 0.9,
        ticks: 160,
        origin: { x: Math.random(), y: Math.random() * 0.35 },
        colors: ["#ffd54a", "#4fd1c5", "#63b3ff", "#ff8fa3", "#ffffff"],
      });
      if (Date.now() < end) {
        rafId = requestAnimationFrame(frame);
      } else {
        finish();
      }
    })();
    function finish() {
      if (stopped) return;
      stopped = true;
      if (rafId) cancelAnimationFrame(rafId);
      canvas.remove();
      activeCardEffects.delete(card);
    }
    registerCardEffect(card, finish);
  }

  // 動物派對嘉年華：整個頁面彈出約 2/3 版面大小的動物派對賀卡，搭配全螢幕 confetti 禮炮效果，
  // 播完（或使用者點擊卡片以外的地方）就淡出收掉。全部使用通用動物 emoji，沒有使用任何官方角色圖或真人肖像。
  function playAnimalParty(studentName, duration) {
    const overlay = document.createElement("div");
    overlay.className = "animal-party-overlay";
    const animals = ["🐶", "🐱", "🐰", "🦊", "🐼", "🦁", "🐯", "🐨", "🐸", "🐵"];
    overlay.innerHTML = `
      <div class="animal-party-box">
        <div class="animal-party-title">🎉 恭喜滿分 100！${escapeHtml(studentName || "")} 太厲害了！🎉</div>
        <div class="animal-party-sub">這一科最新一次直接考了滿分，超級全能！</div>
        <div class="animal-party-animals">
          ${animals.map((a, i) => `<span style="animation-delay:${(i % 5) * 0.15}s;">${a}</span>`).join("")}
        </div>
      </div>`;
    document.body.appendChild(overlay);

    let burstTimer = null;
    if (typeof confetti !== "undefined") {
      burstTimer = setInterval(() => {
        confetti({
          particleCount: 60,
          spread: 100,
          startVelocity: 45,
          origin: { x: Math.random(), y: 0.1 },
          colors: ["#ffd54a", "#4fd1c5", "#63b3ff", "#ff8fa3", "#34d399", "#ffffff"],
        });
      }, 350);
    }
    let disposed = false;
    const timer = setTimeout(finish, duration);
    function finish() {
      if (disposed) return;
      disposed = true;
      clearTimeout(timer);
      if (burstTimer) clearInterval(burstTimer);
      overlay.classList.add("fading-out");
      setTimeout(() => overlay.remove(), 400);
      activeFullpage = null;
    }
    registerFullpageEffect(overlay, finish);
  }

  // 依學期文字（例如「四下」「國一上」「高三下」）判斷屬於哪個學制，轉成表格顯示用文字
  function schoolLevelLabel(semesterText) {
    const s = (semesterText || "").trim();
    if (s.startsWith("國")) return "國中";
    if (s.startsWith("高")) return "高中";
    return s ? "國小" : "-";
  }

  // 處罰狀態徽章：不需處罰／尚未執行處罰／已執行處罰
  function punishmentBadge(r) {
    if (!r.result.hasPunishment) return '<span class="badge badge-normal">不需處罰</span>';
    return r.punishmentStatus === "done"
      ? '<span class="badge badge-done">已執行處罰</span>'
      : '<span class="badge badge-penalty">尚未執行處罰</span>';
  }

  // 獎金狀態徽章：無獎金／尚未發放獎金／已發放獎金
  function bonusBadge(r) {
    if (!(r.total > 0)) return '<span class="badge badge-normal">無獎金</span>';
    return r.bonusStatus === "done"
      ? '<span class="badge badge-done">已發放獎金</span>'
      : '<span class="badge badge-warn">尚未發放獎金</span>';
  }

  function renderTable(rows) {
    const tbody = document.querySelector("#recordsTable tbody");
    if (!rows.length) {
      tbody.innerHTML = `<tr><td colspan="10" class="empty-state">還沒有任何紀錄，點右上角「新增考試紀錄」開始記錄吧！</td></tr>`;
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
          <td>${punishmentBadge(r)}</td>
          <td>${bonusBadge(r)}</td>
          <td style="white-space:nowrap;">
            <button class="btn btn-sm" data-edit-id="${r.id}">編輯</button>
            <button class="btn btn-sm btn-danger" data-del-id="${r.id}">刪除</button>
          </td>
        </tr>`;
      })
      .join("");

    tbody.querySelectorAll("button[data-del-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const ok = await confirmDialog("確定要刪除這筆紀錄嗎？此動作無法復原。", { title: "刪除紀錄", confirmText: "刪除" });
        if (!ok) return;
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

  function fmtDateTime(ts) {
    if (!ts || typeof ts.toDate !== "function") return null;
    return ts.toDate().toLocaleString("zh-Hant-TW", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  // ------------------------------------------------------------------
  function setupForm(profiles, defaultProfileId, student) {
    const formEl = document.getElementById("recordForm");
    const formTitleEl = document.getElementById("recordFormTitle");
    const saveBtn = document.getElementById("saveRecordBtn");
    let editingRecordId = null;

    // 目前表單正在使用的設定檔內容（依 #fRuleProfile 選單即時切換）
    const profileSelectEl = document.getElementById("fRuleProfile");
    profileSelectEl.innerHTML = profiles
      .map((p) => `<option value="${p.id}">${escapeHtml(p.name || "未命名設定檔")}${p.id === defaultProfileId ? "（預設）" : ""}</option>`)
      .join("");
    let rules = defaultRules();
    function refreshRulesFromSelectedProfile() {
      const profile = profiles.find((p) => p.id === profileSelectEl.value);
      rules = profile ? { ...defaultRules(), ...profile } : defaultRules();
    }
    profileSelectEl.addEventListener("change", () => {
      refreshRulesFromSelectedProfile();
      updatePreview();
    });

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
        const bonusRow = document.getElementById("bonusStatusRow");
        if (previewEl) previewEl.innerHTML = "";
        if (punishmentRow) punishmentRow.style.display = "none";
        if (bonusRow) bonusRow.style.display = "none";
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

    const recordMetaInfoEl = document.getElementById("recordMetaInfo");

    document.getElementById("openFormBtn").addEventListener("click", () => {
      editingRecordId = null;
      setFormMode("create");
      setDashboardSummaryVisible(false);
      document.getElementById("fDate").valueAsDate = new Date();
      document.getElementById("fExamType").value = "期中";
      document.getElementById("fNote").value = "";
      const punishmentSelectReset = document.getElementById("fPunishmentStatus");
      if (punishmentSelectReset) punishmentSelectReset.value = "pending";
      const bonusSelectReset = document.getElementById("fBonusStatus");
      if (bonusSelectReset) bonusSelectReset.value = "pending";
      if (recordMetaInfoEl) recordMetaInfoEl.style.display = "none";

      // 新增紀錄一律先套用目前的家庭預設設定檔，可在下拉選單改用其他設定檔
      profileSelectEl.value = defaultProfileId || (profiles[0] && profiles[0].id) || "";
      refreshRulesFromSelectedProfile();

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
          <span class="subject-name-cell">
            <span class="subject-badges"></span>
            <span class="subj-label">${escapeHtml(name)}</span>
          </span>
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
      const bonusRow = document.getElementById("bonusStatusRow");
      if (subjectsBlocked) {
        previewEl.innerHTML = "";
        if (punishmentRow) punishmentRow.style.display = "none";
        if (bonusRow) bonusRow.style.display = "none";
        return;
      }
      const subjects = collectSubjects();
      if (!subjects.length) {
        previewEl.innerHTML = "請至少輸入一科分數";
        if (punishmentRow) punishmentRow.style.display = "none";
        if (bonusRow) bonusRow.style.display = "none";
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
      if (bonusRow) bonusRow.style.display = result.total > 0 ? "block" : "none";

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

      const record = {
        studentId,
        date,
        semester: semesterVal,
        examType: examTypeVal,
        subjects: subjectsWithPrev,
        note: document.getElementById("fNote").value.trim(),
        ruleProfileId: profileSelectEl.value || defaultProfileId || null,
      };

      const isEdit = !!editingRecordId;
      const calcResult = calcExamRecord(subjectsWithPrev, rules);

      if (calcResult.hasPunishment) {
        const statusSelect = document.getElementById("fPunishmentStatus");
        record.punishmentStatus = statusSelect ? statusSelect.value : "pending";
      } else if (isEdit) {
        // 分數已修正到不再需要處罰，若編輯時清掉了先前的處罰狀態欄位
        record.punishmentStatus = firebase.firestore.FieldValue.delete();
      }

      if (calcResult.total > 0) {
        const bonusSelect = document.getElementById("fBonusStatus");
        record.bonusStatus = bonusSelect ? bonusSelect.value : "pending";
      } else if (isEdit) {
        record.bonusStatus = firebase.firestore.FieldValue.delete();
      }

      saveBtn.disabled = true;
      saveBtn.textContent = isEdit ? "更新中..." : "儲存中...";
      try {
        if (isEdit) {
          await updateExamRecord(editingRecordId, record);
          showToast("已更新 ✓");
          setTimeout(() => window.location.reload(), 900);
        } else {
          await addExamRecord(record);
          const improvedCount = calcResult.detail.filter((d) => d.progressBonus > 0).length;
          if (calcResult.total > 0) {
            const parts = [`本次獎金 ${fmtMoney(calcResult.total)}`];
            if (improvedCount > 0) parts.push(`${improvedCount} 科進步了`);
            celebrate("🎉 新增成功！", parts.join("，"));
            setTimeout(() => window.location.reload(), 1900);
          } else {
            showToast("已新增紀錄");
            setTimeout(() => window.location.reload(), 900);
          }
        }
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
      document.getElementById("fNote").value = record.note || "";
      const punishmentSelectLoad = document.getElementById("fPunishmentStatus");
      if (punishmentSelectLoad) punishmentSelectLoad.value = record.punishmentStatus === "done" ? "done" : "pending";
      const bonusSelectLoad = document.getElementById("fBonusStatus");
      if (bonusSelectLoad) bonusSelectLoad.value = record.bonusStatus === "done" ? "done" : "pending";

      // 這筆紀錄套用的設定檔（沒存過就用目前的家庭預設檔），可在此更換
      profileSelectEl.value = (record.ruleProfileId && profiles.some((p) => p.id === record.ruleProfileId))
        ? record.ruleProfileId
        : defaultProfileId || (profiles[0] && profiles[0].id) || "";
      refreshRulesFromSelectedProfile();

      // 建立/修改時間僅作為記錄顯示在編輯畫面，不出現在任何列表欄位中
      const createdText = fmtDateTime(record.createdAt);
      const updatedText = fmtDateTime(record.updatedAt);
      if (recordMetaInfoEl) {
        const parts = [];
        if (createdText) parts.push(`建立於 ${createdText}`);
        if (updatedText) parts.push(`最後修改於 ${updatedText}`);
        recordMetaInfoEl.textContent = parts.join("　");
        recordMetaInfoEl.style.display = parts.length ? "block" : "none";
      }

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
