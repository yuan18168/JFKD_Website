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
    name: "索隆劍士 · 霸氣三刀流",
    tagline: "致敬 海賊王，哈哈最愛的綠髮劍士，鮮豔螢光綠＋耀眼金色配色",
    bodyClass: "theme-zoro",
  },
  babymonster: {
    id: "babymonster",
    name: "寶貝怪獸 · 媚力四射",
    tagline: "致敬 Babymonster K-POP 女團舞台氣勢，黑×紅×白×銀金屬酷炫配色",
    bodyClass: "theme-babymonster",
  },
  // ---- 2026-07-31 新增：用 XP 解鎖的高階主題（門檻見 gamify.js THEME_XP）----
  galaxy: {
    id: "galaxy",
    name: "銀河星空",
    tagline: "深紫星雲與流星劃過的夜空，累積 3,000 XP 解鎖",
    bodyClass: "theme-galaxy",
  },
  lava: {
    id: "lava",
    name: "熔岩烈焰",
    tagline: "橘紅岩漿流動的火山地心，累積 7,500 XP 解鎖",
    bodyClass: "theme-lava",
  },
  aurora: {
    id: "aurora",
    name: "極光森林",
    tagline: "青綠極光籠罩的靜謐森林夜，累積 15,000 XP 解鎖",
    bodyClass: "theme-aurora",
  },
  gold: {
    id: "gold",
    name: "黃金殿堂",
    tagline: "最高階的金色流光與皇冠，累積 30,000 XP 解鎖",
    bodyClass: "theme-gold",
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
  if (themeId === "galaxy") {
    return `
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="30" cy="30" r="22" fill="#2A1258" stroke="#A855F7" stroke-width="2"/>
        <ellipse cx="30" cy="30" rx="24" ry="8" stroke="#C9A7FF" stroke-width="2" transform="rotate(-25 30 30)"/>
        <circle cx="22" cy="24" r="2" fill="#fff"/><circle cx="38" cy="21" r="1.5" fill="#E4D9FF"/>
        <circle cx="41" cy="38" r="2" fill="#fff"/><circle cx="19" cy="39" r="1.5" fill="#C9A7FF"/>
        <path d="M44 12 L46 17 L51 19 L46 21 L44 26 L42 21 L37 19 L42 17 Z" fill="#FFE9A8"/>
      </svg>`;
  }
  if (themeId === "lava") {
    return `
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M8 50 L24 16 L36 34 L44 22 L52 50 Z" fill="#4A1200" stroke="#FF6B00" stroke-width="2" stroke-linejoin="round"/>
        <path d="M13 50 L24 27 L34 41 L44 30 L48 50 Z" fill="#FF6B00" opacity="0.85"/>
        <path d="M18 50 L25 36 L33 46 L40 38 L44 50 Z" fill="#FFC93C"/>
        <circle cx="24" cy="13" r="3" fill="#FF3D00"/><circle cx="43" cy="18" r="2" fill="#FF8A3D"/>
      </svg>`;
  }
  if (themeId === "aurora") {
    return `
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M6 22 Q18 6 30 20 Q42 34 54 16" stroke="#19C79A" stroke-width="5" stroke-linecap="round" fill="none" opacity="0.85"/>
        <path d="M6 30 Q18 14 30 28 Q42 42 54 24" stroke="#7DF9D6" stroke-width="3.5" stroke-linecap="round" fill="none" opacity="0.7"/>
        <path d="M16 54 L22 34 L28 54 Z" fill="#0B5C4A"/>
        <path d="M31 54 L38 30 L45 54 Z" fill="#0E7A62"/>
        <circle cx="48" cy="12" r="2" fill="#D6FFF4"/><circle cx="12" cy="15" r="1.5" fill="#D6FFF4"/>
      </svg>`;
  }
  if (themeId === "gold") {
    return `
      <svg width="60" height="60" viewBox="0 0 60 60" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 42 L16 20 L24 32 L30 14 L36 32 L44 20 L50 42 Z" fill="#FFC93C" stroke="#8A6A00" stroke-width="2" stroke-linejoin="round"/>
        <rect x="10" y="42" width="40" height="7" rx="2" fill="#FFE9A8" stroke="#8A6A00" stroke-width="2"/>
        <circle cx="30" cy="14" r="3.5" fill="#FFF6D6" stroke="#8A6A00" stroke-width="1.5"/>
        <circle cx="20" cy="45.5" r="1.8" fill="#8A6A00"/><circle cx="30" cy="45.5" r="1.8" fill="#8A6A00"/><circle cx="40" cy="45.5" r="1.8" fill="#8A6A00"/>
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

// ------------------------------------------------------------------
// 【2026-07-31 改版】成長系統：XP 經驗值／連續打卡／護盾卡／成就徽章
//
// ＝＝ XP 經驗值（唯一的累積型點數）＝＝
//   XP = 累計獎金（examRecords 算出的 totalBonus，1 元 = 1 點，在畫面端計算）
//        ＋ xpFromTasks（完成每日任務、完美一天加成、連續打卡里程碑獎勵累積而來）
//   XP 決定：等級（見 gamify.js LEVELS）、主題造型解鎖門檻、部分成就徽章。
//   ※ XP 純粹是遊戲進度，跟真實獎金 NT$ 是兩回事：獎金只用於許願池，永遠不會被 XP 消耗。
//
// ＝＝ 連續打卡 ＝＝
//   打卡＝當天「第一次」完成任意 1 項每日任務。同一天再完成其他任務不會重複加天數。
//   斷線保護（雙保險）：
//     1) 護盾卡 shields：每連續打卡滿 SHIELD_EVERY 天自動 +1（上限 SHIELD_MAX 張）。
//        隔天發現昨天沒打卡時，自動消耗 1 張護盾把連續天數接回去。
//     2) totalDays 累計總打卡天數：只增不減，就算連續斷了也看得到自己總共累積了幾天。
//   best 保存歷史最高連續天數。
//
// ＝＝ students/{id} 新增欄位（全部選填，沒有資料時用預設值）＝＝
//   xpFromTasks           number：每日任務／完美一天／里程碑累積的 XP
//   streak                { count, lastCheckInDate, best, totalDays, shields }
//   dailyTasks            [{ id, name, xpReward }]（舊資料的 foodReward+coinReward 會自動換算成 xpReward）
//   dailyTaskCompletions  { "2026-07-31": ["taskId1", ...] }
//   badges                { "badgeId": "2026-07-31", ... } 徽章解鎖日期
//   ※ 舊版的 pet / currency 欄位一律保留不刪除（改版前的備份還原時才不會遺失），只是不再讀取。

const SHIELD_EVERY = 7;   // 每連續打卡滿幾天送 1 張護盾卡
const SHIELD_MAX = 2;     // 護盾卡同時最多持有幾張
const PERFECT_DAY_XP = 20; // 當天所有任務都完成的額外加成
const STREAK_MILESTONES = { 7: 30, 14: 50, 30: 100, 50: 150, 100: 300, 180: 500, 365: 1000 };

function defaultStreakState() {
  return { count: 0, lastCheckInDate: null, best: 0, totalDays: 0, shields: 0, comeback: null };
}
function normalizeStreak(raw) {
  const s = { ...defaultStreakState(), ...(raw || {}) };
  // 相容舊資料：舊版只有 count / lastCheckInDate
  s.count = Number(s.count) || 0;
  s.best = Math.max(Number(s.best) || 0, s.count);
  s.totalDays = Math.max(Number(s.totalDays) || 0, s.count);
  s.shields = Math.min(SHIELD_MAX, Number(s.shields) || 0);
  // comeback（U2 復活賽）：只保留還「啟用中」的物件，過期或已結束的一律視為 null
  s.comeback = s.comeback && s.comeback.active ? s.comeback : null;
  return s;
}
const COMEBACK_WINDOW_MS = 24 * 60 * 60 * 1000; // 復活賽時限：24 小時
const COMEBACK_TASKS_NEEDED = 2; // 需完成「雙倍任務」＝當天累計完成 2 項任務（含觸發打卡的那一項）
function todayStr() {
  return localDateStr(new Date());
}
function yesterdayStr() {
  return localDateStr(new Date(Date.now() - 86400000));
}
/** 用「本地時區」算日期字串，避免 toISOString() 在台灣時區把凌晨算成前一天 */
function localDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function daysBetween(aStr, bStr) {
  if (!aStr || !bStr) return null;
  const a = new Date(aStr + "T00:00:00");
  const b = new Date(bStr + "T00:00:00");
  return Math.round((b - a) / 86400000);
}

/** 每日任務清單（相容舊的 foodReward / coinReward，一律換算成單一 xpReward）
 * 【2026-07-31 U9】新增 days：適用星期幾，0=日 1=一 ... 6=六（對應 Date.getDay()）。
 * 沒有設定（舊資料）視為「每天都適用」。 */
function normalizeDailyTasks(list) {
  return (Array.isArray(list) ? list : []).map((t) => ({
    id: t.id,
    name: t.name || "",
    xpReward:
      typeof t.xpReward === "number"
        ? t.xpReward
        : (Number(t.foodReward) || 0) + (Number(t.coinReward) || 0),
    days:
      Array.isArray(t.days) && t.days.length
        ? t.days.map(Number).filter((n) => n >= 0 && n <= 6)
        : [0, 1, 2, 3, 4, 5, 6],
  }));
}

/** 這項任務今天適不適用（依 days 星期幾設定，預設每天都適用） */
function taskAppliesToday(task, dateObj) {
  const d = dateObj || new Date();
  if (!task || !Array.isArray(task.days) || task.days.length === 0) return true;
  return task.days.includes(d.getDay());
}

const WEEKDAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"]; // 對應 getDay() 0-6
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // 畫面上習慣顯示「一二三四五六日」

async function saveDailyTasks(studentId, tasks) {
  await updateStudent(studentId, { dailyTasks: tasks });
}

/**
 * 打卡：當天第一次完成任意任務時呼叫，回傳新的 streak 物件與本次額外獲得的里程碑 XP。
 * 會先處理「昨天沒打卡 → 自動消耗護盾卡」的補救，再累加今天。
 *
 * 【2026-07-31 U2 復活賽】護盾卡用完、連續紀錄真的斷掉時，不會直接讓孩子的努力歸零：
 * 會開啟一個 24 小時的「復活賽」，只要在時限內累計完成 2 項任務（含這次觸發打卡的任務），
 * 就能把原本的連續天數「找回來」（接續 prevCount+1，不是真的歸零重來）。
 * 復活賽沒有在時限內達成才會維持歸零的結果——但完全不會扣任何東西，純粹是「多一次機會」。
 */
function checkInToday(rawStreak) {
  const s = normalizeStreak(rawStreak);
  const today = todayStr();
  if (s.lastCheckInDate === today) return { streak: s, bonusXp: 0, usedShield: false, milestone: null, comebackStarted: false };

  const gap = daysBetween(s.lastCheckInDate, today);
  let usedShield = false;
  let comebackStarted = false;

  if (gap === 1 || s.lastCheckInDate === null) {
    // 昨天有打卡（或第一次打卡）→ 正常累加
    s.count = (s.count || 0) + 1;
  } else if (gap !== null && gap > 1) {
    // 中間有斷：每漏一天消耗一張護盾卡，護盾夠就把連續紀錄接回來，不夠就開啟復活賽
    const missed = gap - 1;
    if (s.shields >= missed) {
      s.shields -= missed;
      s.count = (s.count || 0) + 1;
      usedShield = true;
    } else {
      const prevCount = s.count || 0;
      s.count = 1;
      s.shields = 0;
      if (prevCount > 0) {
        s.comeback = {
          active: true,
          prevCount,
          deadline: Date.now() + COMEBACK_WINDOW_MS,
          tasksDone: 1, // 這次觸發打卡的任務算第 1 項
          need: COMEBACK_TASKS_NEEDED,
        };
        comebackStarted = true;
      }
    }
  } else {
    s.count = (s.count || 0) + 1;
  }

  s.lastCheckInDate = today;
  s.totalDays = (s.totalDays || 0) + 1;
  s.best = Math.max(s.best || 0, s.count);

  // 每滿 SHIELD_EVERY 天送一張護盾卡（上限 SHIELD_MAX）
  if (s.count > 0 && s.count % SHIELD_EVERY === 0) {
    s.shields = Math.min(SHIELD_MAX, (s.shields || 0) + 1);
  }

  const milestone = STREAK_MILESTONES[s.count] ? s.count : null;
  const bonusXp = milestone ? STREAK_MILESTONES[milestone] : 0;
  return { streak: s, bonusXp, usedShield, milestone, comebackStarted };
}

/**
 * 復活賽進度推進：每完成 1 項任務就呼叫一次（除了「剛開啟復活賽」的那一次，因為
 * checkInToday() 已經把它算作第 1 項了，避免同一項任務被算兩次）。
 * 時限到了還沒達成，復活賽直接關閉（不會有任何懲罰，只是機會用完）。
 * 回傳 { streak, comebackResult }，comebackResult 為 null 或 { recovered:true, count }。
 */
function advanceComeback(streak, { skip } = {}) {
  const s = streak;
  if (!s.comeback || !s.comeback.active) return { streak: s, comebackResult: null };
  if (Date.now() > s.comeback.deadline) {
    s.comeback = null;
    return { streak: s, comebackResult: null };
  }
  if (!skip) {
    s.comeback.tasksDone = (s.comeback.tasksDone || 0) + 1;
  }
  if (s.comeback.tasksDone >= s.comeback.need) {
    const restored = s.comeback.prevCount + 1;
    s.count = restored;
    s.best = Math.max(s.best || 0, restored);
    s.comeback = null;
    return { streak: s, comebackResult: { recovered: true, count: restored } };
  }
  return { streak: s, comebackResult: null };
}

/**
 * 孩子勾選「今日任務」完成：發 XP、必要時打卡、處理完美一天加成。
 * 同一天內同一項任務只會發一次。回傳 { student, gainedXp, checkIn }。
 */
async function completeDailyTask(student, task, allTasks) {
  const today = todayStr();
  const completions = { ...(student.dailyTaskCompletions || {}) };
  const doneToday = new Set(completions[today] || []);
  if (doneToday.has(task.id)) return { student, gainedXp: 0, checkIn: null, comebackResult: null };

  const wasEmpty = doneToday.size === 0;
  doneToday.add(task.id);
  completions[today] = [...doneToday];

  let gained = Number(task.xpReward) || 0;

  // 當天所有「今天適用」的任務都完成 → 完美一天加成（U9：星期幾篩選後才是今天真正要做的任務數）
  const allNorm = normalizeDailyTasks(allTasks || student.dailyTasks);
  const applicableToday = allNorm.filter((t) => taskAppliesToday(t));
  const total = applicableToday.length;
  if (total > 0 && doneToday.size === total) gained += PERFECT_DAY_XP;

  // 當天第一次完成任務 → 打卡
  let streak = normalizeStreak(student.streak);
  let checkIn = null;
  if (wasEmpty) {
    checkIn = checkInToday(streak);
    streak = checkIn.streak;
    gained += checkIn.bonusXp;
  }

  // U2 復活賽：推進進度（剛開啟的那一次已經算過，這裡跳過避免重複計算）
  const { comebackResult } = advanceComeback(streak, { skip: !!(checkIn && checkIn.comebackStarted) });

  const xpFromTasks = (Number(student.xpFromTasks) || 0) + gained;
  const fields = { dailyTaskCompletions: completions, xpFromTasks, streak };
  await updateStudent(student.id, fields);
  return { student: { ...student, ...fields }, gainedXp: gained, checkIn, comebackResult };
}

/**
 * 取消勾選（勾錯的補救）：收回該任務的 XP 與完美一天加成。
 * 連續打卡天數與里程碑獎勵「不會」被收回 —— 避免同一天勾了又取消造成天數判斷的邊界問題，
 * 也避免孩子因為手誤就失去辛苦累積的連續紀錄。
 */
async function uncompleteDailyTask(student, task, allTasks) {
  const today = todayStr();
  const completions = { ...(student.dailyTaskCompletions || {}) };
  const doneToday = new Set(completions[today] || []);
  if (!doneToday.has(task.id)) return { student, lostXp: 0 };

  const applicableToday = normalizeDailyTasks(allTasks || student.dailyTasks).filter((t) => taskAppliesToday(t));
  const total = applicableToday.length;
  const wasPerfect = total > 0 && doneToday.size === total;

  doneToday.delete(task.id);
  completions[today] = [...doneToday];

  let lost = Number(task.xpReward) || 0;
  if (wasPerfect) lost += PERFECT_DAY_XP;

  const xpFromTasks = Math.max(0, (Number(student.xpFromTasks) || 0) - lost);
  const fields = { dailyTaskCompletions: completions, xpFromTasks };
  await updateStudent(student.id, fields);
  return { student: { ...student, ...fields }, lostXp: lost };
}

/** 徽章解鎖狀態：{ badgeId: "YYYY-MM-DD" }，只會新增不會移除已解鎖的徽章 */
async function saveUnlockedBadges(studentId, badgeMap) {
  await updateStudent(studentId, { badges: badgeMap });
}

// ------------------------------------------------------------------
// 【2026-07-31 U1】每日心情打卡：每天第一次進孩子模式首頁時，強制先選一個心情
// 才會看到首頁內容。存在 students/{id}.moodLog = { "2026-07-31": "great", ... }，
// 純粹是給孩子的小儀式感與家長參考用，完全不影響任何獎金／XP／徽章判定。
const MOOD_OPTIONS = [
  { id: "great", emoji: "😄", label: "超開心" },
  { id: "good", emoji: "🙂", label: "還不錯" },
  { id: "okay", emoji: "😐", label: "普通" },
  { id: "bad", emoji: "😣", label: "不太好" },
  { id: "sad", emoji: "😢", label: "難過" },
];
function hasMoodToday(student) {
  return !!((student && student.moodLog) || {})[todayStr()];
}
async function saveMoodToday(studentId, moodId) {
  const field = "moodLog." + todayStr();
  await db.collection("students").doc(studentId).update({ [field]: moodId });
}

// ------------------------------------------------------------------
// 家長模式 PIN 碼（存在 config/settings.parentPin，預設 1234）
const DEFAULT_PARENT_PIN = "1234";
async function getParentPin() {
  const s = await getSettings();
  return String(s.parentPin || DEFAULT_PARENT_PIN);
}
async function saveParentPin(pin) {
  await db.collection("config").doc("settings").set({ parentPin: String(pin) }, { merge: true });
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
