/* app.js — 孩子模式（手機優先，5 分頁：首頁／成績／圖鑑／許願池／造型）
   ------------------------------------------------------------------------
   ★ 這支程式「只讀取」考試紀錄與獎金計算結果，完全不會修改 examRecords、
     ruleProfiles、subjectPresets、wishlist 等既有資料；獎金一律沿用
     calc.js 的 calcExamRecord()＋pickRulesForRecord()，與家長端算出來的數字完全一致。
   ★ 會寫入 students/{id} 的欄位只有：dailyTaskCompletions、xpFromTasks、streak、badges、
     themeId（孩子自己換造型時）、taskFlags（早鳥/夜貓等隱藏徽章旗標）。
*/
(async function () {
  await requireGuard();
  await applySiteFontScale();

  // ---------------------------------------------------------------- 載入資料
  const [students, profiles, settings, globalChartSettings, effectSettings] = await Promise.all([
    listStudents(),
    listRuleProfiles(),
    getSettings(),
    getChartSettings(),
    getEffectSettings(),
  ]);
  const defaultProfileId = settings.defaultProfileId || (profiles[0] && profiles[0].id) || null;

  if (!students.length) {
    document.querySelector(".kid-main").innerHTML =
      '<div class="kid-empty">還沒有建立學生資料<br>請家長先到「家長模式 → 學生名單」新增</div>';
    return;
  }

  // 【2026-08-01】App 重新開啟時（iOS 桌面圖示每次啟動）一律固定先顯示「ㄎㄎ」的首頁，
  // 不記住上次瀏覽的學生。找不到叫這個名字的學生時，退回第一位學生。
  const DEFAULT_STUDENT_NAME = "ㄎㄎ";
  let currentId = (students.find((s) => s.name === DEFAULT_STUDENT_NAME) || students[0]).id;

  // 每位學生的資料快取（避免切換分頁重複讀 Firestore）
  const cache = {};

  async function loadStudent(id) {
    if (cache[id]) return cache[id];
    let [student, records] = await Promise.all([getStudent(id), listExamRecords(id)]);

    // 【規矩框架】每次真正重新載入這位學生時，順便檢查是否有錯過的週五結算，有就自動補算
    try {
      const settled = await runWeeklySettlementIfDue(student);
      student = settled.student;
      if (settled.newSettlements.length) {
        setTimeout(() => showRuleSettlementToasts(settled.newSettlements), 700);
      }
    } catch (e) { /* 離線時先不擋畫面，之後開啟時再補算 */ }

    const enriched = (records || []).map((r) => {
      const result = calcExamRecord(r.subjects || [], pickRulesForRecord(r, profiles, defaultProfileId));
      return { ...r, result, total: result.total };
    });
    // ruleBonusTotal（規矩結算累積的獎金）併入總獎金，XP 計算會自動同步（見 xpOf）
    const totalBonus = enriched.reduce((a, r) => a + r.total, 0) + (Number(student.ruleBonusTotal) || 0);
    cache[id] = { student, rows: enriched, totalBonus };
    return cache[id];
  }

  function showRuleSettlementToasts(settlements) {
    settlements.forEach((s, i) => {
      setTimeout(() => {
        if (s.netJumpingJacks > 0) {
          badgeToast({ i: "⚡", n: `上週結算：要罰 ${s.punishmentCount} 下開合跳，等家長執行` });
        } else if (s.bonusAmount > 0) {
          badgeToast({ i: "🎉", n: `上週結算：早到表現優秀，獲得獎金 ${fmtMoney(s.bonusAmount)}！` });
        }
      }, i * 1400);
    });
  }

  // ---------------------------------------------------------------- 共用小工具
  function xpOf(ctx) {
    // XP = 累計獎金（1 元 = 1 點）＋ 每日任務累積
    return Math.max(0, Math.round(ctx.totalBonus)) + (Number(ctx.student.xpFromTasks) || 0);
  }
  function tasksOf(ctx) {
    return normalizeDailyTasks(ctx.student.dailyTasks);
  }
  /** U9：孩子端「今日任務」只顯示今天適用星期幾的任務 */
  function todaysTasksOf(ctx) {
    return tasksOf(ctx).filter((t) => taskAppliesToday(t));
  }
  function doneTodaySet(ctx) {
    return new Set((ctx.student.dailyTaskCompletions || {})[todayStr()] || []);
  }
  function initialOf(name) {
    return (name || "?").slice(0, 1);
  }
  /** 座號欄位早期有些學生存的是預留文字「?」，一律當成「還沒填」處理，不要把裸露的問號顯示出來 */
  function isUnsetSeat(v) {
    return !v || String(v).trim() === "?";
  }
  /** 家長端可編輯的個人資料卡文字：「XX國小 302班 15號」，缺哪一項就自動省略 */
  function profileMetaText(student) {
    const parts = [];
    if (student.schoolName) parts.push(student.schoolName);
    if (student.className) parts.push(student.className + "班");
    if (!isUnsetSeat(student.seatNumber)) parts.push(student.seatNumber + "號");
    return parts.join(" · ");
  }

  /** 套用該學生的主題造型到整個孩子模式（背景／卡片／火焰／XP條／分頁列全部換色） */
  function applyTheme(student) {
    Object.values(STUDENT_THEMES).forEach((t) => document.body.classList.remove(t.bodyClass));
    const theme = getStudentTheme(student && student.themeId);
    if (theme) document.body.classList.add(theme.bodyClass);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", getComputedStyle(document.body).getPropertyValue("--kid-bg").trim() || "#FFF7EE");
    return theme;
  }

  /** 主題橫幅：顯示大標題／小標題（可在家長端「主題造型」頁個別覆寫） */
  function themeBannerBlock(student) {
    const theme = getStudentTheme(student.themeId);
    if (!theme) return "";
    const title = student.bannerTitle || `${student.name} · ${theme.name}`;
    const tagline = student.bannerTagline || theme.tagline || "";
    return `<div class="kid-banner">
      <div class="kid-banner-icon">${themeIconSvg(theme.id)}</div>
      <div class="kid-banner-text">
        <div class="kid-banner-title">${escapeHtml(title)}</div>
        <div class="kid-banner-tagline">${escapeHtml(tagline)}</div>
      </div>
    </div>`;
  }

  function floatXp(x, y, text, color) {
    const el = document.createElement("div");
    el.className = "xp-float";
    el.textContent = text;
    if (color) el.style.color = color;
    el.style.left = x - 16 + "px";
    el.style.top = y - 26 + "px";
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 1000);
  }

  function cssVar(name, fallback) {
    return (getComputedStyle(document.body).getPropertyValue(name) || "").trim() || fallback || "#7B5CFF";
  }

  function badgeToast(badge) {
    const el = document.createElement("div");
    el.className = "badge-unlock-toast";
    el.innerHTML = `<span style="font-size:1.5em">${badge.i || badge.icon}</span>
      <span>解鎖新徽章：${escapeHtml(badge.n || badge.name)}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
    if (typeof confetti !== "undefined") {
      confetti({ particleCount: 70, spread: 90, startVelocity: 40, origin: { y: 0.75 },
        colors: [cssVar("--k-accent"), cssVar("--k-accent2"), "#FFD166", cssVar("--k-good"), "#ffffff"] });
    }
  }

  // ---- U11：溫和的錯誤提示，取代原生 alert() ----
  function showErrorToast(msg) {
    const el = document.createElement("div");
    el.className = "badge-unlock-toast error-toast";
    el.innerHTML = `<span style="font-size:1.3em">📡</span><span>${escapeHtml(msg)}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3800);
  }
  function friendlyErrorMsg(err) {
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return "目前沒有網路連線，請確認網路後再試一次，你剛剛的操作沒有遺失";
    }
    const code = err && err.code;
    const msg = (err && err.message) || "";
    if (code === "unavailable" || /network|offline/i.test(msg)) {
      return "網路不太穩定，請稍後再試一次";
    }
    return "操作失敗：" + (msg || "請稍後再試一次");
  }

  // ---- U4：徽章解鎖全螢幕慶祝（比小 toast 更有儀式感），多個徽章依序播放 ----
  const celebrateQueue = [];
  let celebrating = false;
  function queueBadgeCelebration(badges) {
    celebrateQueue.push(...badges);
    if (!celebrating) playNextCelebration();
  }
  function playNextCelebration() {
    const badge = celebrateQueue.shift();
    if (!badge) { celebrating = false; return; }
    celebrating = true;
    const overlay = document.createElement("div");
    overlay.className = "badge-celebrate-overlay";
    overlay.innerHTML = `
      <div class="badge-celebrate-card">
        <div class="badge-celebrate-label">🎉 解鎖新成就！</div>
        <div class="badge-celebrate-icon">${badge.i || badge.icon}</div>
        <div class="badge-celebrate-name">${escapeHtml(badge.n || badge.name)}</div>
        ${badge.rarityName ? `<div class="badge-celebrate-rarity">${escapeHtml(badge.rarityName)}</div>` : ""}
        <div class="badge-celebrate-hint">點一下繼續</div>
      </div>`;
    document.body.appendChild(overlay);
    if (typeof confetti !== "undefined") {
      confetti({ particleCount: 130, spread: 110, startVelocity: 48, origin: { y: 0.6 },
        colors: [cssVar("--k-accent"), cssVar("--k-accent2"), "#FFD166", cssVar("--k-good"), "#ffffff"] });
    }
    let done = false;
    const t = setTimeout(advance, 2600);
    overlay.addEventListener("click", advance);
    function advance() {
      if (done) return;
      done = true;
      clearTimeout(t);
      overlay.classList.add("fading-out");
      setTimeout(() => { overlay.remove(); playNextCelebration(); }, 300);
    }
  }

  // ---- U1：每日心情打卡強制彈窗
  // 【2026-08-04 改版】不再是「一進首頁就問」，改成完成當天第一項每日任務後才跳出；
  // 如果跳出當下沒有實際選擇，之後每完成一項任務都會再問一次，直到當天有選過心情為止
  // （靠 hasMoodToday(ctx.student) 判斷是否已經問過/填過）。----
  function moodGateHtml() {
    return `<div class="mood-gate" id="moodGate">
      <div class="mood-gate-card">
        <div class="mood-gate-title">哈囉！今天過得如何呀？</div>
        <div class="mood-gate-sub">選一個代表今天心情的表情吧</div>
        <div class="mood-gate-options">
          ${MOOD_OPTIONS.map((m) => `<button class="mood-opt" data-mood="${m.id}">
            <span class="mood-emoji">${m.emoji}</span><span class="mood-label">${escapeHtml(m.label)}</span>
          </button>`).join("")}
        </div>
      </div>
    </div>`;
  }
  function maybeShowMoodGate(ctx) {
    if (hasMoodToday(ctx.student) || document.getElementById("moodGate")) return;
    document.body.insertAdjacentHTML("beforeend", moodGateHtml());
    const gate = document.getElementById("moodGate");
    gate.querySelectorAll("[data-mood]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (gate.dataset.busy) return;
        gate.dataset.busy = "1";
        const moodId = btn.dataset.mood;
        let saved = false;
        try {
          const prevBest = (ctx.student.moodStreak && ctx.student.moodStreak.best) || ctx.student.moodStreakBest || 0;
          const r = await saveMoodToday(ctx.student.id, moodId, ctx.student.moodLog, prevBest);
          ctx.student.moodLog = r.moodLog;
          ctx.student.moodStreak = { best: r.moodStreakBest };
          saved = true;
        } catch (e) { /* 離線時先不擋，明天再問一次即可 */ }
        gate.classList.add("fading-out");
        setTimeout(async () => {
          gate.remove();
          if (saved) {
            // 選完心情後：①判定並可能解鎖「心情系列」徽章 ②重畫首頁讓月曆立刻顯示今天的表情
            await refreshBadges(ctx, { celebrate: true });
            renderHome(ctx);
          }
        }, 260);
      });
    });
  }

  /** 依最新資料重新判定徽章；有新解鎖就寫回 Firestore 並跳慶祝 */
  async function refreshBadges(ctx, { celebrate } = {}) {
    const tasks = tasksOf(ctx);
    const taskStats = buildTaskStats(ctx.student, tasks);
    const streak = normalizeStreak(ctx.student.streak);
    const moodStreak = ctx.student.moodStreak || { best: ctx.student.moodStreakBest || 0 };
    const bctx = buildBadgeContext({
      rows: ctx.rows, totalBonus: ctx.totalBonus, student: ctx.student,
      streak, taskStats, totalXp: xpOf(ctx), moodStreak,
    });
    ctx.badgeCtx = bctx; // U5「即將解鎖」要用這份數值算進度
    const res = evaluateBadges(bctx, ctx.student.badges || {}, todayStr());
    if (res.newlyUnlocked.length) {
      ctx.student.badges = res.unlockedMap;
      try { await saveUnlockedBadges(ctx.student.id, res.unlockedMap); } catch (e) { /* 離線也不影響瀏覽 */ }
      // U4：改成全螢幕慶祝（比小 toast 更有儀式感），依序播放不會同時疊在一起
      if (celebrate) queueBadgeCelebration(res.newlyUnlocked);
    }
    ctx.badgeResult = res;
    return res;
  }

  /** 記錄隱藏徽章用的時間旗標（早鳥／夜貓／生日） */
  async function markTaskFlags(ctx) {
    const h = new Date().getHours();
    const flags = { ...(ctx.student.taskFlags || {}) };
    let changed = false;
    if (h < 7 && !flags.earlyBird) { flags.earlyBird = true; changed = true; }
    if (h >= 21 && !flags.nightOwl) { flags.nightOwl = true; changed = true; }
    const bd = ctx.student.birthday; // "MM-DD"
    if (bd && todayStr().slice(5) === bd && !flags.birthdayCheckIn) { flags.birthdayCheckIn = true; changed = true; }
    if (changed) {
      ctx.student.taskFlags = flags;
      try { await updateStudent(ctx.student.id, { taskFlags: flags }); } catch (e) { /* 忽略 */ }
    }
  }

  // ================================================================ 首頁
  function renderHome(ctx) {
    const s = ctx.student;
    document.getElementById("homeAvatar").textContent = initialOf(s.name);
    document.getElementById("homeAvatar").style.background = s.color || "#4f7cff";
    document.getElementById("homeName").textContent = s.name || "";
    const metaEl = document.getElementById("homeMeta");
    if (metaEl) metaEl.textContent = profileMetaText(s);

    const streak = normalizeStreak(s.streak);
    const xp = xpOf(ctx);
    const lv = levelInfo(xp);
    const tasks = todaysTasksOf(ctx); // U9：只顯示今天適用的任務
    const done = doneTodaySet(ctx);

    // 下一個連續打卡里程碑
    const msList = Object.keys(STREAK_MILESTONES).map(Number).sort((a, b) => a - b);
    const nextMs = msList.find((m) => m > streak.count) || null;
    const prevMs = [...msList].reverse().find((m) => m <= streak.count) || 0;
    const msPct = nextMs ? Math.min(100, Math.round(((streak.count - prevMs) / (nextMs - prevMs)) * 100)) : 100;

    const latest = ctx.rows[0];

    document.getElementById("homeBody").innerHTML = `
      ${themeBannerBlock(s)}
      <div class="streak-hero">
        <div class="streak-flame">🔥</div>
        <div class="streak-num">${streak.count}</div>
        <div class="streak-label">連 續 打 卡</div>
        <div class="streak-chips">
          <div class="streak-chip">🛡️ 護盾卡 × ${streak.shields}</div>
          <div class="streak-chip">📅 累計 ${streak.totalDays} 天</div>
          ${streak.best > streak.count ? `<div class="streak-chip">🏅 最高 ${streak.best} 天</div>` : ""}
        </div>
        <div class="streak-goal">
          <div class="streak-goal-track"><div class="streak-goal-fill" style="width:${msPct}%"></div></div>
          <div class="streak-goal-text">${
            nextMs ? `再 ${nextMs - streak.count} 天達成 ${nextMs} 天里程碑，可獲得 ${STREAK_MILESTONES[nextMs]} XP`
                   : "已達成所有連續打卡里程碑 🎉"
          }</div>
        </div>
      </div>

      ${comebackBannerHtml(streak)}

      <div class="kid-card" style="margin-top:13px">
        <div class="xp-head">
          <div class="xp-level">Lv.${lv.level} <span>${lv.title}</span></div>
          <div class="xp-total">${xp.toLocaleString()} XP</div>
        </div>
        <div class="xp-track"><div class="xp-fill" style="width:${lv.pct}%"></div></div>
        <div class="xp-hint">${lv.next === null ? "已達最高等級 🎉" : `⚡ 還差 <b>${lv.toNext.toLocaleString()}</b> XP 就升到 Lv.${lv.level + 1}！`}</div>
      </div>

      <div class="kid-card">
        <div class="kid-card-title">今日任務 <small>${done.size} / ${tasks.length} 完成</small></div>
        <div id="taskList">${
          tasks.length
            ? tasks.map((t) => taskHtml(t, done.has(t.id))).join("")
            : '<div class="kid-empty">還沒有設定每日任務<br>請家長到「家長模式 → 每日任務設定」新增</div>'
        }</div>
        ${tasks.length && done.size === tasks.length ? `<div class="kid-perfect">🎉 完美一天！額外 +${PERFECT_DAY_XP} XP</div>` : ""}
      </div>

      ${latest ? `
      <div class="kid-card">
        <div class="kid-card-title">最新成績 <small>${escapeHtml(latest.semester || "")} ${escapeHtml(latest.examType || "")}</small></div>
        <div style="display:flex;align-items:center;gap:12px">
          <div style="font-size:calc(30px * var(--font-scale,1));font-weight:900;color:var(--k-accent)">${latest.result.avgScore}</div>
          <div style="flex:1;min-width:0">
            ${diffText(ctx)}
            <div style="font-size:calc(11px * var(--font-scale,1));color:var(--kid-faint);margin-top:2px">
              獲得獎金 ${fmtMoney(latest.total)} · ${bonusStateText(latest)}
            </div>
          </div>
          <button class="kid-pill ghost" data-goto="score">看全部 ›</button>
        </div>
      </div>` : `
      <div class="kid-card"><div class="kid-empty">還沒有考試紀錄<br>請家長到「家長模式」新增第一筆</div></div>`}

      <div class="kid-card">
        <div class="kid-card-title">最近 28 天打卡</div>
        <div class="kid-cal">${calendarHtml(ctx)}</div>
        <div class="kid-cal-legend">
          <span><i class="kid-dot" style="background:var(--k-warm-grad)"></i>有打卡</span>
          <span><i class="kid-dot" style="background:var(--k-soft-bg2)"></i>沒打卡</span>
          <span>😊 當天心情</span>
        </div>
      </div>
    `;

    bindTasks(ctx);
    document.querySelectorAll("[data-goto]").forEach((b) =>
      b.addEventListener("click", () => switchTab(b.dataset.goto)));
  }

  /** U2 復活賽提示條：斷線且護盾用完時顯示，鼓勵孩子今天多完成 1 項任務就能找回紀錄 */
  function comebackBannerHtml(streak) {
    const cb = streak.comeback;
    if (!cb || !cb.active) return "";
    const remain = Math.max(0, cb.need - (cb.tasksDone || 0));
    const hoursLeft = Math.max(0, Math.ceil((cb.deadline - Date.now()) / 3600000));
    return `<div class="comeback-banner">
      <div class="comeback-banner-icon">⚡</div>
      <div class="comeback-banner-text">
        <div class="comeback-banner-title">復活賽進行中！</div>
        <div class="comeback-banner-desc">${
          remain > 0
            ? `再完成 <b>${remain}</b> 項任務，就能把連續 <b>${cb.prevCount + 1}</b> 天的紀錄找回來！（剩 ${hoursLeft} 小時）`
            : "馬上就要成功了！"
        }</div>
      </div>
    </div>`;
  }

  function diffText(ctx) {
    if (ctx.rows.length < 2) return '<div style="font-size:calc(12px * var(--font-scale,1));font-weight:800;color:var(--k-accent)">第一筆紀錄，加油！</div>';
    const d = Math.round((ctx.rows[0].result.avgScore - ctx.rows[1].result.avgScore) * 10) / 10;
    if (d > 0) return `<div style="font-size:calc(12px * var(--font-scale,1));font-weight:800;color:var(--k-good)">▲ 比上次進步 ${d} 分</div>`;
    if (d < 0) return `<div style="font-size:calc(12px * var(--font-scale,1));font-weight:800;color:var(--k-pink)">▼ 比上次退步 ${Math.abs(d)} 分</div>`;
    return '<div style="font-size:calc(12px * var(--font-scale,1));font-weight:800;color:var(--kid-soft)">與上次持平</div>';
  }
  function bonusStateText(r) {
    if (!r.bonusStatus) return "無獎金";
    return r.bonusStatus === "done" ? "已發放" : "尚未發放";
  }

  function calendarHtml(ctx) {
    const comp = ctx.student.dailyTaskCompletions || {};
    const moodLog = ctx.student.moodLog || {};
    const today = todayStr();
    let html = "";
    for (let i = 27; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = localDateStr(d);
      const hit = (comp[key] || []).length > 0;
      const mood = MOOD_OPTIONS.find((m) => m.id === moodLog[key]);
      html += `<div class="kid-cal-day ${hit ? "hit" : ""} ${key === today ? "today" : ""}">
        ${d.getDate()}${mood ? `<span class="kid-cal-mood" title="${escapeHtml(mood.label)}">${mood.emoji}</span>` : ""}
      </div>`;
    }
    return html;
  }

  function taskHtml(t, done) {
    return `<div class="kid-task ${done ? "done" : ""}" data-task="${t.id}">
      <div class="kid-task-box">${done ? "✓" : ""}</div>
      <div class="kid-task-name">${escapeHtml(t.name)}</div>
      <div class="kid-task-xp">+${t.xpReward} XP</div>
    </div>`;
  }

  function bindTasks(ctx) {
    document.querySelectorAll("#taskList [data-task]").forEach((el) => {
      el.addEventListener("click", async (ev) => {
        if (el.dataset.busy) return;
        el.dataset.busy = "1";
        const allTasks = tasksOf(ctx);
        const task = allTasks.find((t) => t.id === el.dataset.task);
        if (!task) { delete el.dataset.busy; return; }
        const wasDone = el.classList.contains("done");
        let justCompleted = false;
        try {
          if (!wasDone) {
            await markTaskFlags(ctx);
            const r = await completeDailyTask(ctx.student, task, allTasks);
            ctx.student = r.student;
            justCompleted = true;
            const rect = el.getBoundingClientRect();
            floatXp(rect.right - 40, rect.top, "+" + r.gainedXp);
            if (r.checkIn && r.checkIn.milestone) {
              setTimeout(() => badgeToast({ i: "🔥", n: `連續 ${r.checkIn.milestone} 天！+${r.checkIn.bonusXp} XP` }), 500);
            }
            if (r.checkIn && r.checkIn.usedShield) {
              setTimeout(() => badgeToast({ i: "🛡️", n: "護盾卡幫你保住連續紀錄了！" }), 900);
            }
            if (r.checkIn && r.checkIn.comebackStarted) {
              setTimeout(() => badgeToast({ i: "⚡", n: "開啟復活賽！今天再完成 1 項任務就能找回紀錄" }), 900);
            }
            if (r.comebackResult && r.comebackResult.recovered) {
              setTimeout(() => badgeToast({ i: "🎉", n: `復活成功！接回連續 ${r.comebackResult.count} 天紀錄` }), 900);
            }
          } else {
            const r = await uncompleteDailyTask(ctx.student, task, allTasks);
            ctx.student = r.student;
          }
          await refreshBadges(ctx, { celebrate: true });
          renderHome(ctx);
          // 【2026-08-04】U1 改版：不再是「一進首頁就問」，改成完成當天任一項每日任務後才詢問心情，
          // 若那次沒有實際選擇，maybeShowMoodGate 內部的 hasMoodToday 判斷會讓它在下一次完成任務時再問一次。
          if (justCompleted) maybeShowMoodGate(ctx);
        } catch (err) {
          showErrorToast(friendlyErrorMsg(err));
          delete el.dataset.busy;
        }
      });
    });
  }

  // ================================================================ 規矩
  function ruleCardHtml(rule, ctx, liveStat) {
    const checkedIn = rule.type === "punctuality" && hasArrivalToday(ctx.student, rule.id);
    const todayEntry = checkedIn ? ctx.student.arrivalLog[`${rule.id}_${todayStr()}`] : null;

    let bodyHtml = "";
    if (rule.type === "punctuality") {
      if (checkedIn) {
        const d = todayEntry.deltaMinutes;
        const cls = d > 0 ? "late" : d < 0 ? "early" : "ontime";
        const text = d > 0 ? `今天遲到 ${d} 分鐘（${todayEntry.time} 打卡）`
          : d < 0 ? `今天提早 ${-d} 分鐘（${todayEntry.time} 打卡）🎉`
          : `準時打卡（${todayEntry.time}）👍`;
        bodyHtml = `<div class="rule-checkin-result ${cls}">${text}</div>`;
      } else {
        bodyHtml = `<button class="rule-checkin-btn" data-checkin="${rule.id}">✅ 我準備好了！</button>
          <div class="rule-card-type">規定時間：${escapeHtml(rule.config.deadlineTime)} 前</div>`;
      }
    } else {
      bodyHtml = `<div class="rule-card-type">違規一次固定罰 ${rule.config.defaultCount} 下（由家長登記）</div>`;
    }

    const stat = liveStat && liveStat.perRule[rule.id];
    const jj = stat ? stat.jumpingJacks : 0;
    const jjText = jj > 0 ? `本週目前：+${jj} 下（待罰）` : jj < 0 ? `本週目前：${jj} 下（可抵）` : "本週目前：持平";

    return `<div class="rule-card">
      <div class="rule-card-head">
        <div style="flex:1;min-width:0">
          <div class="rule-card-name">${escapeHtml(rule.name)}</div>
        </div>
      </div>
      ${bodyHtml}
      <div class="rule-progress-row">
        <span>${jjText}</span>
        <span class="rule-progress-net ${jj > 0 ? "pos" : jj < 0 ? "neg" : ""}">${jj > 0 ? "+" : ""}${jj}</span>
      </div>
    </div>`;
  }

  /** 【2026-08-04 UX】規矩分頁下方留白填滿：本週（週一到今天）每天的打卡結果一覽小卡，
   *  只針對「打卡時間累積型」（punctuality）規矩顯示，固定次數型規矩沒有每日打卡的概念。 */
  function weekArrivalHistoryHtml(ctx, rules) {
    const puncRules = rules.filter((r) => r.type === "punctuality");
    if (!puncRules.length) return "";

    const now = new Date();
    const weekdayLabel = ["日", "一", "二", "三", "四", "五", "六"];
    const dow = now.getDay();
    const mondayOffset = dow === 0 ? 6 : dow - 1;
    const days = [];
    for (let i = 0; i <= mondayOffset; i++) {
      days.push(new Date(now.getFullYear(), now.getMonth(), now.getDate() - (mondayOffset - i)));
    }
    const dateKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const todayKey = dateKey(now);

    return puncRules.map((rule) => {
      const cells = days.map((d) => {
        const key = `${rule.id}_${dateKey(d)}`;
        const entry = (ctx.student.arrivalLog || {})[key];
        let cls = "empty", icon = "－", title = "還沒打卡";
        if (entry) {
          if (entry.deltaMinutes > 0) { cls = "late"; icon = "！"; title = `遲到 ${entry.deltaMinutes} 分`; }
          else if (entry.deltaMinutes < 0) { cls = "early"; icon = "✓"; title = `提早 ${-entry.deltaMinutes} 分`; }
          else { cls = "ontime"; icon = "✓"; title = "準時"; }
        }
        return `<div class="rule-week-cell ${cls}${dateKey(d) === todayKey ? " is-today" : ""}" title="${escapeHtml(title)}">
          <div class="rule-week-cell-day">${weekdayLabel[d.getDay()]}</div>
          <div class="rule-week-cell-icon">${icon}</div>
        </div>`;
      }).join("");
      return `<div class="rule-week-summary">
        <div class="kid-card-title">📅 ${escapeHtml(rule.name)}｜本週打卡紀錄</div>
        <div class="rule-week-cells">${cells}</div>
      </div>`;
    }).join("");
  }

  /**
   * 【2026-08-04】原本這裡只顯示「週結算」（settlementHistoryHtml），
   * 家長用「⚡快速登記處罰」單筆登記（不一定綁規矩）的項目完全沒地方在孩子模式出現，
   * 孩子看不到爸媽剛剛登記了什麼。改成把「單筆登記」跟「週結算」按時間合併成一份清單，
   * 格式跟家長模式「處罰清單」頁一致（次數/原因/執行狀態都顯示），全部（待執行＋已執行）都列出來。
   */
  function combinedHistoryHtml(ctx) {
    const student = ctx.student;
    const settlementItems = (student.ruleSettlements || []).map((s) => ({
      ms: s.periodEndMs || 0,
      html: (() => {
        if (s.netJumpingJacks > 0) {
          const tag = s.punishmentStatus === "done"
            ? '<span class="rule-settlement-tag done">已執行</span>'
            : '<span class="rule-settlement-tag pending">待執行</span>';
          return `<div class="rule-settlement-row"><span>${escapeHtml(s.periodEnd)} 週結算</span>
            <span style="margin-left:auto">罰 ${s.punishmentCount} 下</span>${tag}</div>`;
        }
        return `<div class="rule-settlement-row"><span>${escapeHtml(s.periodEnd)} 週結算</span>
          <span style="margin-left:auto">獲得獎金 ${fmtMoney(s.bonusAmount)}</span>${s.bonusStatus === "done" ? '<span class="rule-settlement-tag done">已發放</span>' : '<span class="rule-settlement-tag pending">尚未發放</span>'}</div>`;
      })(),
    }));
    const violationItems = (student.ruleViolations || []).map((v) => {
      const tag = v.executedStatus === "done"
        ? '<span class="rule-settlement-tag done">已執行</span>'
        : '<span class="rule-settlement-tag pending">待執行</span>';
      const reasonText = v.reason ? `｜${escapeHtml(v.reason)}` : "";
      return {
        ms: entryInstantMs(v, "loggedAt", "loggedAtMs"),
        html: `<div class="rule-settlement-row"><span>${escapeHtml(v.loggedAt || "")} 登記${reasonText}</span>
          <span style="margin-left:auto">${v.count} 下</span>${tag}</div>`,
      };
    });
    const list = [...settlementItems, ...violationItems].sort((a, b) => b.ms - a.ms).slice(0, 10);
    if (!list.length) return "";
    return `<div class="rule-week-summary">
      <div class="kid-card-title">📅 處罰／結算紀錄</div>
      ${list.map((item) => item.html).join("")}
    </div>`;
  }

  /**
   * 【2026-08-16】還沒執行完的處罰橫幅。放在規矩分頁最上方（那本來就是這件事的家），
   * 用暖橘色而不是刺眼的紅——目的是讓孩子清楚知道「還有事情沒做完」，不是製造罪惡感。
   * 孩子只能看不能自己按完成：處罰執行需要家長在場見證，讓孩子自己標記會失去意義。
   */
  function pendingPunishBannerHtml(ctx) {
    const total = pendingPunishmentTotalOf(ctx.student);
    if (total <= 0) return "";
    return `
      <div class="kid-pending-banner">
        <div class="kid-pending-icon">💪</div>
        <div class="kid-pending-text">
          <div class="kid-pending-title">還有 ${total} 下${RULE_UNIT_LABEL}要完成</div>
          <div class="kid-pending-sub">做完後請爸爸媽媽幫你確認打勾</div>
        </div>
      </div>`;
  }

  /** 底部導覽「規矩」分頁的小紅點：有未執行的處罰才亮 */
  function syncRulesTabDot(ctx) {
    const dot = document.getElementById("rulesTabDot");
    if (!dot) return;
    dot.hidden =
      pendingPunishmentTotalOf(ctx.student) <= 0 && pendingBonusTotalOf(ctx.student) <= 0;
  }

  /**
   * [2026-08-17] Banner for rule bonus the parent has not handed out yet.
   * Green, to mirror the orange punishment banner: only nagging about punishments
   * would make the app feel like it remembers penalties but forgets rewards.
   * Kid can view only - marking it paid is the parent job.
   */
  function pendingBonusBannerHtml(ctx) {
    const total = pendingBonusTotalOf(ctx.student);
    if (total <= 0) return "";
    return `
      <div class="kid-pending-banner bonus">
        <div class="kid-pending-icon">🎉</div>
        <div class="kid-pending-text">
          <div class="kid-pending-title">有 ${fmtMoney(total)} 獎金還沒發放</div>
          <div class="kid-pending-sub">請爸爸媽媽幫你確認發放</div>
        </div>
      </div>`;
  }

  /** Top of the rules tab: punishment banner first, bonus banner below; both can show at once */
  function rulesBannersHtml(ctx) {
    return pendingPunishBannerHtml(ctx) + pendingBonusBannerHtml(ctx);
  }

  function renderRules(ctx) {
    syncRulesTabDot(ctx);
    const rules = normalizeRules(ctx.student.rules).filter((r) => r.enabled);
    if (!rules.length) {
      document.getElementById("rulesBody").innerHTML =
        rulesBannersHtml(ctx) +
        '<div class="kid-card"><div class="kid-empty">還沒有設定規矩<br>請家長到「家長模式 → 規矩設定」新增</div></div>';
      return;
    }
    const liveStat = computeLiveWeekProgress(ctx.student, rules);
    document.getElementById("rulesBody").innerHTML = `
      ${rulesBannersHtml(ctx)}
      ${rules.map((r) => ruleCardHtml(r, ctx, liveStat)).join("")}
      <div class="rule-week-summary">
        <div class="kid-card-title">本週目前合計</div>
        <div class="rule-progress-row">
          <span>淨開合跳數（每週五晚上自動結算）</span>
          <span class="rule-progress-net ${liveStat.netJumpingJacks > 0 ? "pos" : liveStat.netJumpingJacks < 0 ? "neg" : ""}">
            ${liveStat.netJumpingJacks > 0 ? "+" : ""}${liveStat.netJumpingJacks}
          </span>
        </div>
      </div>
      ${weekArrivalHistoryHtml(ctx, rules)}
      <button class="rule-violation-log-btn" id="ruleQuickLogBtn">🔒 登記處罰（需家長 PIN）</button>
      ${combinedHistoryHtml(ctx)}
    `;

    document.querySelectorAll("[data-checkin]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (btn.dataset.busy) return;
        btn.dataset.busy = "1";
        btn.disabled = true;
        const rule = rules.find((r) => r.id === btn.dataset.checkin);
        try {
          const { student } = await recordArrivalCheckIn(ctx.student, rule);
          ctx.student = student;
          renderRules(ctx);
        } catch (err) {
          showErrorToast(friendlyErrorMsg(err));
          delete btn.dataset.busy;
          btn.disabled = false;
        }
      });
    });

    const logBtn = document.getElementById("ruleQuickLogBtn");
    if (logBtn) {
      logBtn.addEventListener("click", async () => {
        const ok = await requireParentPin();
        if (ok) {
          openQuickViolationModal([ctx.student], (updated) => {
            ctx.student = updated;
            renderRules(ctx);
          });
        }
      });
    }
  }

  // ================================================================ 成績
  let chartSeries = "平均";

  function renderScore(ctx) {
    document.getElementById("scoreMoney").textContent = fmtMoney(ctx.totalBonus);
    const rows = ctx.rows;
    if (!rows.length) {
      document.getElementById("scoreBody").innerHTML =
        '<div class="kid-card"><div class="kid-empty">還沒有考試紀錄<br>請家長到「家長模式」新增第一筆</div></div>';
      return;
    }
    const latest = rows[0];
    const seenKey = "jfkd_seen_" + ctx.student.id;
    const isNew = localStorage.getItem(seenKey) !== latest.id;

    document.getElementById("scoreBody").innerHTML = `
      ${newRecordHtml(ctx, latest, isNew)}
      ${scoreSummaryHtml(ctx)}
      <div class="kid-card">
        <div class="kid-card-title">成績趨勢</div>
        <div class="kid-chart-tabs" id="chartTabs"></div>
        <div class="kid-chart" id="chartBox"></div>
      </div>
      <div class="kid-card-title" style="margin:18px 2px 10px">歷史紀錄 <small>共 ${rows.length} 筆</small></div>
      ${rows.map(recordHtml).join("")}
    `;

    drawChartTabs(ctx);
    drawChart(ctx);

    if (isNew) {
      localStorage.setItem(seenKey, latest.id);
    }
    // 【每次切到「我的成績」都依序輪流播放特效】原本只有第一次看到「新紀錄」時才會自動播，
    // 改成不管是不是新紀錄，只要切到這個分頁就重播一次（跟點擊卡片手動重播是分開的兩件事）。
    setTimeout(() => autoPlayEffects(ctx, latest), 450);
    document.querySelectorAll(".fx-card").forEach((card) => {
      card.addEventListener("click", () => {
        const rule = card.dataset.rule;
        const cfg = effectSettings[rule];
        if (cfg && cfg.enabled) playEffect(cfg.effect, card, cfg.duration, ctx.student.name);
      });
    });
  }

  /** U10：跟上次紀錄比較的整體摘要（幾科進步/退步/持平＋平均分變化），孩子只看單科容易看不到整體趨勢 */
  function scoreSummaryHtml(ctx) {
    const rows = ctx.rows;
    if (rows.length < 2) return "";
    const latest = rows[0], prev = rows[1];
    let up = 0, down = 0, same = 0;
    (latest.subjects || []).forEach((s) => {
      if (typeof s.prevScore !== "number") return;
      if (s.score > s.prevScore) up++;
      else if (s.score < s.prevScore) down++;
      else same++;
    });
    const avgDiff = Math.round((latest.result.avgScore - prev.result.avgScore) * 10) / 10;
    const diffColor = avgDiff > 0 ? "var(--k-good)" : avgDiff < 0 ? "var(--k-pink)" : "var(--kid-soft)";
    const diffIcon = avgDiff > 0 ? "▲" : avgDiff < 0 ? "▼" : "—";
    return `<div class="kid-card score-summary">
      <div class="kid-card-title">📊 這次表現摘要</div>
      <div class="score-summary-row">
        <div class="score-summary-diff" style="color:${diffColor}">${diffIcon} ${avgDiff > 0 ? "+" : ""}${avgDiff} 分</div>
        <div class="score-summary-text">跟上次（${escapeHtml(prev.semester || "")}${escapeHtml(prev.examType || "")}）比起來</div>
      </div>
      ${up + down + same > 0 ? `<div class="score-summary-chips">
        ${up ? `<span class="score-summary-chip up">▲ ${up} 科進步</span>` : ""}
        ${down ? `<span class="score-summary-chip down">▼ ${down} 科退步</span>` : ""}
        ${same ? `<span class="score-summary-chip same">— ${same} 科持平</span>` : ""}
      </div>` : ""}
    </div>`;
  }

  /** 判斷某一科要套用哪一條特效規則（與 student.js 相同的優先序：final100 > both > defense > progress） */
  function ruleForSubject(row, subj) {
    const det = (row.result.detail || []).find((d) => d.name === subj.name) || {};
    const isProgress = det.progressBonus > 0;
    const isDefense = det.defenseBonus > 0;
    const is100 = subj.score >= 100;
    if (is100) return "final100";
    if (isProgress && isDefense) return "both";
    if (isDefense) return "defense";
    if (isProgress) return "progress";
    return null;
  }
  const RULE_LABEL = { progress: "進步", defense: "衛冕成功", both: "進步＋衛冕", final100: "滿分！" };
  const RULE_EMOJI = { progress: "🚀", defense: "👑", both: "✨", final100: "🎉" };

  function newRecordHtml(ctx, latest, isNew) {
    const subs = latest.subjects || [];
    const fx = subs
      .map((s) => ({ s, rule: ruleForSubject(latest, s) }))
      .filter((x) => x.rule && effectSettings[x.rule] && effectSettings[x.rule].enabled);

    return `
      <div class="new-record">
        ${isNew ? '<span class="new-record-tag">✨ NEW 新紀錄</span>' : ""}
        <h3>${escapeHtml(latest.semester || "")} ${escapeHtml(latest.examType || "")}</h3>
        <div class="new-record-sub">${escapeHtml(latest.date || "")} · 平均 ${latest.result.avgScore} 分</div>
        ${fx.length ? `<div class="fx-list">${fx.map(({ s, rule }) => {
          const diff = typeof s.prevScore === "number" ? s.score - s.prevScore : null;
          // 【右側比較文字】原本右邊又大又粗地重複顯示一次分數（跟左邊 fx-name 的「科目 分數」重複），
          // 改成「上次 → 這次」的比較格式，左邊科目名稱已經有了就不再重複；
          // 沒有上次分數可比（該生第一筆紀錄）時顯示「首次 X分」。
          // 進步＝綠、退步＝紅、持平／首次＝灰，三色區分一眼看出方向。
          const cmpClass = diff === null || diff === 0 ? "same" : diff > 0 ? "up" : "down";
          const cmpText = diff === null ? `首次 ${s.score}分` : `${s.prevScore} → ${s.score}`;
          return `<div class="fx-card" data-rule="${rule}">
            <div class="fx-emoji">${RULE_EMOJI[rule]}</div>
            <div class="fx-text">
              <div class="fx-name">${escapeHtml(s.name)} ${s.score} 分</div>
              <div class="fx-desc">${RULE_LABEL[rule]}${diff !== null && diff > 0 ? ` · 進步 ${diff} 分` : ""} · 點一下重播特效</div>
            </div>
            <div class="fx-score ${cmpClass}">${cmpText}</div>
          </div>`;
        }).join("")}</div>` : ""}
        <div class="new-record-bonus">
          <div class="lbl">這次拿到的獎金</div>
          <div class="val">${fmtMoney(latest.total)}</div>
        </div>
      </div>`;
  }

  function autoPlayEffects(ctx, latest) {
    const cards = [...document.querySelectorAll(".fx-card")];
    cards.forEach((card, i) => {
      const cfg = effectSettings[card.dataset.rule];
      if (!cfg || !cfg.enabled) return;
      setTimeout(() => playEffect(cfg.effect, card, cfg.duration, ctx.student.name), i * 700);
    });
  }

  function recordHtml(r) {
    const subs = (r.subjects || []).map((s) => {
      let cls = "", mark = "";
      if (typeof s.prevScore === "number") {
        if (s.score > s.prevScore) { cls = "up"; mark = " ▲"; }
        else if (s.score < s.prevScore) { cls = "down"; mark = " ▼"; }
      }
      return `<span class="kid-sub ${cls}">${escapeHtml(s.name)} ${s.score}${mark}</span>`;
    }).join("");

    let states = "";
    if (r.result.hasPunishment) {
      states += r.punishmentStatus === "done"
        ? '<span class="kid-status bad">⚡ 處罰已執行</span>'
        : '<span class="kid-status wait">⚡ 處罰尚未執行</span>';
    }
    if (r.total > 0) {
      states += r.bonusStatus === "done"
        ? '<span class="kid-status ok">✅ 獎金已發放</span>'
        : '<span class="kid-status wait">💰 獎金尚未發放</span>';
    }

    return `<div class="kid-rec">
      <div class="kid-rec-top">
        <div>
          <div class="kid-rec-title">${escapeHtml(r.semester || "")} ${escapeHtml(r.examType || "")}</div>
          <div class="kid-rec-date">${escapeHtml(r.date || "")}</div>
        </div>
        <div class="kid-rec-avg">${r.result.avgScore}</div>
      </div>
      <div class="kid-subs">${subs}</div>
      <div class="kid-rec-foot">${states}<span class="kid-rec-money">${fmtMoney(r.total)}</span></div>
    </div>`;
  }

  // ---- 趨勢圖（純 SVG，不依賴 Chart.js，手機上比較輕）----
  function seriesList(ctx) {
    const names = new Set();
    ctx.rows.forEach((r) => (r.subjects || []).forEach((s) => names.add(s.name)));
    return ["平均", ...[...names]];
  }
  function drawChartTabs(ctx) {
    const list = seriesList(ctx);
    if (!list.includes(chartSeries)) chartSeries = "平均";
    document.getElementById("chartTabs").innerHTML = list
      .map((k) => `<button class="kid-chart-tab ${k === chartSeries ? "active" : ""}" data-series="${escapeHtml(k)}">${escapeHtml(k)}</button>`)
      .join("");
    document.querySelectorAll("[data-series]").forEach((b) =>
      b.addEventListener("click", () => { chartSeries = b.dataset.series; drawChartTabs(ctx); drawChart(ctx); }));
  }
  function drawChart(ctx) {
    const oldestFirst = [...ctx.rows].reverse();
    const cs = resolveChartSettings(ctx.student, globalChartSettings);
    const limit = Number(cs.xCount) || 0;
    const use = limit > 0 ? oldestFirst.slice(-limit) : oldestFirst;

    const pts = use.map((r) => {
      if (chartSeries === "平均") return { v: r.result.avgScore, label: `${r.semester || ""}${r.examType || ""}` };
      const s = (r.subjects || []).find((x) => x.name === chartSeries);
      return { v: s ? s.score : null, label: `${r.semester || ""}${r.examType || ""}` };
    }).filter((p) => p.v !== null);

    const box = document.getElementById("chartBox");
    if (pts.length === 0) { box.innerHTML = '<div class="kid-empty">這個科目還沒有紀錄</div>'; return; }

    // 【2026-08-04 UX】PR（右側留白）從 12 加大到 28：字級調到「大」/「特大」時，
    // 最後一個資料點的分數標籤（文字置中對齊在點上）常會往右超出，貼近甚至裁切到卡片邊緣。
    const W = 480, H = 210, PT = 34, PB = 40, PL = 30, PR = 28;
    const min = Number(cs.yMin) || 0, max = Number(cs.yMax) || 100;
    const span = Math.max(1, max - min);
    const n = pts.length;
    const x = (i) => (n === 1 ? (W - PL - PR) / 2 + PL : PL + i * ((W - PL - PR) / (n - 1)));
    const y = (v) => PT + (1 - (Math.min(max, Math.max(min, v)) - min) / span) * (H - PT - PB);
    const cssv = getComputedStyle(document.body);
    const color = (chartSeries === "平均"
      ? cssv.getPropertyValue("--k-accent") : cssv.getPropertyValue("--k-warm")).trim() || "#7B5CFF";

    const gridVals = [];
    const step = span <= 40 ? 10 : Math.ceil(span / 4 / 10) * 10;
    for (let v = min; v <= max; v += step) gridVals.push(v);

    const grid = gridVals.map((v) =>
      `<line x1="${PL - 4}" y1="${y(v)}" x2="${W - PR}" y2="${y(v)}" stroke="var(--k-track,#F0ECF7)" stroke-width="1.5"/>
       <text x="2" y="${y(v) + 3}" font-size="11" fill="var(--kid-faint,#C9C3D6)" font-weight="700">${v}</text>`).join("");

    const poly = n > 1 ? `<polyline points="${pts.map((p, i) => `${x(i)},${y(p.v)}`).join(" ")}"
      fill="none" stroke="${color}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` : "";

    const showLabels = cs.showPointLabels !== false;
    const dots = pts.map((p, i) => `
      <circle cx="${x(i)}" cy="${y(p.v)}" r="6" fill="var(--kid-card,#fff)" stroke="${color}" stroke-width="4"/>
      ${showLabels ? `<text x="${x(i)}" y="${y(p.v) - 11}" text-anchor="middle" font-size="14" font-weight="800" fill="${color}">${p.v}</text>` : ""}
      <text x="${x(i)}" y="${H - 9}" text-anchor="middle" font-size="11" fill="var(--kid-faint,#A9A2BC)" font-weight="700">${escapeHtml(p.label)}</text>`).join("");

    const vals = pts.map((p) => p.v);
    const change = Math.round((vals[vals.length - 1] - vals[0]) * 10) / 10;
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeHtml(chartSeries)}成績趨勢圖">${grid}${poly}${dots}</svg>
      <div class="kid-chart-legend"><span>${escapeHtml(chartSeries)}　最高 ${Math.max(...vals)} · 最低 ${Math.min(...vals)}${
        vals.length > 1 ? ` · 變化 ${change > 0 ? "+" : ""}${change}` : ""}</span></div>`;
  }

  // ================================================================ 圖鑑
  let dexGroup = "streak";
  const RARITY_COLOR = { 1: "#9AA3B2", 2: "#3FA9F5", 3: "#A855F7", 4: "#FFA51F" };

  // U5：即將解鎖——只對「有明確累計數字」的徽章算進度，二元條件（例如「曾經考100分」）不列入
  const NEAR_UNLOCK_FIELD = {
    s_3: "streakBest", s_7: "streakBest", s_14: "streakBest", s_30: "streakBest",
    s_50: "streakBest", s_100: "streakBest", s_180: "streakBest", s_365: "streakBest",
    s_weekend: "weekendCount", s_t50: "totalDays", s_t100: "totalDays", s_t200: "totalDays", s_t365: "totalDays",
    c_prog5: "progressCount", c_def5: "defenseCount", c_nopunish3: "noPunishStreak", c_rec10: "recordCount",
    c_combo3: "comboCount", c_halfyear: "longHaulDays", c_money5k: "totalBonus", c_master3: "masterCount",
    t_10: "taskDone", t_50: "taskDone", t_100: "taskDone", t_500: "taskDone",
    t_perfect7: "perfectDays", t_perfect30: "perfectDays",
    t_read30: "readingDone", t_chore30: "choreDone",
    t_xp1k: "totalXp", t_xp5k: "totalXp", t_xp20k: "totalXp", t_lv20: "level",
    x_semester3: "semesterCount", x_wish3: "redeemedCount",
    m_7: "moodStreakBest", m_30: "moodStreakBest",
  };
  const NEAR_UNLOCK_NEED = {
    s_3: 3, s_7: 7, s_14: 14, s_30: 30, s_50: 50, s_100: 100, s_180: 180, s_365: 365,
    s_weekend: 8, s_t50: 50, s_t100: 100, s_t200: 200, s_t365: 365,
    c_prog5: 5, c_def5: 5, c_nopunish3: 3, c_rec10: 10, c_combo3: 3, c_halfyear: 182, c_money5k: 5000, c_master3: 3,
    t_10: 10, t_50: 50, t_100: 100, t_500: 500, t_perfect7: 7, t_perfect30: 30, t_read30: 30, t_chore30: 30,
    t_xp1k: 1000, t_xp5k: 5000, t_xp20k: 20000, t_lv20: 20, x_semester3: 3, x_wish3: 3,
    m_7: 7, m_30: 30,
  };
  function nearUnlockList(ctx, groupKey) {
    const bctx = ctx.badgeCtx || {};
    const unlockedMap = ctx.student.badges || {};
    return BADGES
      .filter((b) => b.g === groupKey && !b.hidden && !unlockedMap[b.id] && NEAR_UNLOCK_FIELD[b.id])
      .map((b) => {
        const field = NEAR_UNLOCK_FIELD[b.id];
        const need = NEAR_UNLOCK_NEED[b.id];
        const have = Number(bctx[field]) || 0;
        return { b, have, need, remain: Math.max(0, need - have), pct: Math.min(100, Math.round((have / need) * 100)) };
      })
      .filter((x) => x.remain > 0)
      .sort((a, b) => a.remain - b.remain)
      .slice(0, 3);
  }
  function nearUnlockHtml(ctx, groupKey) {
    const list = nearUnlockList(ctx, groupKey);
    if (!list.length) return "";
    return `<div class="kid-card near-unlock-card">
      <div class="kid-card-title">🎯 即將解鎖</div>
      ${list.map(({ b, have, need, pct }) => `
        <div class="near-unlock-row">
          <div class="near-unlock-icon">${b.i}</div>
          <div class="near-unlock-info">
            <div class="near-unlock-name">${escapeHtml(b.n)}</div>
            <div class="near-unlock-track"><div style="width:${pct}%"></div></div>
            <div class="near-unlock-num">${have.toLocaleString()} / ${need.toLocaleString()}</div>
          </div>
        </div>`).join("")}
    </div>`;
  }

  async function renderDex(ctx) {
    const res = ctx.badgeResult || (await refreshBadges(ctx));
    const list = res.list;
    const pct = Math.round((res.stats.unlocked / res.stats.total) * 100);

    const tabs = BADGE_GROUPS.map((g) => {
      const sub = list.filter((b) => b.group === g.key);
      const got = sub.filter((b) => b.unlocked).length;
      return `<button class="dex-tab ${g.key === dexGroup ? "active" : ""}" data-dex="${g.key}">${g.label} ${got}/${sub.length}</button>`;
    }).join("");

    const sub = list.filter((b) => b.group === dexGroup);
    const groups = [4, 3, 2, 1].map((r) => {
      const L = sub.filter((b) => b.rarity === r);
      if (!L.length) return "";
      const got = L.filter((b) => b.unlocked).length;
      const cells = L.map((b) => {
        const secret = b.hidden && !b.unlocked;
        return `<div class="dex-badge ${b.unlocked ? "r" + b.rarity : "locked"}" data-badge="${b.id}">
          <div class="dex-badge-icon">${secret ? "❓" : b.icon}</div>
          <div class="dex-badge-name">${secret ? "???" : escapeHtml(b.name)}</div>
        </div>`;
      }).join("");
      return `<div class="dex-rarity-head" style="color:${RARITY_COLOR[r]}">
          ${"★".repeat(r)} ${RARITY_NAME[r]}
          <span style="color:var(--kid-faint,#A9A2BC);font-weight:700">${got}/${L.length}</span>
        </div><div class="dex-grid">${cells}</div>`;
    }).join("");

    document.getElementById("dexBody").innerHTML = `
      <div class="dex-hero">
        <div class="dex-hero-num">${res.stats.unlocked}<small> / ${res.stats.total}</small></div>
        <div class="dex-hero-label">已收集徽章</div>
        <div class="dex-hero-bar"><div style="width:${pct}%"></div></div>
      </div>
      <div class="dex-tabs">${tabs}</div>
      ${nearUnlockHtml(ctx, dexGroup)}
      <div>${groups}</div>`;

    document.querySelectorAll("[data-dex]").forEach((b) =>
      b.addEventListener("click", () => { dexGroup = b.dataset.dex; renderDex(ctx); }));
    document.querySelectorAll("[data-badge]").forEach((b) =>
      b.addEventListener("click", () => openBadge(list, b.dataset.badge)));
  }

  function openBadge(list, id) {
    const idx = list.findIndex((b) => b.id === id);
    const b = list[idx];
    if (!b) return;
    const secret = b.hidden && !b.unlocked;
    document.getElementById("dexModalCard").innerHTML = `
      <div class="dex-modal-icon" style="${b.unlocked ? "" : "filter:grayscale(1) brightness(1.5);opacity:.45"}">${secret ? "❓" : b.icon}</div>
      <div class="dex-modal-no">No. ${String(idx + 1).padStart(3, "0")}</div>
      <div class="dex-modal-name">${secret ? "神秘徽章" : escapeHtml(b.name)}</div>
      <div class="dex-modal-rarity" style="background:${RARITY_COLOR[b.rarity]}">${b.rarityName}</div>
      <div class="dex-modal-cond">${
        b.unlocked ? `✅ 已取得${b.date ? " · " + b.date : ""}<br>${escapeHtml(b.desc)}`
                   : secret ? "🔒 這是隱藏徽章，解鎖後才會顯示條件"
                            : "🔒 " + escapeHtml(b.desc)
      }</div>
      <button class="dex-modal-close" id="dexClose">關閉</button>`;
    document.getElementById("dexModal").classList.add("open");
    document.getElementById("dexClose").addEventListener("click", closeBadge);
  }
  function closeBadge() { document.getElementById("dexModal").classList.remove("open"); }
  document.getElementById("dexModal").addEventListener("click", (e) => {
    if (e.target.id === "dexModal") closeBadge();
  });

  // ================================================================ 許願池（唯讀）
  function renderWish(ctx) {
    document.getElementById("wishMoney").textContent = fmtMoney(ctx.totalBonus);
    const items = (ctx.student.wishlist || []).filter((i) => i && i.name);
    if (!items.length) {
      document.getElementById("wishBody").innerHTML =
        '<div class="kid-card"><div class="kid-empty">還沒有許願項目<br>請家長到「家長模式 → 許願池」新增</div></div>';
      return;
    }
    document.getElementById("wishBody").innerHTML = `
      <div class="kid-note">許願池用的是<b>真實獎金 NT$</b>（考試表現賺到的），跟 XP 是兩套完全分開的系統。</div>
      ${items.map((it) => {
        const total = wishlistItemTotal(it);
        const pct = total > 0 ? Math.min(100, Math.round((ctx.totalBonus / total) * 100)) : 0;
        const achieved = it.status === "achieved";
        const notAchieved = it.status === "notAchieved";
        let state = `<div class="kid-wish-state" style="color:var(--k-warm)">🔥 進行中 · 已累積 ${fmtMoney(Math.min(ctx.totalBonus, total))}</div>`;
        if (achieved) {
          state = it.redeemedDate
            ? `<div class="kid-wish-state" style="color:var(--k-good)">✅ 已達成 · 已於 ${escapeHtml(it.redeemedDate)} 兌現</div>`
            : '<div class="kid-wish-state" style="color:var(--k-good)">✅ 已達成 · 等待兌現</div>';
        } else if (notAchieved) {
          state = '<div class="kid-wish-state" style="color:var(--kid-faint)">下次再挑戰 💪</div>';
        }
        return `<div class="kid-wish ${achieved ? "achieved" : notAchieved ? "not-achieved" : ""}">
          <div class="kid-wish-top">
            <div style="min-width:0">
              <div class="kid-wish-name">${escapeHtml(it.name)}</div>
              ${it.condition ? `<div class="kid-wish-cond">🎯 ${escapeHtml(it.condition)}</div>` : ""}
              ${otherContributorsBadgeHtml(it) ? `<div style="margin-top:6px">${otherContributorsBadgeHtml(it)}</div>` : ""}
            </div>
            <div class="kid-wish-amt">${fmtMoney(total)}</div>
          </div>
          <div class="kid-wish-bar"><div style="width:${achieved ? 100 : pct}%"></div></div>
          ${state}
        </div>`;
      }).join("")}`;
  }

  // ================================================================ 造型
  const THEME_ORDER = ["", "zoro", "babymonster", "galaxy", "lava", "aurora", "gold"];
  const THEME_SWATCH = {
    "": "theme-swatch-default", zoro: "theme-swatch-zoro", babymonster: "theme-swatch-babymonster",
    galaxy: "theme-swatch-galaxy", lava: "theme-swatch-lava", aurora: "theme-swatch-aurora", gold: "theme-swatch-gold",
  };
  const THEME_ICON = { "": "🎨", zoro: "⚔️", babymonster: "🖤", galaxy: "🌌", lava: "🌋", aurora: "🌲", gold: "👑" };

  function renderTheme(ctx) {
    const xp = xpOf(ctx);
    document.getElementById("themeXp").textContent = xp.toLocaleString() + " XP";
    const cur = ctx.student.themeId || "";

    const cards = THEME_ORDER.map((id) => {
      const theme = id ? getStudentTheme(id) : { name: "預設主題", tagline: "乾淨清爽的預設配色" };
      if (!theme) return "";
      const need = THEME_XP[id] || 0;
      const isCur = cur === id;
      // 正在使用中的主題一律視為已解鎖（家長可在管理頁直接指定，指定後就不該再被 XP 門檻擋住）
      const unlocked = isCur || themeUnlocked(id, xp);
      const pct = need > 0 ? Math.min(100, Math.round((xp / need) * 100)) : 100;
      return `<div class="theme-card ${THEME_SWATCH[id]} ${unlocked ? "" : "locked"} ${isCur ? "current" : ""}"
                   ${unlocked ? `data-theme="${id}"` : ""}>
        <div class="theme-card-name">${THEME_ICON[id]} ${escapeHtml(theme.name)}${unlocked ? "" : " 🔒"}</div>
        <div class="theme-card-desc">${escapeHtml(theme.tagline || "")}</div>
        ${unlocked
          ? `<div class="theme-card-state">${isCur
              ? (themeUnlocked(id, xp) ? "✅ 使用中" : "✅ 使用中（家長指定）")
              : `✅ 已解鎖${need ? `（${need.toLocaleString()} XP）` : ""} · 點我套用`}</div>`
          : `<div class="theme-lock-bar"><div style="width:${pct}%"></div></div>
             <div class="theme-card-state">還差 ${(need - xp).toLocaleString()} XP 解鎖（需 ${need.toLocaleString()} XP）</div>`}
      </div>`;
    }).join("");

    // 特效收藏
    const fxItems = [
      { icon: "🚀", name: "火箭飛越", when: "科目進步時", rule: "progress" },
      { icon: "👑", name: "皇冠加冕", when: "衛冕成功時", rule: "defense" },
      { icon: "✨", name: "星光放射", when: "進步＋衛冕時", rule: "both" },
      { icon: "🎉", name: "動物派對", when: "考到滿分時", rule: "final100" },
    ].map((f) => {
      const on = effectSettings[f.rule] && effectSettings[f.rule].enabled;
      return `<div class="fx-item ${on ? "" : "locked"}">
        <div class="fx-item-icon">${f.icon}</div>
        <div class="fx-item-name">${f.name}${on ? "" : " 🔒"}</div>
        <div class="fx-item-when">${f.when}</div>
      </div>`;
    }).join("");

    document.getElementById("themeBody").innerHTML = `
      <div class="kid-note">累積 XP 解鎖新造型，套用後整個成績頁的配色都會跟著變 ✨</div>
      ${cards}
      <div class="kid-card" style="margin-top:16px">
        <div class="kid-card-title">✨ 我的特效收藏 <small>成績達標時自動播放</small></div>
        <div class="fx-collection">${fxItems}</div>
      </div>`;

    document.querySelectorAll("[data-theme]").forEach((el) =>
      el.addEventListener("click", async () => {
        const id = el.dataset.theme;
        try {
          await updateStudent(ctx.student.id, { themeId: id });
          ctx.student.themeId = id;
          applyTheme(ctx.student);
          renderTheme(ctx);
          showToast("已套用主題造型 ✓");
        } catch (e) { showErrorToast(friendlyErrorMsg(e)); }
      }));
  }

  function showToast(msg) {
    const el = document.createElement("div");
    el.className = "badge-unlock-toast";
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3400);
  }

  // ================================================================ 特效播放（獨立實作，不依賴 student.js）
  const activeEffects = new Map();
  function registerEffect(card, dispose) {
    const prev = activeEffects.get(card);
    if (prev) prev();
    activeEffects.set(card, dispose);
  }
  function playEffect(effectId, card, duration, studentName) {
    const dur = typeof duration === "number" && duration > 0 ? duration : 2000;
    if (effectId === "thumbsUp") emojiEffect(card, "👍", dur, "pop-effect");
    else if (effectId === "crownSpin") emojiEffect(card, "👑", dur, "spin-effect");
    else if (effectId === "rocketChart") rocketEffect(card, dur);
    else if (effectId === "starburst") starburstEffect(card, dur);
    else if (effectId === "cardConfetti") confettiEffect(card, dur);
    else if (effectId === "animalParty") animalParty(studentName, dur);
  }
  function emojiEffect(card, emoji, duration, animClass) {
    const el = document.createElement("div");
    el.className = "subject-effect-emoji " + animClass;
    el.style.animationDuration = duration / 1000 + "s";
    el.textContent = emoji;
    card.appendChild(el);
    const t = setTimeout(done, duration);
    function done() { clearTimeout(t); el.remove(); activeEffects.delete(card); }
    registerEffect(card, done);
  }
  function rocketEffect(card, duration) {
    const wrap = document.createElement("div");
    wrap.className = "subject-effect-rocket";
    const durSec = Math.max(duration / 1000, 0.4);
    let streaks = "";
    for (let i = 0; i < 14; i++) {
      const sd = (60 + Math.random() * 30).toFixed(1);
      const lj = (Math.random() * 10 - 5).toFixed(1);
      const sdur = (0.4 + Math.random() * 0.3).toFixed(2);
      streaks += `<div class="rocket-streak" style="--sd:${sd}px; left:calc(6px + ${lj}px); animation-duration:${sdur}s; animation-delay:${(-Math.random() * sdur).toFixed(2)}s;"></div>`;
    }
    wrap.innerHTML = `<div class="rocket-unit">${streaks}<div class="rocket-emoji">🚀</div></div>`;
    card.appendChild(wrap);
    wrap.querySelector(".rocket-unit").style.animationDuration = durSec + "s";
    const t = setTimeout(done, duration);
    function done() { clearTimeout(t); wrap.remove(); activeEffects.delete(card); }
    registerEffect(card, done);
  }
  function starburstEffect(card, duration) {
    const wrap = document.createElement("div");
    wrap.className = "subject-effect-starburst";
    let sparks = "";
    for (let i = 0; i < 10; i++) sparks += `<div class="starburst-spark" style="--a:${36 * i}deg"></div>`;
    wrap.innerHTML = `<div class="starburst-rays"></div><div class="starburst-core">⭐</div>${sparks}`;
    card.appendChild(wrap);
    const durSec = Math.max(duration / 1000, 0.4);
    wrap.querySelectorAll(".starburst-rays, .starburst-core, .starburst-spark")
      .forEach((el) => { el.style.animationDuration = durSec + "s"; });
    const t = setTimeout(done, duration);
    function done() { clearTimeout(t); wrap.remove(); activeEffects.delete(card); }
    registerEffect(card, done);
  }
  function confettiEffect(card, duration) {
    if (typeof confetti === "undefined") return;
    const canvas = document.createElement("canvas");
    canvas.className = "subject-effect-canvas";
    card.appendChild(canvas);
    const my = confetti.create(canvas, { resize: true, useWorker: false });
    const end = Date.now() + duration;
    let raf = null, stopped = false;
    (function frame() {
      if (stopped) return;
      my({ particleCount: 6, startVelocity: 24, spread: 75, gravity: 0.9, ticks: 160,
        origin: { x: Math.random(), y: Math.random() * 0.35 },
        colors: ["#ffd54a", "#4fd1c5", "#63b3ff", "#ff8fa3", "#ffffff"] });
      if (Date.now() < end) raf = requestAnimationFrame(frame); else done();
    })();
    function done() { if (stopped) return; stopped = true; if (raf) cancelAnimationFrame(raf); canvas.remove(); activeEffects.delete(card); }
    registerEffect(card, done);
  }
  function animalParty(studentName, duration) {
    const overlay = document.createElement("div");
    overlay.className = "animal-party-overlay";
    const animals = ["🐶", "🐱", "🐰", "🦊", "🐼", "🦁", "🐯", "🐨", "🐸", "🐵"];
    overlay.innerHTML = `<div class="animal-party-box">
      <div class="animal-party-title">🎉 恭喜滿分 100！${escapeHtml(studentName || "")} 太厲害了！🎉</div>
      <div class="animal-party-sub">這一科最新一次直接考了滿分，超級全能！</div>
      <div class="animal-party-animals">${animals.map((a, i) => `<span style="animation-delay:${(i % 5) * 0.15}s;">${a}</span>`).join("")}</div>
    </div>`;
    document.body.appendChild(overlay);
    let burst = null;
    if (typeof confetti !== "undefined") {
      burst = setInterval(() => confetti({ particleCount: 60, spread: 100, startVelocity: 45,
        origin: { x: Math.random(), y: 0.1 },
        colors: ["#ffd54a", "#4fd1c5", "#63b3ff", "#ff8fa3", "#34d399", "#ffffff"] }), 350);
    }
    let disposed = false;
    const t = setTimeout(done, duration);
    overlay.addEventListener("click", (e) => { if (e.target === overlay) done(); });
    function done() {
      if (disposed) return;
      disposed = true;
      clearTimeout(t);
      if (burst) clearInterval(burst);
      overlay.classList.add("fading-out");
      setTimeout(() => overlay.remove(), 400);
    }
  }

  // ================================================================ 分頁與學生切換
  let activeTab = "home";
  function switchTab(tab) {
    activeTab = tab;
    document.querySelectorAll(".kid-view").forEach((v) => v.classList.remove("active"));
    document.getElementById("view-" + tab).classList.add("active");
    document.querySelectorAll(".kid-tab").forEach((b) => b.classList.toggle("active", b.dataset.tab === tab));
    window.scrollTo({ top: 0 });
    renderTab();
  }
  document.querySelectorAll(".kid-tab").forEach((b) =>
    b.addEventListener("click", () => switchTab(b.dataset.tab)));

  async function renderTab() {
    const ctx = await loadStudent(currentId);
    applyTheme(ctx.student);
    // 紅點每次切分頁都重算：孩子不一定會進規矩分頁，但底部導覽隨時看得到
    syncRulesTabDot(ctx);
    if (activeTab === "home") renderHome(ctx);
    else if (activeTab === "rules") renderRules(ctx);
    else if (activeTab === "score") renderScore(ctx);
    else if (activeTab === "dex") await renderDex(ctx);
    else if (activeTab === "wish") renderWish(ctx);
    else if (activeTab === "theme") renderTheme(ctx);
  }

  function renderSwitcher() {
    const el = document.getElementById("studentSwitcher");
    if (students.length < 2) { el.style.display = "none"; return; }
    el.innerHTML = students.map((s) => `
      <button class="kid-switch-btn ${s.id === currentId ? "active" : ""}" data-student="${s.id}">
        <span class="kid-switch-dot" style="background:${s.color || "#4f7cff"}"></span>${escapeHtml(s.name)}
      </button>`).join("");
    el.querySelectorAll("[data-student]").forEach((b) =>
      b.addEventListener("click", async () => {
        currentId = b.dataset.student;
        renderSwitcher();
        await renderTab();
      }));
  }

  // U7：孩子模式加登出入口（原本只能從家長端才能登出）
  const kidLogoutBtn = document.getElementById("kidLogoutBtn");
  if (kidLogoutBtn) {
    kidLogoutBtn.addEventListener("click", async () => {
      const ok = await confirmDialog("確定要登出嗎？下次要重新用 Google 帳號登入喔。", { title: "登出", confirmText: "登出", danger: false });
      if (ok) signOutUser();
    });
  }

  // 【規矩框架】原本底部「造型」分頁改成從首頁按鈕進入，維持底部只有 5 個常用分頁
  const kidThemeEntryBtn = document.getElementById("kidThemeEntryBtn");
  if (kidThemeEntryBtn) {
    kidThemeEntryBtn.addEventListener("click", () => switchTab("theme"));
  }

  // ---------------------------------------------------------------- 啟動
  renderSwitcher();
  const ctx0 = await loadStudent(currentId);
  applyTheme(ctx0.student);
  await refreshBadges(ctx0, { celebrate: false });
  syncRulesTabDot(ctx0);
  renderHome(ctx0);
})();
