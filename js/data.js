/*
  data.js — Firestore 資料存取共用函式
  Collections:
    config/rules          （舊版，已遷移）單一文件的獎懲規則設定
    config/settings        { defaultProfileId, dashboardTitle（總覽頁可編輯標題）, fontScale（全站字體大小，'sm'|'md'|'lg'|'xl'） }：家庭共用設定
    config/chartSettings    { yMin, yMax, xCount（0=全部）, showPointLabels }：全域圖表顯示預設值（字體大小已改由 config/settings.fontScale 全站統一控制）
    config/effectSettings   { progress, defense, both, final100 }：科目卡片特效規則設定，每項 { enabled, effect, duration, trigger }
    ruleProfiles/{id}       { name, tiers, progressBonusPerPoint, comboBonus3, comboBonus5, punishmentText, createdAt }
    students/{id}           { name, color, order,
                               chartOverride（可選，覆寫全域圖表顯示設定，欄位同 config/chartSettings）,
                               themeId（可選，'zoro'|'babymonster'，套用學生主題造型）,
                               targetAvgScore（可選，數字，下次考試的目標平均分）,
                               wishlist（可選，陣列 [{id,name,amount}]，兌換許願池項目）}
    examRecords/{id}        { studentId, semester, examType, date, subjects:[{name,score,prevScore}],
                               ruleProfileId（套用的設定檔）, note,
                               punishmentStatus（'pending'|'done'，只有觸發處罰時才存在),
                               bonusStatus（'pending'|'done'，只有總獎金>0時才存在),
                               createdAt, createdBy, updatedAt, updatedBy }
*/

const AVATAR_COLORS = ["#4f7cff", "#4fd1c5", "#ffb454", "#ff6b9d", "#a78bfa"];

async function getRules() {
  const doc = await db.collection("config").doc("rules").get();
  if (!doc.exists) return defaultRules();
  return { ...defaultRules(), ...doc.data() };
}

async function saveRules(rules) {
  await db.collection("config").doc("rules").set(rules, { merge: false });
}

// ------------------------------------------------------------------
// 成績級距與獎金：多設定檔（ruleProfiles）
// 每個設定檔是一份完整的規則（級距/進步獎金/全科加碼/處罰說明），
// 家裡有一個共用的「預設設定檔」（config/settings.defaultProfileId），
// 新增考試紀錄時記住這個預設檔；每一筆考試紀錄實際套用的設定檔
// 記錄在 examRecords/{id}.ruleProfileId，之後即使更換預設檔或新增其他設定檔，
// 這筆紀錄仍會沿用當初套用的那一份，不會被連動改變
// （除非使用者自己在編輯畫面手動更換，或直接修改該設定檔本身的數值）。
async function listRuleProfiles() {
  const snap = await db.collection("ruleProfiles").orderBy("createdAt", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getRuleProfile(id) {
  if (!id) return null;
  const doc = await db.collection("ruleProfiles").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function addRuleProfile(profile) {
  return db.collection("ruleProfiles").add({
    ...defaultRules(),
    ...profile,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
  });
}

async function updateRuleProfile(id, profile) {
  await db.collection("ruleProfiles").doc(id).update(profile);
}

async function deleteRuleProfile(id) {
  await db.collection("ruleProfiles").doc(id).delete();
}

async function getSettings() {
  const doc = await db.collection("config").doc("settings").get();
  return doc.exists ? doc.data() : {};
}

async function setDefaultRuleProfileId(id) {
  await db.collection("config").doc("settings").set({ defaultProfileId: id }, { merge: true });
}

/**
 * 從已載入的設定檔清單中，找出某一筆考試紀錄「實際要套用」的規則物件。
 * 優先用紀錄自己存的 ruleProfileId；如果沒有存、或存的那個設定檔已被刪除，
 * 才退回目前的家庭預設設定檔；萬一預設檔也找不到，最後才退回程式內建的 defaultRules()。
 */
function pickRulesForRecord(record, profiles, defaultProfileId) {
  const byId = Object.fromEntries((profiles || []).map((p) => [p.id, p]));
  const chosen =
    (record && record.ruleProfileId && byId[record.ruleProfileId]) ||
    byId[defaultProfileId] ||
    (profiles && profiles[0]) ||
    null;
  return chosen ? { ...defaultRules(), ...chosen } : defaultRules();
}

/**
 * 一次性遷移：把舊版單一 config/rules 文件轉成第一個設定檔「預設方案」，
 * 並設為家庭預設設定檔。已經有設定檔存在時不會重複執行。
 */
async function migrateLegacyRulesToProfile() {
  const existingProfiles = await listRuleProfiles();
  if (existingProfiles.length) return existingProfiles[0].id;

  const legacyDoc = await db.collection("config").doc("rules").get();
  const legacyRules = legacyDoc.exists ? legacyDoc.data() : {};
  const ref = await addRuleProfile({ name: "預設方案", ...legacyRules });
  await setDefaultRuleProfileId(ref.id);
  return ref.id;
}

// ------------------------------------------------------------------
// 科目對照表：依「年級」（上下學期共用同一份）固定科目清單，例如
// { "一": ["國語","英文","數學"], "三": ["國語","英文","數學","自然","社會"], ... }
// 該年級沒有設定（陣列為空或不存在）時，考試表單維持自由輸入科目的方式。
async function getSubjectPresets() {
  const doc = await db.collection("config").doc("subjectPresets").get();
  return doc.exists ? doc.data() : {};
}

async function saveSubjectPresets(presets) {
  await db.collection("config").doc("subjectPresets").set(presets, { merge: false });
}

async function listStudents() {
  const snap = await db.collection("students").orderBy("order", "asc").get();
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

async function getStudent(id) {
  const doc = await db.collection("students").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

async function addStudent(name) {
  const existing = await listStudents();
  const color = AVATAR_COLORS[existing.length % AVATAR_COLORS.length];
  return db.collection("students").add({ name, color, order: existing.length });
}

async function deleteStudent(id) {
  await db.collection("students").doc(id).delete();
}

/** 局部更新學生資料（例如 chartOverride、themeId），只會覆寫傳入的欄位 */
async function updateStudent(id, fields) {
  await db.collection("students").doc(id).update(fields);
}

/** 刪除學生時，一併刪除這位學生所有的歷史考試紀錄。回傳實際刪除的紀錄筆數。 */
async function deleteStudentCascade(id) {
  const records = await listExamRecords(id);
  await Promise.all(records.map((r) => deleteExamRecord(r.id)));
  await deleteStudent(id);
  return records.length;
}

// ------------------------------------------------------------------
// 學制順序判斷：確保紀錄一律照「一上 → 一下 → 二上 → 二下 → ... → 六下（國小）
// → 七/國一 → ... → 九/國三（國中）→ 十/高一 → ... → 十二/高三（高中）」的順序排列，
// 每個學期內再依「小考 < 期中 < 期末 < 其他」排序。
// 不管實際登打日期是哪一天、或先後補登哪個階段的成績，畫面顯示順序都會照學制排列，
// 不會因為日期打錯、或同一天登打多筆而錯亂。
const GRADE_LEVEL_ALIASES = [
  ["國三", 9], ["國二", 8], ["國一", 7],
  ["高三", 12], ["高二", 11], ["高一", 10],
];
const GRADE_NUM_ALIASES = [
  ["十二", 12], ["十一", 11], ["十", 10],
  ["九", 9], ["八", 8], ["七", 7],
  ["六", 6], ["五", 5], ["四", 4], ["三", 3], ["二", 2], ["一", 1],
];
const EXAM_TYPE_ORDER = { 小考: 0, 期中: 1, 期末: 2, 其他: 3 };

/** 將「一上」「四下」「國一上」「高三下」等學期文字，換算成可比較大小的數字（愈大代表愈後面的學期） */
function parseSemesterOrdinal(semesterText) {
  const s = (semesterText || "").trim();
  if (!s) return null;

  let grade = null;
  for (const [alias, g] of GRADE_LEVEL_ALIASES) {
    if (s.startsWith(alias)) {
      grade = g;
      break;
    }
  }
  if (grade === null) {
    for (const [alias, g] of GRADE_NUM_ALIASES) {
      if (s.startsWith(alias)) {
        grade = g;
        break;
      }
    }
  }
  if (grade === null) return null;

  const half = s.includes("下") ? 1 : s.includes("上") ? 0 : null;
  if (half === null) return null;

  return grade * 2 + half; // 例：一上=2、一下=3、四下=9、國一上=16...
}

/** 學期＋考試類型合併成單一排序數字；學期文字看不懂就回傳 null，改用日期排序 */
function getCurriculumOrdinal(record) {
  const semOrdinal = parseSemesterOrdinal(record.semester);
  if (semOrdinal === null) return null;
  const examOrdinal = EXAM_TYPE_ORDER[record.examType] ?? 1.5; // 未知考試類型排在期中、期末之間
  return semOrdinal * 10 + examOrdinal;
}

async function listExamRecords(studentId) {
  let q = db.collection("examRecords").orderBy("date", "desc");
  if (studentId) q = db.collection("examRecords").where("studentId", "==", studentId);
  const snap = await q.get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // studentId 篩選時 Firestore 需另外排序（避免複合索引需求）
  // 排序結果為「新到舊」：優先照學制順序（學期＋考試類型）排列；
  // 若學期文字無法辨識，才退回用日期排序；日期也相同則用建立時間（createdAt）當最後依據。
  rows.sort((a, b) => {
    const aOrd = getCurriculumOrdinal(a);
    const bOrd = getCurriculumOrdinal(b);
    if (aOrd !== null && bOrd !== null && aOrd !== bOrd) return bOrd - aOrd;

    const dateCmp = (b.date || "").localeCompare(a.date || "");
    if (dateCmp !== 0) return dateCmp;

    const aTime = a.createdAt && typeof a.createdAt.toMillis === "function" ? a.createdAt.toMillis() : 0;
    const bTime = b.createdAt && typeof b.createdAt.toMillis === "function" ? b.createdAt.toMillis() : 0;
    return bTime - aTime;
  });
  return rows;
}

async function addExamRecord(record) {
  return db.collection("examRecords").add({
    ...record,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    createdBy: auth.currentUser ? auth.currentUser.email : null,
  });
}

async function deleteExamRecord(id) {
  await db.collection("examRecords").doc(id).delete();
}

async function updateExamRecord(id, record) {
  await db.collection("examRecords").doc(id).update({
    ...record,
    updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
    updatedBy: auth.currentUser ? auth.currentUser.email : null,
  });
}

async function getExamRecord(id) {
  const doc = await db.collection("examRecords").doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

/** 取得某學生、某科目「最近一次」紀錄中的分數，做為下一次的 prevScore 預設值 */
async function getLastScoreForSubject(studentId, subjectName, beforeDate) {
  const records = await listExamRecords(studentId);
  for (const r of records) {
    if (beforeDate && r.date >= beforeDate) continue;
    const s = (r.subjects || []).find((x) => x.name === subjectName);
    if (s) return s.score;
  }
  return null;
}

// ------------------------------------------------------------------
// 圖表顯示設定：全域一份預設值（config/chartSettings），每位學生可在
// students/{id}.chartOverride 個別覆寫其中任何欄位；沒有覆寫的欄位繼續沿用全域值。
function defaultChartSettings() {
  return { yMin: 60, yMax: 100, xCount: 0, showPointLabels: false };
}

async function getChartSettings() {
  const doc = await db.collection("config").doc("chartSettings").get();
  return { ...defaultChartSettings(), ...(doc.exists ? doc.data() : {}) };
}

async function saveChartSettings(settings) {
  await db.collection("config").doc("chartSettings").set(settings, { merge: true });
}

/** 合併全域設定與該學生的個別覆寫，回傳這個學生實際要用的圖表顯示設定 */
function resolveChartSettings(student, globalSettings) {
  const base = { ...defaultChartSettings(), ...(globalSettings || {}) };
  const override = student && student.chartOverride;
  return override ? { ...base, ...override } : base;
}

// ------------------------------------------------------------------
// 總覽頁標題：預設「JFKD Family 成績記錄表」，可在畫面上直接點筆狀圖示編輯，
// 存在 config/settings.dashboardTitle（與 defaultProfileId 共用同一份文件）。
const DEFAULT_DASHBOARD_TITLE = "JFKD Family 成績記錄表";
async function saveDashboardTitle(title) {
  await db.collection("config").doc("settings").set({ dashboardTitle: title }, { merge: true });
}

// ------------------------------------------------------------------
// 全站字體大小：單一全域設定（不分學生），存在 config/settings.fontScale，
// 值為 "sm"｜"md"｜"lg"｜"xl"，預設 "md"（＝原本既有的字體大小）。
async function getSiteFontScale() {
  const s = await getSettings();
  return s.fontScale || "md";
}
async function saveSiteFontScale(scale) {
  await db.collection("config").doc("settings").set({ fontScale: scale }, { merge: true });
}

// ------------------------------------------------------------------
// 學生主題造型：固定的主題庫（原創致敬風格，不使用官方角色圖／真人肖像），
// 在「學生名單」頁為每位學生選擇要套用哪一套；套用後只會影響該學生自己的
// 學生紀錄頁（student.html?id=該生），全站其他頁面維持標準樣式。
const STUDENT_THEMES = {
  zoro: {
    id: "zoro",
    name: "綠色劍士・三刀流",
    tagline: "致敬海賊迷弟哈哈最愛的綠髮劍士，鮮豔螢光綠＋耀眼金色配色",
    bodyClass: "theme-zoro",
  },
  babymonster: {
    id: "babymonster",
    name: "猛獸舞台・酷紅戰帖",
    tagline: "致敬 K-POP 女孩團體舞台氣勢，黑×紅×白×銀金屬酷酸配色",
    bodyClass: "theme-babymonster",
  },
};
function getStudentTheme(themeId) {
  return STUDENT_THEMES[themeId] || null;
}

/** 原創致敬風格小圖示（純幾何線條繪製，非官方角色圖／真人肖像） */
function themeIconSvg(themeId) {
  if (themeId === "zoro") {
    // 三把交錯的刀刃剪影，致敬「三刀流」意象；加上鮮綠光暈與金色刀鍔，呈現更鮮豔誇張的視覺效果
    return `
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="10" y1="48" x2="48" y2="10" stroke="#00e676" stroke-width="7" stroke-linecap="round" opacity="0.35"/>
        <line x1="30" y1="50" x2="30" y2="6" stroke="#00e676" stroke-width="7" stroke-linecap="round" opacity="0.35"/>
        <line x1="48" y1="48" x2="10" y2="10" stroke="#00e676" stroke-width="7" stroke-linecap="round" opacity="0.35"/>
        <line x1="10" y1="48" x2="48" y2="10" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <line x1="30" y1="50" x2="30" y2="6" stroke="#eafff2" stroke-width="3" stroke-linecap="round"/>
        <line x1="48" y1="48" x2="10" y2="10" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <circle cx="30" cy="30" r="7" fill="#ffd200" stroke="#04220f" stroke-width="1.5"/>
        <circle cx="27" cy="27" r="2" fill="#fff8dc"/>
      </svg>`;
  }
  if (themeId === "babymonster") {
    // 三道爪痕剪影，致敬「MONSTER」猛獸意象；紅色光暈＋白色刃芯，右上角銀框紅星徽章呼應舞台戰袍配件
    return `
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <line x1="8" y1="12" x2="22" y2="52" stroke="#ff1744" stroke-width="7" stroke-linecap="round" opacity="0.4"/>
        <line x1="23" y1="8" x2="33" y2="52" stroke="#ff1744" stroke-width="7" stroke-linecap="round" opacity="0.4"/>
        <line x1="38" y1="12" x2="46" y2="50" stroke="#ff1744" stroke-width="7" stroke-linecap="round" opacity="0.4"/>
        <line x1="8" y1="12" x2="22" y2="52" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <line x1="23" y1="8" x2="33" y2="52" stroke="#f4f4f6" stroke-width="3" stroke-linecap="round"/>
        <line x1="38" y1="12" x2="46" y2="50" stroke="#ffffff" stroke-width="3" stroke-linecap="round"/>
        <circle cx="45" cy="15" r="8" fill="#111114" stroke="#d8dbe2" stroke-width="2"/>
        <path d="M45 10.5 L46.6 13.8 L50.2 14.3 L47.6 16.8 L48.3 20.3 L45 18.6 L41.7 20.3 L42.4 16.8 L39.8 14.3 L43.4 13.8 Z" fill="#ff1744"/>
      </svg>`;
  }
  return "";
}

// ------------------------------------------------------------------
// 科目卡片特效：素材庫（6種，供4條觸發規則自由搭配）＋規則設定（config/effectSettings）
// 每條規則＝一種觸發條件（progress進步／defense衛冕／both進步+衛冕／final100最新一次100分），
// final100 為「獨立判斷」：只看該科目最新一次紀錄是不是100分，不再要求同時滿足進步或衛冕；
// 4條規則彼此判斷互斥，優先順序 final100 > both > defense > progress（同時符合多項時，取最高等級的規則）。
// 每條規則可各自設定：enabled（開關）、effect（素材庫id）、duration（播放毫秒數）、
// trigger（"auto"=依裝置自動判斷桌機hover／觸控點擊，"hover"=強制滑鼠移入，"click"=強制點擊）。
const EFFECT_CATALOG = [
  { id: "thumbsUp", label: "👍 比讚", scope: "card" },
  { id: "crownSpin", label: "👑 皇冠衛冕", scope: "card" },
  { id: "rocketChart", label: "🚀 火箭衝天＋火花尾韻", scope: "card" },
  { id: "starburst", label: "✨ 星光閃耀＋放射光芒", scope: "card" },
  { id: "cardConfetti", label: "🎊 卡片內灑花", scope: "card" },
  { id: "animalParty", label: "🎉 動物派對嘉年華（全頁）", scope: "fullpage" },
];

const EFFECT_RULE_LABELS = {
  progress: "進步",
  defense: "衛冕",
  both: "進步＋衛冕",
  final100: "最新一次滿分100",
};

function defaultEffectSettings() {
  return {
    progress: { enabled: true, effect: "rocketChart", duration: 2000, trigger: "auto" },
    defense: { enabled: true, effect: "crownSpin", duration: 2000, trigger: "auto" },
    both: { enabled: true, effect: "starburst", duration: 5000, trigger: "auto" },
    final100: { enabled: true, effect: "animalParty", duration: 10000, trigger: "auto" },
  };
}

async function getEffectSettings() {
  const doc = await db.collection("config").doc("effectSettings").get();
  const saved = doc.exists ? doc.data() : {};
  const base = defaultEffectSettings();
  const merged = {};
  for (const key of Object.keys(base)) {
    merged[key] = { ...base[key], ...(saved[key] || {}) };
  }
  return merged;
}

async function saveEffectSettings(settings) {
  await db.collection("config").doc("effectSettings").set(settings, { merge: true });
}

/** 組出主題橫幅 HTML（student.html 套用主題時放在內容區最上方）
 * overrideTitle／overrideTagline：在「學生主題造型」頁可個別覆寫的大標題／小標題文字，
 * 沒有覆寫時就退回預設值（學生名稱＋主題名稱／主題原本的 tagline）。 */
function themeBannerHtml(themeId, studentName, overrideTitle, overrideTagline) {
  const theme = getStudentTheme(themeId);
  if (!theme) return "";
  const title = overrideTitle || `${studentName} · ${theme.name}`;
  const tagline = overrideTagline || theme.tagline;
  return `
    <div class="theme-banner">
      <div class="theme-banner-icon">${themeIconSvg(theme.id)}</div>
      <div class="theme-banner-text">
        <div class="name">${escapeHtml(title)}</div>
        <div class="tagline">${escapeHtml(tagline)}</div>
      </div>
    </div>`;
}
