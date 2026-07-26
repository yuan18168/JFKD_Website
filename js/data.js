/*
  data.js — Firestore 資料存取共用函式
  Collections:
    config/rules        單一文件，獎懲規則設定
    students/{id}        { name, color, order }
    examRecords/{id}      { studentId, semester, examType, date, subjects:[{name,score,prevScore}],
                             manualOverrideTotal (可選), note, createdAt, createdBy }
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
