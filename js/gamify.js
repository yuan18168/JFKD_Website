/* gamify.js — 成長系統的純計算層（不碰 Firestore、不碰 DOM，方便單獨驗算）
   內容：XP 等級曲線、主題造型解鎖門檻、60 個成就徽章的定義與判定。

   ★ 徽章設計原則（沿用舊版家長明確要求，新增的 40 個也一律遵守）：
     任何徽章都不能因為「單一一次失手」就永久無法達成。每個徽章只能是下列三種安全型之一：
       ①累計型：只會越來越多、永遠不會倒退（累計次數／累計金額／累計天數）
       ②里程碑型：歷史上發生過一次就永久成立的事實（曾經考過100分）
       ③滾動型：可能重置但永遠能再挑戰（連續達標、連續打卡）
     ※「整學期零處罰」這種一次失手就出局的條件一律不採用。
*/

// ------------------------------------------------------------------
// XP 等級曲線：Lv1 起跳，第 k 級需要 (75 + 18*(k-1)) XP，愈後面愈慢
// 例：Lv12 累計門檻 1,815 XP、Lv13 為 2,088 XP。
const MAX_LEVEL = 60;
const LEVEL_TITLES = [
  [1, "新手"], [5, "見習生"], [10, "探索者"], [15, "冒險家"], [20, "高手"],
  [25, "菁英"], [30, "大師"], [40, "宗師"], [50, "傳說"], [60, "神話"],
];

function xpNeededForLevel(k) {
  return 75 + 18 * (k - 1);
}
/** 升到第 n 級所需要的「累計」XP（Lv1 = 0） */
function cumulativeXpForLevel(n) {
  let sum = 0;
  for (let k = 1; k < n; k++) sum += xpNeededForLevel(k);
  return sum;
}
/** 依總 XP 算出等級資訊 */
function levelInfo(totalXp) {
  const xp = Math.max(0, Math.floor(totalXp || 0));
  let level = 1;
  while (level < MAX_LEVEL && xp >= cumulativeXpForLevel(level + 1)) level++;
  const floor = cumulativeXpForLevel(level);
  const next = level < MAX_LEVEL ? cumulativeXpForLevel(level + 1) : null;
  const span = next === null ? 1 : next - floor;
  const pct = next === null ? 100 : Math.min(100, Math.round(((xp - floor) / span) * 100));
  let title = LEVEL_TITLES[0][1];
  for (const [lv, t] of LEVEL_TITLES) if (level >= lv) title = t;
  return { level, title, xp, floor, next, pct, toNext: next === null ? 0 : next - xp };
}

// ------------------------------------------------------------------
// 主題造型解鎖門檻（XP）。themeId 對應 data.js 的 STUDENT_THEMES。
const THEME_XP = {
  "": 0,               // 無主題（預設）
  zoro: 500,
  babymonster: 1500,
  galaxy: 3000,
  lava: 7500,
  aurora: 15000,
  gold: 30000,
};
function themeUnlocked(themeId, totalXp) {
  return (totalXp || 0) >= (THEME_XP[themeId || ""] || 0);
}

// ------------------------------------------------------------------
// 徽章判定用的資料整理：把考試紀錄、打卡、任務等原始資料整理成一份 ctx，
// 每個徽章的 test(ctx) 只做單純的數值比較，方便測試與除錯。
function buildBadgeContext({ rows, totalBonus, student, streak, taskStats, totalXp }) {
  const R = Array.isArray(rows) ? rows : [];          // 新到舊
  const oldestFirst = [...R].reverse();
  const st = streak || {};
  const ts = taskStats || {};
  const wl = (student && student.wishlist) || [];

  const progressCount = R.reduce(
    (a, r) => a + ((r.result && r.result.detail) || []).filter((d) => d.progressBonus > 0).length, 0);
  const defenseCount = R.reduce(
    (a, r) => a + ((r.result && r.result.detail) || []).filter((d) => d.defenseBonus > 0).length, 0);

  let noPunishStreak = 0;
  for (const r of R) { if (r.result && r.result.hasPunishment) break; noPunishStreak++; }

  const hasPerfectScore = R.some((r) => ((r.result && r.result.detail) || []).some((d) => d.tierKey === "A"));

  let hasNewHigh = false, runningMax = null;
  oldestFirst.forEach((r, i) => {
    const avg = r.result ? r.result.avgScore : 0;
    if (i > 0 && avg > runningMax) hasNewHigh = true;
    runningMax = runningMax === null ? avg : Math.max(runningMax, avg);
  });

  const bestAvg = R.length ? Math.max(...R.map((r) => (r.result ? r.result.avgScore : 0))) : 0;
  const hasBigJump = R.some((r) => (r.subjects || []).some((s) => typeof s.prevScore === "number" && s.score - s.prevScore >= 10));
  const hasHugeJump = R.some((r) => (r.subjects || []).some((s) => typeof s.prevScore === "number" && s.score - s.prevScore >= 20));
  const hasAll90 = R.some((r) => (r.subjects || []).length > 0 && r.subjects.every((s) => s.score >= 90));
  const hasAll95 = R.some((r) => (r.subjects || []).length > 0 && r.subjects.every((s) => s.score >= 95));

  let hasConsecutiveDefense = false;
  for (let i = 0; i < R.length - 1; i++) {
    const a = ((R[i].result && R[i].result.detail) || []).some((d) => d.defenseBonus > 0);
    const b = ((R[i + 1].result && R[i + 1].result.detail) || []).some((d) => d.defenseBonus > 0);
    if (a && b) { hasConsecutiveDefense = true; break; }
  }

  const hasComeback80 = R.some((r) => (r.subjects || []).some((s) => typeof s.prevScore === "number" && s.prevScore < 80 && s.score >= 80));

  let hasFiveStreak90 = false;
  for (let i = 0; i <= R.length - 5; i++) {
    if (R.slice(i, i + 5).every((r) => r.result && r.result.avgScore >= 90)) { hasFiveStreak90 = true; break; }
  }
  let hasThreeStreak90 = false;
  for (let i = 0; i <= R.length - 3; i++) {
    if (R.slice(i, i + 3).every((r) => r.result && r.result.avgScore >= 90)) { hasThreeStreak90 = true; break; }
  }

  const hasAllImproved = R.some((r) => {
    const wp = (r.subjects || []).filter((s) => typeof s.prevScore === "number");
    return wp.length > 0 && wp.every((s) => s.score > s.prevScore);
  });

  const comboCount = R.filter((r) => r.result && r.result.comboBonus > 0).length;

  let longHaulDays = 0;
  const dates = R.map((r) => r.date).filter(Boolean).sort();
  if (dates.length >= 2) longHaulDays = Math.round((new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000);

  const hit100 = new Set();
  R.forEach((r) => (r.subjects || []).forEach((s) => { if (s.score >= 100) hit100.add(s.name); }));

  let hasComebackAfterPunish = false;
  for (let i = 0; i < oldestFirst.length - 1; i++) {
    if (oldestFirst[i].result && oldestFirst[i].result.hasPunishment &&
        oldestFirst[i + 1].result && !oldestFirst[i + 1].result.hasPunishment) { hasComebackAfterPunish = true; break; }
  }

  let hasSteadyGrowth = false;
  if (R.length >= 5) hasSteadyGrowth = R[0].result.avgScore > R[4].result.avgScore;

  const hasAllInOne = R.some((r) => {
    const d = (r.result && r.result.detail) || [];
    return d.some((x) => x.progressBonus > 0) && d.some((x) => x.defenseBonus > 0) && r.result.comboBonus > 0;
  });

  const redeemedCount = wl.filter((i) => !!i.redeemedDate).length;
  const semesters = new Set(R.map((r) => r.semester).filter(Boolean));

  return {
    recordCount: R.length,
    totalBonus: totalBonus || 0,
    totalXp: totalXp || 0,
    level: levelInfo(totalXp || 0).level,
    progressCount, defenseCount, noPunishStreak,
    hasPerfectScore, hasNewHigh, bestAvg, hasBigJump, hasHugeJump,
    hasAll90, hasAll95, hasConsecutiveDefense, hasComeback80,
    hasFiveStreak90, hasThreeStreak90, hasAllImproved, comboCount,
    longHaulDays, masterCount: hit100.size, hasComebackAfterPunish,
    hasSteadyGrowth, hasAllInOne, redeemedCount, semesterCount: semesters.size,
    // 打卡
    streakCount: st.count || 0,
    streakBest: st.best || 0,
    totalDays: st.totalDays || 0,
    shields: st.shields || 0,
    usedShieldEver: !!st.usedShieldEver,
    // 任務
    taskDone: ts.done || 0,
    perfectDays: ts.perfectDays || 0,
    readingDone: ts.readingDone || 0,
    choreDone: ts.choreDone || 0,
    earlyBird: !!ts.earlyBird,
    nightOwl: !!ts.nightOwl,
    weekendCount: ts.weekendCount || 0,
    birthdayCheckIn: !!ts.birthdayCheckIn,
  };
}

// ------------------------------------------------------------------
// 徽章定義：60 個，rarity 1=普通 2=稀有 3=史詩 4=傳說
// group：streak 打卡系列／score 成績系列／task 任務系列／secret 隱藏版
// hidden:true 代表未解鎖時不顯示名稱與條件（只顯示 ???）
const RARITY_NAME = { 1: "普通", 2: "稀有", 3: "史詩", 4: "傳說" };
const BADGE_GROUPS = [
  { key: "streak", label: "打卡系列" },
  { key: "score", label: "成績系列" },
  { key: "task", label: "任務系列" },
  { key: "secret", label: "隱藏版" },
];

const BADGES = [
  // ===== 打卡系列 18 =====
  { id: "s_first", g: "streak", i: "🌱", n: "初次打卡", r: 1, d: "完成第一次每日打卡", t: (c) => c.totalDays >= 1 },
  { id: "s_3", g: "streak", i: "🔥", n: "三天不斷", r: 1, d: "連續打卡 3 天", t: (c) => c.streakBest >= 3 },
  { id: "s_7", g: "streak", i: "📅", n: "一週戰士", r: 1, d: "連續打卡 7 天", t: (c) => c.streakBest >= 7 },
  { id: "s_14", g: "streak", i: "💪", n: "兩週堅持", r: 1, d: "連續打卡 14 天", t: (c) => c.streakBest >= 14 },
  { id: "s_30", g: "streak", i: "🌕", n: "滿月達人", r: 2, d: "連續打卡 30 天", t: (c) => c.streakBest >= 30 },
  { id: "s_50", g: "streak", i: "🎯", n: "五十連發", r: 2, d: "連續打卡 50 天", t: (c) => c.streakBest >= 50 },
  { id: "s_100", g: "streak", i: "💯", n: "百日傳說", r: 3, d: "連續打卡 100 天", t: (c) => c.streakBest >= 100 },
  { id: "s_180", g: "streak", i: "👑", n: "半年不斷", r: 4, d: "連續打卡 180 天", t: (c) => c.streakBest >= 180 },
  { id: "s_365", g: "streak", i: "🏆", n: "一年之神", r: 4, d: "連續打卡 365 天", t: (c) => c.streakBest >= 365 },
  { id: "s_early", g: "streak", i: "🌅", n: "早鳥", r: 1, d: "早上 7 點前完成打卡", t: (c) => c.earlyBird },
  { id: "s_night", g: "streak", i: "🌙", n: "夜貓子", r: 1, d: "晚上 9 點後才完成打卡", t: (c) => c.nightOwl },
  { id: "s_weekend", g: "streak", i: "⛱️", n: "週末不休", r: 2, d: "累計 8 個週末假日有打卡", t: (c) => c.weekendCount >= 8 },
  { id: "s_shield", g: "streak", i: "🛡️", n: "化險為夷", r: 1, d: "第一次用護盾卡保住連續紀錄", t: (c) => c.usedShieldEver },
  { id: "s_shield2", g: "streak", i: "🔰", n: "有備無患", r: 2, d: "同時持有 2 張護盾卡", t: (c) => c.shields >= 2 },
  { id: "s_t50", g: "streak", i: "📊", n: "累計 50 天", r: 1, d: "累計打卡總天數達 50 天", t: (c) => c.totalDays >= 50 },
  { id: "s_t100", g: "streak", i: "📈", n: "累計 100 天", r: 2, d: "累計打卡總天數達 100 天", t: (c) => c.totalDays >= 100 },
  { id: "s_t200", g: "streak", i: "🗻", n: "累計 200 天", r: 3, d: "累計打卡總天數達 200 天", t: (c) => c.totalDays >= 200 },
  { id: "s_t365", g: "streak", i: "🌌", n: "累計 365 天", r: 4, d: "累計打卡總天數達 365 天", t: (c) => c.totalDays >= 365 },

  // ===== 成績系列 22（含原本 20 個）=====
  { id: "c_prog5", g: "score", i: "🔥", n: "進步達人", r: 1, d: "累計進步達 5 次", t: (c) => c.progressCount >= 5 },
  { id: "c_def5", g: "score", i: "🏆", n: "衛冕高手", r: 1, d: "累計衛冕達 5 次", t: (c) => c.defenseCount >= 5 },
  { id: "c_nopunish3", g: "score", i: "🎯", n: "連續達標", r: 2, d: "連續 3 次紀錄都沒有處罰", t: (c) => c.noPunishStreak >= 3 },
  { id: "c_perfect", g: "score", i: "💯", n: "滿分紀錄", r: 2, d: "任一科目考到最高級距", t: (c) => c.hasPerfectScore },
  { id: "c_newhigh", g: "score", i: "📈", n: "分數新高", r: 1, d: "刷新個人歷史最高平均分", t: (c) => c.hasNewHigh },
  { id: "c_jump10", g: "score", i: "🚀", n: "大躍進", r: 2, d: "單科單次進步達 10 分以上", t: (c) => c.hasBigJump },
  { id: "c_all90", g: "score", i: "🌟", n: "全科同框", r: 3, d: "同一次紀錄所有科目都達 90 分以上", t: (c) => c.hasAll90 },
  { id: "c_defx2", g: "score", i: "🎖️", n: "連續衛冕", r: 3, d: "連續兩次紀錄都有科目衛冕成功", t: (c) => c.hasConsecutiveDefense },
  { id: "c_comeback80", g: "score", i: "🧗", n: "谷底翻身", r: 2, d: "任一科目從 80 分以下進步到 80 分以上", t: (c) => c.hasComeback80 },
  { id: "c_5x90", g: "score", i: "🔁", n: "五連勝", r: 3, d: "連續 5 次紀錄平均分都達 90 分以上", t: (c) => c.hasFiveStreak90 },
  { id: "c_rec10", g: "score", i: "📚", n: "全勤紀錄", r: 1, d: "累計紀錄達 10 筆", t: (c) => c.recordCount >= 10 },
  { id: "c_allup", g: "score", i: "🌈", n: "全科進步", r: 2, d: "同一次紀錄中有比較對象的科目全部都進步", t: (c) => c.hasAllImproved },
  { id: "c_combo3", g: "score", i: "🥇", n: "常勝軍", r: 3, d: "累計 3 次全科加碼", t: (c) => c.comboCount >= 3 },
  { id: "c_halfyear", g: "score", i: "🕰️", n: "持之以恆", r: 2, d: "紀錄時間橫跨半年（182 天）以上", t: (c) => c.longHaulDays >= 182 },
  { id: "c_money5k", g: "score", i: "💰", n: "小富翁", r: 2, d: "累計獎金達 NT$5,000", t: (c) => c.totalBonus >= 5000 },
  { id: "c_master3", g: "score", i: "🎓", n: "科科精通", r: 3, d: "3 個不同科目都考到 100 分", t: (c) => c.masterCount >= 3 },
  { id: "c_revenge", g: "score", i: "🦸", n: "逆風翻盤", r: 2, d: "處罰後，下一次紀錄恢復正常", t: (c) => c.hasComebackAfterPunish },
  { id: "c_steady", g: "score", i: "🌻", n: "穩健成長", r: 1, d: "最近 5 次紀錄比 5 次之前更好", t: (c) => c.hasSteadyGrowth },
  { id: "c_wish", g: "score", i: "🎁", n: "願望達成", r: 1, d: "完成兌換任一許願池項目", t: (c) => c.redeemedCount >= 1 },
  { id: "c_allinone", g: "score", i: "🧩", n: "全能挑戰", r: 4, d: "同一次紀錄同時有進步獎金、衛冕獎金、全科加碼", t: (c) => c.hasAllInOne },
  { id: "c_jump20", g: "score", i: "☄️", n: "超級躍進", r: 3, d: "單科單次進步達 20 分以上", t: (c) => c.hasHugeJump },
  { id: "c_all95", g: "score", i: "👑", n: "全科菁英", r: 4, d: "同一次紀錄所有科目都達 95 分以上", t: (c) => c.hasAll95 },

  // ===== 任務系列 14 =====
  { id: "t_first", g: "task", i: "✅", n: "第一步", r: 1, d: "完成第一個每日任務", t: (c) => c.taskDone >= 1 },
  { id: "t_10", g: "task", i: "🔟", n: "小有成就", r: 1, d: "累計完成 10 個任務", t: (c) => c.taskDone >= 10 },
  { id: "t_50", g: "task", i: "🎒", n: "任務老手", r: 1, d: "累計完成 50 個任務", t: (c) => c.taskDone >= 50 },
  { id: "t_100", g: "task", i: "💠", n: "任務達人", r: 2, d: "累計完成 100 個任務", t: (c) => c.taskDone >= 100 },
  { id: "t_500", g: "task", i: "🌠", n: "任務大師", r: 3, d: "累計完成 500 個任務", t: (c) => c.taskDone >= 500 },
  { id: "t_perfect1", g: "task", i: "🎊", n: "完美一天", r: 1, d: "單日完成當天所有任務", t: (c) => c.perfectDays >= 1 },
  { id: "t_perfect7", g: "task", i: "🗓️", n: "完美一週", r: 2, d: "累計 7 個完美一天", t: (c) => c.perfectDays >= 7 },
  { id: "t_perfect30", g: "task", i: "🎆", n: "完美一個月", r: 3, d: "累計 30 個完美一天", t: (c) => c.perfectDays >= 30 },
  { id: "t_read30", g: "task", i: "📖", n: "書蟲", r: 1, d: "累計完成閱讀類任務 30 次", t: (c) => c.readingDone >= 30 },
  { id: "t_chore30", g: "task", i: "🧹", n: "家事小幫手", r: 1, d: "累計完成家事類任務 30 次", t: (c) => c.choreDone >= 30 },
  { id: "t_xp1k", g: "task", i: "⚡", n: "XP 1000", r: 1, d: "累計獲得 1,000 XP", t: (c) => c.totalXp >= 1000 },
  { id: "t_xp5k", g: "task", i: "🔆", n: "XP 5000", r: 2, d: "累計獲得 5,000 XP", t: (c) => c.totalXp >= 5000 },
  { id: "t_xp20k", g: "task", i: "🪐", n: "XP 20000", r: 3, d: "累計獲得 20,000 XP", t: (c) => c.totalXp >= 20000 },
  { id: "t_lv20", g: "task", i: "🎚️", n: "等級 20", r: 2, d: "XP 等級達到 Lv.20", t: (c) => c.level >= 20 },

  // ===== 隱藏版 6（未解鎖時只顯示 ???）=====
  { id: "x_birthday", g: "secret", i: "🎂", n: "生日快樂", r: 3, hidden: true, d: "在自己生日當天完成打卡", t: (c) => c.birthdayCheckIn },
  { id: "x_night_perfect", g: "secret", i: "🦉", n: "深夜衝刺", r: 2, hidden: true, d: "在晚上 9 點後完成當天全部任務", t: (c) => c.nightOwl && c.perfectDays >= 1 },
  { id: "x_3x90", g: "secret", i: "🎪", n: "三連霸", r: 2, hidden: true, d: "連續 3 次紀錄平均分都達 90 分以上", t: (c) => c.hasThreeStreak90 },
  { id: "x_semester3", g: "secret", i: "🏫", n: "跨學期戰士", r: 3, hidden: true, d: "累積 3 個以上不同學期的成績紀錄", t: (c) => c.semesterCount >= 3 },
  { id: "x_wish3", g: "secret", i: "🎏", n: "願望收藏家", r: 3, hidden: true, d: "累計兌現 3 個許願池項目", t: (c) => c.redeemedCount >= 3 },
  { id: "x_double", g: "secret", i: "🌞", n: "雙修達人", r: 4, hidden: true, d: "同時擁有連續打卡 30 天與累計獎金 NT$5,000", t: (c) => c.streakBest >= 30 && c.totalBonus >= 5000 },
];

/**
 * 判定所有徽章。
 * unlockedMap：students/{id}.badges，{ badgeId: "YYYY-MM-DD" }。
 * 已經解鎖過的徽章永遠保持解鎖（就算之後條件變化也不收回），符合「不能因一次失手就永久失去」的原則。
 * 回傳 { list, newlyUnlocked, unlockedMap, stats }
 */
function evaluateBadges(ctx, unlockedMap, todayStrValue) {
  const map = { ...(unlockedMap || {}) };
  const newly = [];
  const list = BADGES.map((b) => {
    let ok = false;
    try { ok = !!b.t(ctx); } catch (e) { ok = false; }
    const already = !!map[b.id];
    if (ok && !already) { map[b.id] = todayStrValue; newly.push(b); }
    const unlocked = ok || already;
    return {
      id: b.id, group: b.g, icon: b.i, name: b.n, rarity: b.r,
      rarityName: RARITY_NAME[b.r], desc: b.d, hidden: !!b.hidden,
      unlocked, date: map[b.id] || null,
    };
  });
  const stats = { total: list.length, unlocked: list.filter((x) => x.unlocked).length };
  return { list, newlyUnlocked: newly, unlockedMap: map, stats };
}

/** 從 dailyTaskCompletions + dailyTasks 統計任務相關數字 */
function buildTaskStats(student, dailyTasks) {
  const comp = (student && student.dailyTaskCompletions) || {};
  const tasks = Array.isArray(dailyTasks) ? dailyTasks : [];
  const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
  const totalTasks = tasks.length;

  let done = 0, perfectDays = 0, readingDone = 0, choreDone = 0, weekendCount = 0;
  Object.keys(comp).forEach((dateStr) => {
    const ids = comp[dateStr] || [];
    done += ids.length;
    if (totalTasks > 0 && ids.length >= totalTasks) perfectDays++;
    const day = new Date(dateStr + "T00:00:00").getDay();
    if (ids.length > 0 && (day === 0 || day === 6)) weekendCount++;
    ids.forEach((id) => {
      const nm = (byId[id] && byId[id].name) || "";
      if (/閱讀|讀書|看書|book|read/i.test(nm)) readingDone++;
      if (/家事|打掃|收拾|洗碗|倒垃圾|整理/i.test(nm)) choreDone++;
    });
  });

  const flags = (student && student.taskFlags) || {};
  return {
    done, perfectDays, readingDone, choreDone, weekendCount,
    earlyBird: !!flags.earlyBird, nightOwl: !!flags.nightOwl, birthdayCheckIn: !!flags.birthdayCheckIn,
  };
}
