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

async function listExamRecords(studentId) {
  let q = db.collection("examRecords").orderBy("date", "desc");
  if (studentId) q = db.collection("examRecords").where("studentId", "==", studentId);
  const snap = await q.get();
  const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  // studentId 篩選時 Firestore 需另外排序（避免複合索引需求）
  rows.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
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
