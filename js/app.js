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

  const LAST_KEY = "jfkd_kid_last_student";
  let currentId = localStorage.getItem(LAST_KEY);
  if (!students.some((s) => s.id === currentId)) currentId = students[0].id;

  // 每位學生的資料快取（避免切換分頁重複讀 Firestore）
  const cache = {};

  async function loadStudent(id) {
    if (cache[id]) return cache[id];
    const [student, records] = await Promise.all([getStudent(id), listExamRecords(id)]);
    const enriched = (records || []).map((r) => {
      const result = calcExamRecord(r.subjects || [], pickRulesForRecord(r, profiles, defaultProfileId));
      return { ...r, result, total: result.total };
    });
    const totalBonus = enriched.reduce((a, r) => a + r.total, 0);
    cache[id] = { student, rows: enriched, totalBonus };
    return cache[id];
  }

  // ---------------------------------------------------------------- 共用小工具
  function xpOf(ctx) {
    // XP = 累計獎金（1 元 = 1 點）＋ 每日任務累積
    return Math.max(0, Math.round(ctx.totalBonus)) + (Number(ctx.student.xpFromTasks) || 0);
  }
  function tasksOf(ctx) {
    return normalizeDailyTasks(ctx.student.dailyTasks);
  }
  function doneTodaySet(ctx) {
    return new Set((ctx.student.dailyTaskCompletions || {})[todayStr()] || []);
  }
  function initialOf(name) {
    return (name || "?").slice(0, 1);
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

  function badgeToast(badge) {
    const el = document.createElement("div");
    el.className = "badge-unlock-toast";
    el.innerHTML = `<span style="font-size:1.5em">${badge.i || badge.icon}</span>
      <span>解鎖新徽章：${escapeHtml(badge.n || badge.name)}</span>`;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3500);
    if (typeof confetti !== "undefined") {
      confetti({ particleCount: 70, spread: 90, startVelocity: 40, origin: { y: 0.75 },
        colors: ["#7B5CFF", "#3FA9F5", "#FFD166", "#17C09A", "#ffffff"] });
    }
  }

  /** 依最新資料重新判定徽章；有新解鎖就寫回 Firestore 並跳慶祝 */
  async function refreshBadges(ctx, { celebrate } = {}) {
    const tasks = tasksOf(ctx);
    const taskStats = buildTaskStats(ctx.student, tasks);
    const streak = normalizeStreak(ctx.student.streak);
    const bctx = buildBadgeContext({
      rows: ctx.rows, totalBonus: ctx.totalBonus, student: ctx.student,
      streak, taskStats, totalXp: xpOf(ctx),
    });
    const res = evaluateBadges(bctx, ctx.student.badges || {}, todayStr());
    if (res.newlyUnlocked.length) {
      ctx.student.badges = res.unlockedMap;
      try { await saveUnlockedBadges(ctx.student.id, res.unlockedMap); } catch (e) { /* 離線也不影響瀏覽 */ }
      if (celebrate) res.newlyUnlocked.slice(0, 3).forEach((b, i) => setTimeout(() => badgeToast(b), i * 800));
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

    const streak = normalizeStreak(s.streak);
    const xp = xpOf(ctx);
    const lv = levelInfo(xp);
    const tasks = tasksOf(ctx);
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

      <div class="kid-card" style="margin-top:13px">
        <div class="xp-head">
          <div class="xp-level">Lv.${lv.level} <span>${lv.title}</span></div>
          <div class="xp-total">${xp.toLocaleString()} XP</div>
        </div>
        <div class="xp-track"><div class="xp-fill" style="width:${lv.pct}%"></div></div>
        <div class="xp-hint">${lv.next === null ? "已達最高等級 🎉" : `再 ${lv.toNext.toLocaleString()} XP 升到 Lv.${lv.level + 1}`}</div>
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
          <div style="font-size:calc(30px * var(--font-scale,1));font-weight:900;color:#7B5CFF">${latest.result.avgScore}</div>
          <div style="flex:1;min-width:0">
            ${diffText(ctx)}
            <div style="font-size:calc(11px * var(--font-scale,1));color:var(--kid-faint,#A9A2BC);margin-top:2px">
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
          <span><i class="kid-dot" style="background:linear-gradient(135deg,#FF7A2F,#FFB020)"></i>有打卡</span>
          <span><i class="kid-dot" style="background:#F3EEE7"></i>沒打卡</span>
        </div>
      </div>
    `;

    bindTasks(ctx);
    document.querySelectorAll("[data-goto]").forEach((b) =>
      b.addEventListener("click", () => switchTab(b.dataset.goto)));
  }

  function diffText(ctx) {
    if (ctx.rows.length < 2) return '<div style="font-size:calc(12px * var(--font-scale,1));font-weight:800;color:#7B5CFF">第一筆紀錄，加油！</div>';
    const d = Math.round((ctx.rows[0].result.avgScore - ctx.rows[1].result.avgScore) * 10) / 10;
    if (d > 0) return `<div style="font-size:calc(12px * var(--font-scale,1));font-weight:800;color:#17C09A">▲ 比上次進步 ${d} 分</div>`;
    if (d < 0) return `<div style="font-size:calc(12px * var(--font-scale,1));font-weight:800;color:#FF5D8F">▼ 比上次退步 ${Math.abs(d)} 分</div>`;
    return '<div style="font-size:calc(12px * var(--font-scale,1));font-weight:800;color:var(--kid-soft,#6B6480)">與上次持平</div>';
  }
  function bonusStateText(r) {
    if (!r.bonusStatus) return "無獎金";
    return r.bonusStatus === "done" ? "已發放" : "尚未發放";
  }

  function calendarHtml(ctx) {
    const comp = ctx.student.dailyTaskCompletions || {};
    const today = todayStr();
    let html = "";
    for (let i = 27; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const key = localDateStr(d);
      const hit = (comp[key] || []).length > 0;
      html += `<div class="kid-cal-day ${hit ? "hit" : ""} ${key === today ? "today" : ""}">${d.getDate()}</div>`;
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
        const tasks = tasksOf(ctx);
        const task = tasks.find((t) => t.id === el.dataset.task);
        if (!task) { delete el.dataset.busy; return; }
        const wasDone = el.classList.contains("done");
        try {
          if (!wasDone) {
            await markTaskFlags(ctx);
            const r = await completeDailyTask(ctx.student, task, tasks);
            ctx.student = r.student;
            const rect = el.getBoundingClientRect();
            floatXp(rect.right - 40, rect.top, "+" + r.gainedXp);
            if (r.checkIn && r.checkIn.milestone) {
              setTimeout(() => badgeToast({ i: "🔥", n: `連續 ${r.checkIn.milestone} 天！+${r.checkIn.bonusXp} XP` }), 500);
            }
            if (r.checkIn && r.checkIn.usedShield) {
              setTimeout(() => badgeToast({ i: "🛡️", n: "護盾卡幫你保住連續紀錄了！" }), 900);
            }
          } else {
            const r = await uncompleteDailyTask(ctx.student, task, tasks);
            ctx.student = r.student;
          }
          await refreshBadges(ctx, { celebrate: true });
          renderHome(ctx);
        } catch (err) {
          alert("更新失敗：" + err.message);
          delete el.dataset.busy;
        }
      });
    });
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
      setTimeout(() => autoPlayEffects(ctx, latest), 450);
    }
    document.querySelectorAll(".fx-card").forEach((card) => {
      card.addEventListener("click", () => {
        const rule = card.dataset.rule;
        const cfg = effectSettings[rule];
        if (cfg && cfg.enabled) playEffect(cfg.effect, card, cfg.duration, ctx.student.name);
      });
    });
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
          return `<div class="fx-card" data-rule="${rule}">
            <div class="fx-emoji">${RULE_EMOJI[rule]}</div>
            <div class="fx-text">
              <div class="fx-name">${escapeHtml(s.name)} ${s.score} 分</div>
              <div class="fx-desc">${RULE_LABEL[rule]}${diff !== null && diff > 0 ? ` · 進步 ${diff} 分` : ""} · 點一下重播特效</div>
            </div>
            <div class="fx-score ${diff !== null ? (diff > 0 ? "up" : diff < 0 ? "down" : "") : ""}">${s.score}</div>
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

    const W = 480, H = 210, PT = 34, PB = 40, PL = 30, PR = 12;
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
        let state = `<div class="kid-wish-state" style="color:#FF7A2F">🔥 進行中 · 已累積 ${fmtMoney(Math.min(ctx.totalBonus, total))}</div>`;
        if (achieved) {
          state = it.redeemedDate
            ? `<div class="kid-wish-state" style="color:#17C09A">✅ 已達成 · 已於 ${escapeHtml(it.redeemedDate)} 兌現</div>`
            : '<div class="kid-wish-state" style="color:#17C09A">✅ 已達成 · 等待兌現</div>';
        } else if (notAchieved) {
          state = '<div class="kid-wish-state" style="color:var(--kid-faint,#A9A2BC)">下次再挑戰 💪</div>';
        }
        return `<div class="kid-wish ${achieved ? "achieved" : ""}">
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
      const unlocked = themeUnlocked(id, xp);
      const isCur = cur === id;
      const pct = need > 0 ? Math.min(100, Math.round((xp / need) * 100)) : 100;
      return `<div class="theme-card ${THEME_SWATCH[id]} ${unlocked ? "" : "locked"} ${isCur ? "current" : ""}"
                   ${unlocked ? `data-theme="${id}"` : ""}>
        <div class="theme-card-name">${THEME_ICON[id]} ${escapeHtml(theme.name)}${unlocked ? "" : " 🔒"}</div>
        <div class="theme-card-desc">${escapeHtml(theme.tagline || "")}</div>
        ${unlocked
          ? `<div class="theme-card-state">${isCur ? "✅ 使用中" : `✅ 已解鎖${need ? `（${need.toLocaleString()} XP）` : ""} · 點我套用`}</div>`
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
        } catch (e) { alert("套用失敗：" + e.message); }
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
    if (activeTab === "home") renderHome(ctx);
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
        localStorage.setItem(LAST_KEY, currentId);
        renderSwitcher();
        await renderTab();
      }));
  }

  // ---------------------------------------------------------------- 啟動
  renderSwitcher();
  const ctx0 = await loadStudent(currentId);
  applyTheme(ctx0.student);
  await refreshBadges(ctx0, { celebrate: false });
  renderHome(ctx0);
})();
