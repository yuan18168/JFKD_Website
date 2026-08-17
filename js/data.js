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
//   moodLog               { "2026-07-31": "great", ... } 每日心情打卡
//   moodStreakBest         number：連續選心情的最佳紀錄（只增不減），供「心情系列」徽章判定用
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
// 不影響任何獎金判定。
// 【2026-08-01 改版】原本選完心情之後完全沒有後續效果（純寫入、家長也看不到），
// 這次補上兩個看得到的回饋：①最近 28 天打卡月曆合併顯示每天的心情表情
// ②連續選心情的天數（moodStreakBest，只增不減的滾動型最佳紀錄）拿去判定「心情系列」徽章。
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
/** 從今天回推，連續每天都有選心情的天數（含今天）。純粹用 moodLog 掃描，不需要額外存欄位。 */
function computeMoodStreakCount(moodLog) {
  const log = moodLog || {};
  let count = 0;
  let d = new Date();
  while (log[localDateStr(d)]) {
    count++;
    d = new Date(d.getTime() - 86400000);
  }
  return count;
}
/**
 * 儲存今天的心情，同步更新 moodStreakBest（連續選心情的最佳紀錄，只增不減）。
 * 回傳 { moodLog, moodStreakBest } 給呼叫端更新本地 ctx.student，避免重新整頁讀取。
 */
async function saveMoodToday(studentId, moodId, currentMoodLog, currentBest) {
  const today = todayStr();
  const newLog = { ...(currentMoodLog || {}), [today]: moodId };
  const count = computeMoodStreakCount(newLog);
  const moodStreakBest = Math.max(Number(currentBest) || 0, count);
  await updateStudent(studentId, {
    ["moodLog." + today]: moodId,
    moodStreakBest,
  });
  return { moodLog: newLog, moodStreakBest };
}

// ------------------------------------------------------------------
// 【2026-08-01】圖鑑（徽章）重置：父母管理「學生名單」頁使用，讓家長能把測試時
// 誤解鎖、或想重來的徽章移除。移除後如果條件又符合，evaluateBadges 會重新判定解鎖。
async function removeBadges(studentId, badgeIds) {
  const ids = Array.isArray(badgeIds) ? badgeIds : [];
  if (!ids.length) return;
  const fields = {};
  ids.forEach((id) => { fields["badges." + id] = firebase.firestore.FieldValue.delete(); });
  await updateStudent(studentId, fields);
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

// ------------------------------------------------------------------
// 【2026-07-31 出門紀律／規矩框架】
//
// ＝＝ 資料結構（students/{id} 新增欄位，全部選填）＝＝
//   rules               [{ id, type:'punctuality'|'fixedCount', name, enabled, config }]
//                        - punctuality.config = { deadlineTime:"07:35", multiplier:10 }
//                        - fixedCount.config  = { defaultCount:100 }（快速登記時預帶的次數，仍可改）
//   arrivalLog           { "<ruleId>_YYYY-MM-DD": { ruleId, date, time, deltaMinutes, source:'auto'|'manual' } }
//                        deltaMinutes 正=遲到分鐘數、負=提早分鐘數
//   ruleViolations       [{ id, ruleId(可為 null=雜項登記), count, reason, loggedAt(YYYY-MM-DD), loggedBy, settled }]
//   ruleSettlements      [{ id, periodStart, periodEnd（顯示用「YYYY-MM-DD HH:MM」字串）, periodEndMs,
//                            netJumpingJacks, punishmentCount, punishmentStatus:'pending'|'done', bonusAmount, computedAt }]
//   ruleBonusTotal       number：規矩結算累積發放的獎金（NT$），會併入孩子模式的「總獎金」計算（見 app.js ctx.totalBonus）
//   lastRuleSettlementMs  最近一次已完成結算的精確時間戳（毫秒），null = 從未結算過
//                          【2026-07-31 修正】改用精確時間戳而非純日期字串，避免「結算當天但登記時間已過
//                          截止時刻」的內容被誤判成「已過期、可以立刻結算」，造成登記後秒被結算的 bug。
//
// ＝＝ 全部規矩統一以「開合跳次數」為基礎單位，週五晚上 18:00 為結算截止時間 ＝＝
// 網站是純靜態頁面、沒有後台排程，「自動結算」實際上是：任何人開啟孩子模式或家長模式時，
// 偵測「已過上一個應結算的週五 18:00 但尚未結算」就自動補算，多週沒開也能一次追上；
// 18:00 之後才登記的處罰，一律併到下週五才結算。家長也可在「規矩設定」頁按「手動提前結算本週」
// 立即以「現在」為截止時刻結算（見 forceSettleNow）。

const RULE_WEEKLY_SETTLEMENT_HOUR = 18; // 週五晚上幾點視為結算截止
const RULE_UNIT_LABEL = "開合跳";

const RULE_TEMPLATES = {
  punctuality: {
    type: "punctuality",
    label: "⏰ 出門紀律（時間損益型）",
    desc: "設定每天規定出門準備好的時間，孩子打卡回報，遲到/提早依分鐘數×倍率換算開合跳",
    defaultName: "出門紀律",
    defaultConfig: { deadlineTime: "07:35", multiplier: 10 },
  },
  fixedCount: {
    type: "fixedCount",
    label: "📌 固定次數型（違規一次固定罰）",
    desc: "例如沒繫安全帶、被長輩罵等，每次違規登記固定的開合跳次數",
    defaultName: "生活常規",
    defaultConfig: { defaultCount: 100 },
  },
};

function defaultRuleConfig(type) {
  const tpl = RULE_TEMPLATES[type];
  return tpl ? { ...tpl.defaultConfig } : {};
}

/** 新增一條規矩用的預設物件（尚未存檔） */
function newRuleDraft(type) {
  const tpl = RULE_TEMPLATES[type] || RULE_TEMPLATES.punctuality;
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    type: tpl.type,
    name: tpl.defaultName,
    enabled: true,
    config: defaultRuleConfig(tpl.type),
  };
}

/** 清理/補齊每條規矩的欄位，避免舊資料或手動改壞資料造成畫面出錯 */
function normalizeRules(list) {
  return (Array.isArray(list) ? list : [])
    .filter((r) => r && RULE_TEMPLATES[r.type])
    .map((r) => ({
      id: r.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random())),
      type: r.type,
      name: r.name || RULE_TEMPLATES[r.type].defaultName,
      enabled: r.enabled !== false,
      config: { ...defaultRuleConfig(r.type), ...(r.config || {}) },
    }));
}

async function saveStudentRules(studentId, rules) {
  await updateStudent(studentId, { rules: normalizeRules(rules) });
}

/** 把 "HH:MM" 轉成當天的分鐘數（00:00 起算），方便跟打卡時間比較 */
function hhmmToMinutes(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * 出門紀律打卡：孩子按下「我準備好了」時呼叫。用目前時間跟該規矩設定的
 * deadlineTime 比較，算出遲到/提早幾分鐘（正=遲到，負=提早），寫入 arrivalLog。
 * 同一天同一條規矩只會記錄第一次打卡的時間（避免孩子重複點擊洗掉紀錄）；
 * 家長如需修正才呼叫 correctArrivalTime()。
 */
async function recordArrivalCheckIn(student, rule) {
  const today = todayStr();
  const key = `${rule.id}_${today}`;
  const log = { ...(student.arrivalLog || {}) };
  if (log[key]) return { student, entry: log[key], alreadyLogged: true };

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const deadlineMinutes = hhmmToMinutes(rule.config && rule.config.deadlineTime) ?? hhmmToMinutes("07:35");
  const deltaMinutes = nowMinutes - deadlineMinutes;
  const time = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const entry = { ruleId: rule.id, date: today, time, deltaMinutes, atMs: now.getTime(), source: "auto" };
  log[key] = entry;
  await updateStudent(student.id, { arrivalLog: log });
  return { student: { ...student, arrivalLog: log }, entry, alreadyLogged: false };
}

/** 家長端修正某天的打卡時間（發現孩子忘記打卡或時間不對時使用） */
async function correctArrivalTime(student, rule, dateStr, timeStr) {
  const key = `${rule.id}_${dateStr}`;
  const log = { ...(student.arrivalLog || {}) };
  const deadlineMinutes = hhmmToMinutes(rule.config && rule.config.deadlineTime) ?? hhmmToMinutes("07:35");
  const [hh, mm] = timeStr.split(":").map(Number);
  const deltaMinutes = hh * 60 + mm - deadlineMinutes;
  const atMs = new Date(`${dateStr}T${timeStr}:00`).getTime();
  log[key] = { ruleId: rule.id, date: dateStr, time: timeStr, deltaMinutes, atMs, source: "manual" };
  await updateStudent(student.id, { arrivalLog: log });
  return { student: { ...student, arrivalLog: log } };
}

function hasArrivalToday(student, ruleId) {
  const key = `${ruleId}_${todayStr()}`;
  return !!((student && student.arrivalLog) || {})[key];
}

/**
 * 登記處罰（固定次數型規矩的違規，或不綁規矩的雜項登記）。
 * 家長模式常駐工具、孩子模式規矩頁的 PIN 登記入口都呼叫這支。
 */
async function logRuleViolation(student, { ruleId = null, count, reason, loggedBy }) {
  const now = Date.now();
  const entry = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    ruleId: ruleId || null,
    count: Number(count) || 0,
    reason: reason || "",
    loggedAt: todayStr(),
    loggedAtMs: now,
    loggedBy: loggedBy || (auth.currentUser ? auth.currentUser.email : "kid"),
    settled: false,
    // executedStatus：家長是否已經「當場」執行過這筆處罰（跟每週五的淨值結算是兩件事，見 setViolationExecuted）
    executedStatus: "pending",
  };
  // 【2026-08-04 修正】改用 arrayUnion 原子寫入，不再依賴記憶體裡可能過期的 student.ruleViolations
  // 快照做「整包覆寫」——常駐浮動按鈕的 widget 是頁面載入時就快取好學生清單，
  // 如果頁面停留較久、中途有其他裝置或結算流程動過這位學生的處罰紀錄，
  // 整包覆寫會把那些變動蓋掉，新登記的這筆也可能因此跟著被覆寫回舊狀態。
  await updateStudent(student.id, { ruleViolations: firebase.firestore.FieldValue.arrayUnion(entry) });
  const list = [...(student.ruleViolations || []), entry];
  return { student: { ...student, ruleViolations: list }, entry };
}

/** 家長端：修正某筆已登記處罰的次數/原因（不論是否已結算都能修正，但已結算的過去結算金額不會回溯調整） */
async function updateRuleViolation(student, violationId, fields) {
  const list = (student.ruleViolations || []).map((v) =>
    v.id === violationId ? { ...v, ...fields, count: Number(fields.count ?? v.count) || 0 } : v
  );
  await updateStudent(student.id, { ruleViolations: list });
  return { student: { ...student, ruleViolations: list } };
}

/** 家長端：刪除一筆登記錯誤的處罰紀錄 */
async function deleteRuleViolation(student, violationId) {
  const list = (student.ruleViolations || []).filter((v) => v.id !== violationId);
  await updateStudent(student.id, { ruleViolations: list });
  return { student: { ...student, ruleViolations: list } };
}

/**
 * 家長端「處罰清單」頁：不用等到週五結算，當場執行完處罰後直接把這筆標記為「已執行」。
 * 標記已執行時，如果這筆還沒被週五結算掃過，會一併設 settled:true，
 * 避免當場已經執行過的處罰又被算進下一次週五的淨值結算裡（重複處罰）。
 * 反向取消標記時，若原本是靠這個動作才變成 settled，會一併還原成未結算，重新排進下次結算。
 */
async function setViolationExecuted(student, violationId, executed) {
  const list = (student.ruleViolations || []).map((v) => {
    if (v.id !== violationId) return v;
    if (executed) {
      return { ...v, executedStatus: "done", settled: true, settledBy: "manualExecute" };
    }
    const revertSettled = v.settledBy === "manualExecute" ? false : v.settled;
    const { settledBy, ...rest } = v;
    return { ...rest, executedStatus: "pending", settled: revertSettled };
  });
  await updateStudent(student.id, { ruleViolations: list });
  return { student: { ...student, ruleViolations: list } };
}

/** 找出「嚴格晚於 afterMs」的下一個週五 18:00 時間戳（毫秒） */
function nextFridaySettlementMs(afterMs) {
  const d = new Date(afterMs);
  d.setHours(RULE_WEEKLY_SETTLEMENT_HOUR, 0, 0, 0);
  if (d.getTime() <= afterMs) d.setDate(d.getDate() + 1);
  while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
  return d.getTime();
}

/** 找出「以 nowMs 這個時間點來看，最近一個已經過了結算時間」的週五 18:00 時間戳（毫秒） */
function mostRecentDueSettlementMs(nowMs) {
  const d = new Date(nowMs);
  const day = d.getDay(); // 0=日...5=五...6=六
  const diffToFriday = (day - 5 + 7) % 7;
  d.setDate(d.getDate() - diffToFriday);
  d.setHours(RULE_WEEKLY_SETTLEMENT_HOUR, 0, 0, 0);
  if (nowMs < d.getTime()) d.setDate(d.getDate() - 7); // 這週五 18:00 還沒到，退回上週五
  return d.getTime();
}

/** 把時間戳格式化成「YYYY-MM-DD HH:MM」顯示用字串 */
function fmtSettlementInstant(ms) {
  const d = new Date(ms);
  return `${localDateStr(d)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** 取得某筆 arrivalLog／ruleViolations 紀錄的精確時間戳；舊資料沒有時間戳時，保守地用當天中午當估計值 */
function entryInstantMs(entry, dateField, msField) {
  if (typeof entry[msField] === "number") return entry[msField];
  return new Date(`${entry[dateField]}T12:00:00`).getTime();
}

/**
 * 計算某個結算區間（startMsExclusive < 時間戳 <= endMs）的淨開合跳數，
 * 並回傳這次要寫回 Firestore 的欄位（不含 lastRuleSettlementMs，由呼叫端統一設定）。
 * startMsExclusive 傳 null 代表「從最早以前」（第一次結算）。
 */
function computeSettlementForPeriod(student, rules, startMsExclusive, endMs) {
  const inPeriod = (ms) => ms > (startMsExclusive === null ? -Infinity : startMsExclusive) && ms <= endMs;
  const ruleById = Object.fromEntries((rules || []).map((r) => [r.id, r]));

  let net = 0;
  Object.values(student.arrivalLog || {}).forEach((entry) => {
    if (!inPeriod(entryInstantMs(entry, "date", "atMs"))) return;
    const rule = ruleById[entry.ruleId];
    if (!rule || rule.type !== "punctuality" || !rule.enabled) return;
    const multiplier = Number(rule.config && rule.config.multiplier) || 10;
    net += entry.deltaMinutes * multiplier;
  });

  const settledViolationIds = [];
  (student.ruleViolations || []).forEach((v) => {
    if (v.settled) return;
    if (!inPeriod(entryInstantMs(v, "loggedAt", "loggedAtMs"))) return;
    net += Number(v.count) || 0;
    settledViolationIds.push(v.id);
  });

  const settlement = {
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()),
    periodStart: startMsExclusive === null ? null : fmtSettlementInstant(startMsExclusive),
    periodEnd: fmtSettlementInstant(endMs),
    // 【2026-08-16】periodStartMs：結算區間的起點時間戳。原本只存顯示用字串，
    // 但「結算記錄」頁要以週為主軸把原始登記歸戶回各自的區間，需要可運算的數值。
    periodStartMs: startMsExclusive,
    periodEndMs: endMs,
    netJumpingJacks: net,
    punishmentCount: net > 0 ? net : 0,
    punishmentStatus: net > 0 ? "pending" : null,
    bonusAmount: net < 0 ? Math.floor(-net / 10) : 0,
    // 【2026-08-16】bonusStatus：獎金是否已實際發放給孩子。純粹是家長端的備忘標記，
    // 不影響 ruleBonusTotal——獎金在結算當下就已入帳，孩子的總獎金／XP／許願池進度
    // 不會因為家長還沒按這個按鈕而延後。
    bonusStatus: net < 0 && Math.floor(-net / 10) > 0 ? "pending" : null,
    // 【2026-08-16】settledViolationIds：這次結算實際捲進淨值的單筆登記 id。
    // 有了它，週卡片展開明細時就能精準列出「這一週算了哪幾筆」，而不必靠時間戳推算
    // （推算會把「當場執行、未計入淨值」的那幾筆也一起算進來）。
    settledViolationIds: [...settledViolationIds],
    computedAt: localDateStr(new Date()),
  };
  return { settlement, settledViolationIds };
}

/**
 * 開啟 App（孩子或家長模式）時呼叫：檢查是否有錯過的週五 18:00 結算，有就自動補算並寫回 Firestore。
 * 支援一次補算多個錯過的週次（例如整週都沒開 App）。18:00 之後才登記的處罰一律併到下週五才結算。
 * 回傳 { student, newSettlements }，newSettlements 為這次新產生的結算結果陣列，供畫面顯示 toast 用。
 */
async function runWeeklySettlementIfDue(student) {
  const rules = normalizeRules(student.rules);
  if (!rules.length) return { student, newSettlements: [] };

  const dueMs = mostRecentDueSettlementMs(Date.now());
  const cursorMs = typeof student.lastRuleSettlementMs === "number" ? student.lastRuleSettlementMs : null;

  // 第一次結算：從最早以前的資料開始，一次結到「最近一個已過期的週五 18:00」；
  // 18:00 之後才登記的（就算跟 dueMs 同一天）時間戳會晚於 dueMs，不會被算進去，會留到下週五。
  if (cursorMs === null) {
    const { settlement, settledViolationIds } = computeSettlementForPeriod(student, rules, null, dueMs);
    return applySettlements(student, [settlement], settledViolationIds, dueMs);
  }
  if (cursorMs >= dueMs) return { student, newSettlements: [] };

  const settlements = [];
  const allSettledIds = [];
  let periodStartMs = cursorMs;
  let guard = 0;
  while (periodStartMs < dueMs && guard < 12) {
    const periodEndMs = Math.min(nextFridaySettlementMs(periodStartMs), dueMs);
    const { settlement, settledViolationIds } = computeSettlementForPeriod(student, rules, periodStartMs, periodEndMs);
    settlements.push(settlement);
    allSettledIds.push(...settledViolationIds);
    periodStartMs = periodEndMs;
    guard++;
  }
  return applySettlements(student, settlements, allSettledIds, dueMs);
}

async function applySettlements(student, settlements, settledViolationIds, newCursorMs) {
  const meaningful = settlements.filter((s) => s.netJumpingJacks !== 0);
  const ruleSettlements = [...(student.ruleSettlements || []), ...meaningful];
  const settledSet = new Set(settledViolationIds);
  const ruleViolations = (student.ruleViolations || []).map((v) =>
    settledSet.has(v.id) ? { ...v, settled: true } : v
  );
  const addedBonus = meaningful.reduce((a, s) => a + (s.bonusAmount || 0), 0);
  const ruleBonusTotal = (Number(student.ruleBonusTotal) || 0) + addedBonus;

  const fields = { ruleSettlements, ruleViolations, ruleBonusTotal, lastRuleSettlementMs: newCursorMs };
  await updateStudent(student.id, fields);
  return { student: { ...student, ...fields }, newSettlements: meaningful };
}

/**
 * 家長端「手動提前結算本週」：不用等到週五，用「現在」這個精確時刻當截止點立刻結算目前累積的淨值。
 * 結算完之後，下一次自動結算會重新對齊到下一個真正的週五（見 nextFridaySettlementMs）。
 */
async function forceSettleNow(student) {
  const rules = normalizeRules(student.rules);
  if (!rules.length) return { student, newSettlement: null };
  const cursorMs = typeof student.lastRuleSettlementMs === "number" ? student.lastRuleSettlementMs : null;
  const nowMs = Date.now();
  if (cursorMs !== null && cursorMs >= nowMs) return { student, newSettlement: null };
  const { settlement, settledViolationIds } = computeSettlementForPeriod(student, rules, cursorMs, nowMs);
  const result = await applySettlements(student, [settlement], settledViolationIds, nowMs);
  return { student: result.student, newSettlement: settlement.netJumpingJacks !== 0 ? settlement : null };
}

/**
 * 家長端：切換某筆結算的處罰執行狀態。
 * 【2026-08-16】改成可雙向切換（原本只能標記成已執行、不能反悔），
 * 跟單筆登記的 setViolationExecuted() 對稱——按錯的機會不小，不該只有單行道。
 */
async function markRulePunishmentDone(student, settlementId, done = true) {
  const ruleSettlements = (student.ruleSettlements || []).map((s) =>
    s.id === settlementId ? { ...s, punishmentStatus: done ? "done" : "pending" } : s
  );
  await updateStudent(student.id, { ruleSettlements });
  return { student: { ...student, ruleSettlements } };
}

/**
 * 【2026-08-16】家長端：切換某筆結算的「獎金已發放」標記。
 * 注意這只是備忘用途——獎金早在結算當下就已累加進 ruleBonusTotal，
 * 孩子看到的總獎金／XP／許願池進度都不受這個狀態影響。
 */
async function markRuleBonusPaid(student, settlementId, paid = true) {
  const ruleSettlements = (student.ruleSettlements || []).map((s) =>
    s.id === settlementId ? { ...s, bonusStatus: paid ? "done" : "pending" } : s
  );
  await updateStudent(student.id, { ruleSettlements });
  return { student: { ...student, ruleSettlements } };
}

/**
 * 【2026-08-04】家長端：修改某筆「週結算」紀錄的數字（登記錯誤或想手動調整時用）。
 * 處罰型結算只給改 punishmentCount（同時同步 netJumpingJacks，維持兩者一致，
 * 畫面上判斷「是處罰還是獎金」用的就是 netJumpingJacks > 0）；
 * 獎金型結算只給改 bonusAmount，不動 netJumpingJacks（負值、獎金分支不受影響）。
 */
async function updateRuleSettlement(student, settlementId, fields) {
  const ruleSettlements = (student.ruleSettlements || []).map((s) => {
    if (s.id !== settlementId) return s;
    const next = { ...s, ...fields };
    if (typeof fields.punishmentCount === "number") {
      next.punishmentCount = fields.punishmentCount;
      next.netJumpingJacks = fields.punishmentCount;
    }
    return next;
  });
  await updateStudent(student.id, { ruleSettlements });
  return { student: { ...student, ruleSettlements } };
}

/** 家長端：刪除某筆「週結算」紀錄（例如登記錯誤，整筆不該存在） */
async function deleteRuleSettlement(student, settlementId) {
  const ruleSettlements = (student.ruleSettlements || []).filter((s) => s.id !== settlementId);
  await updateStudent(student.id, { ruleSettlements });
  return { student: { ...student, ruleSettlements } };
}

/**
 * 本週（尚未結算，從 lastRuleSettlementMs 之後到現在）即時進度，供孩子模式規矩頁顯示，
 * 不會寫入 Firestore，純粹即時運算。回傳每條規矩的分項統計＋合併淨開合跳數。
 */
function computeLiveWeekProgress(student, rules) {
  const startMsExclusive = typeof student.lastRuleSettlementMs === "number" ? student.lastRuleSettlementMs : null;
  const nowMs = Date.now();
  const inPeriod = (ms) => ms > (startMsExclusive === null ? -Infinity : startMsExclusive) && ms <= nowMs;

  const perRule = {};
  (rules || []).forEach((r) => {
    perRule[r.id] = { ruleId: r.id, lateMinutes: 0, earlyMinutes: 0, violationCount: 0, jumpingJacks: 0 };
  });

  Object.values(student.arrivalLog || {}).forEach((entry) => {
    if (!inPeriod(entryInstantMs(entry, "date", "atMs"))) return;
    const stat = perRule[entry.ruleId];
    if (!stat) return;
    if (entry.deltaMinutes > 0) stat.lateMinutes += entry.deltaMinutes;
    else stat.earlyMinutes += -entry.deltaMinutes;
  });
  (student.ruleViolations || []).forEach((v) => {
    if (v.settled || !inPeriod(entryInstantMs(v, "loggedAt", "loggedAtMs"))) return;
    if (!v.ruleId || !perRule[v.ruleId]) return;
    perRule[v.ruleId].violationCount += Number(v.count) || 0;
  });

  let netJumpingJacks = 0;
  (rules || []).forEach((r) => {
    const stat = perRule[r.id];
    if (r.type === "punctuality") {
      const multiplier = Number(r.config && r.config.multiplier) || 10;
      stat.jumpingJacks = (stat.lateMinutes - stat.earlyMinutes) * multiplier;
    } else {
      stat.jumpingJacks = stat.violationCount;
    }
    netJumpingJacks += stat.jumpingJacks;
  });
  // 不歸屬任何規矩的雜項登記，也算進淨值
  (student.ruleViolations || []).forEach((v) => {
    if (v.settled || v.ruleId || !inPeriod(entryInstantMs(v, "loggedAt", "loggedAtMs"))) return;
    netJumpingJacks += Number(v.count) || 0;
  });

  return { perRule, netJumpingJacks };
}

/** 列出某學生「尚未結算」的處罰登記（不分規矩），供家長端管理頁顯示／編輯／刪除用，新到舊排序 */
function unsettledViolationsOf(student) {
  return (student.ruleViolations || [])
    .filter((v) => !v.settled)
    .slice()
    .sort((a, b) => entryInstantMs(b, "loggedAt", "loggedAtMs") - entryInstantMs(a, "loggedAt", "loggedAtMs"));
}

/** 列出某學生「全部」處罰登記（含已結算／未結算），供「結算記錄」頁顯示，新到舊排序 */
function allViolationsOf(student) {
  return (student.ruleViolations || [])
    .slice()
    .sort((a, b) => entryInstantMs(b, "loggedAt", "loggedAtMs") - entryInstantMs(a, "loggedAt", "loggedAtMs"));
}


// ------------------------------------------------------------------
// 【2026-08-16 結算記錄頁改版】以「週」為主軸的查詢工具
//
// 歸戶方式有兩層 fallback：
//   1. settledViolationIds（2026-08-16 以後產生的結算才有）→ 精準對號入座
//   2. 時間戳落在 (periodStartMs, periodEndMs] 區間 → 給舊資料用的推算
// 推算會把「被家長當場標記已執行、因此沒有計入淨值」的登記也一起撈進來，
// 所以每一筆明細都會標示 countedInNet，避免使用者納悶「明細加起來怎麼跟淨值對不上」。
// ------------------------------------------------------------------

/** 結算週期的起訖時間戳；舊資料沒有 periodStartMs 時，用前一筆結算的 periodEndMs 補 */
function settlementRangeMs(settlement, prevSettlement) {
  const endMs = typeof settlement.periodEndMs === "number" ? settlement.periodEndMs : null;
  let startMs = typeof settlement.periodStartMs === "number" ? settlement.periodStartMs : null;
  if (startMs === null && prevSettlement && typeof prevSettlement.periodEndMs === "number") {
    startMs = prevSettlement.periodEndMs;
  }
  return { startMs, endMs };
}

/** 取得某筆結算涵蓋的所有原始明細，統一格式方便畫面直接渲染，舊到新排序 */
function settlementDetailsOf(student, settlement, prevSettlement, rules) {
  const ruleList = normalizeRules(rules || student.rules);
  const ruleById = Object.fromEntries(ruleList.map((r) => [r.id, r]));
  const { startMs, endMs } = settlementRangeMs(settlement, prevSettlement);
  const inPeriod = (ms) =>
    endMs === null ? false : ms > (startMs === null ? -Infinity : startMs) && ms <= endMs;

  const rows = [];
  Object.values(student.arrivalLog || {}).forEach((entry) => {
    const ms = entryInstantMs(entry, "date", "atMs");
    if (!inPeriod(ms)) return;
    const rule = ruleById[entry.ruleId];
    if (!rule || rule.type !== "punctuality") return;
    const multiplier = Number(rule.config && rule.config.multiplier) || 10;
    const delta = Number(entry.deltaMinutes) || 0;
    rows.push({
      kind: "arrival",
      label: rule.name,
      detail:
        delta > 0
          ? `${entry.date} ${entry.time}　遲到 ${delta} 分`
          : delta < 0
          ? `${entry.date} ${entry.time}　提早 ${-delta} 分`
          : `${entry.date} ${entry.time}　準時`,
      jumpingJacks: delta * multiplier,
      countedInNet: rule.enabled !== false,
      ms,
      raw: entry,
    });
  });

  const idSet = Array.isArray(settlement.settledViolationIds)
    ? new Set(settlement.settledViolationIds)
    : null;
  (student.ruleViolations || []).forEach((v) => {
    const ms = entryInstantMs(v, "loggedAt", "loggedAtMs");
    const byId = idSet ? idSet.has(v.id) : false;
    const byTime = idSet ? false : inPeriod(ms);
    const extraByTime = idSet && !byId && inPeriod(ms);
    if (!byId && !byTime && !extraByTime) return;
    rows.push({
      kind: "violation",
      label: v.ruleId ? (ruleById[v.ruleId] ? ruleById[v.ruleId].name : "（規矩已刪除）") : "臨時登記",
      detail: `${v.loggedAt}　${v.reason || "（無原因）"}`,
      jumpingJacks: Number(v.count) || 0,
      countedInNet: idSet ? byId : v.settledBy !== "manualExecute",
      ms,
      raw: v,
    });
  });

  return rows.sort((a, b) => a.ms - b.ms);
}

/** 把結算紀錄整理成「新到舊」的週卡片資料，並附上每張卡片的明細 */
function settlementWeeksOf(student, rules) {
  const list = [...(student.ruleSettlements || [])].sort(
    (a, b) => (a.periodEndMs || 0) - (b.periodEndMs || 0)
  );
  const weeks = list.map((s, i) => {
    const prev = i > 0 ? list[i - 1] : null;
    const { startMs, endMs } = settlementRangeMs(s, prev);
    return { settlement: s, details: settlementDetailsOf(student, s, prev, rules), startMs, endMs };
  });
  return weeks.reverse();
}

/** 這位學生「需要家長處理」的事項：未執行的結算處罰、未發放的結算獎金、未執行的單筆登記 */
function pendingActionsOf(student) {
  const out = [];
  (student.ruleSettlements || []).forEach((s) => {
    if (s.netJumpingJacks > 0 && s.punishmentStatus !== "done") {
      out.push({ type: "punishment", id: s.id, amount: s.punishmentCount,
        title: `待執行 ${s.punishmentCount} 下${RULE_UNIT_LABEL}`, sub: `${s.periodEnd} 結算`,
        studentId: student.id, studentName: student.name });
    }
    if ((s.bonusAmount || 0) > 0 && s.bonusStatus !== "done") {
      out.push({ type: "bonus", id: s.id, amount: s.bonusAmount,
        title: `待發放 NT$${(s.bonusAmount || 0).toLocaleString()}`, sub: `${s.periodEnd} 結算`,
        studentId: student.id, studentName: student.name });
    }
  });
  (student.ruleViolations || []).forEach((v) => {
    if (v.executedStatus === "done") return;
    // 已被週結算捲進去的登記，處罰責任已轉移到那筆結算上，再列一次會變成要求家長做兩遍
    if (v.settled) return;
    out.push({ type: "violation", id: v.id, amount: Number(v.count) || 0,
      title: `待執行 ${v.count} 下${RULE_UNIT_LABEL}`,
      sub: `${v.loggedAt} 單筆登記${v.reason ? "・" + v.reason : ""}`,
      studentId: student.id, studentName: student.name });
  });
  return out;
}

/** 孩子模式用：這位學生總共還有幾下開合跳沒執行完（結算處罰 ＋ 單筆登記，不重複計算） */
function pendingPunishmentTotalOf(student) {
  let total = 0;
  (student.ruleSettlements || []).forEach((s) => {
    if (s.netJumpingJacks > 0 && s.punishmentStatus !== "done") total += Number(s.punishmentCount) || 0;
  });
  (student.ruleViolations || []).forEach((v) => {
    if (v.settled || v.executedStatus === "done") return;
    total += Number(v.count) || 0;
  });
  return total;
}

/**
 * [2026-08-17] Kid mode: total rule bonus not yet handed out.
 * Same rule as the bonus branch of pendingActionsOf (bonusStatus !== "done"),
 * so settlements created before this feature (no bonusStatus field) count as unpaid
 * until the parent ticks them off on the settlement page.
 */
function pendingBonusTotalOf(student) {
  let total = 0;
  (student.ruleSettlements || []).forEach((s) => {
    if ((s.bonusAmount || 0) > 0 && s.bonusStatus !== "done") total += Number(s.bonusAmount) || 0;
  });
  return total;
}
