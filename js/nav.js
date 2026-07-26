/* nav.js — 側邊欄「學生」清單渲染（共用於各頁） */
function renderStudentNav(students, activeStudentId) {
  const el = document.getElementById("studentNavLinks");
  if (!el) return;
  if (!students.length) {
    el.innerHTML = '<div class="text-faint" style="padding:8px 12px;font-size:12px;">尚未新增學生，請至「獎懲規則設定」新增</div>';
    return;
  }
  el.innerHTML = students
    .map((s) => {
      const active = s.id === activeStudentId ? "active" : "";
      const initial = (s.name || "?").slice(0, 1);
      return `<a href="student.html?id=${s.id}" class="nav-link ${active}">
        <span style="width:18px;height:18px;border-radius:50%;background:${s.color || "#4f7cff"};display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#08122e;">${initial}</span>
        ${escapeHtml(s.name)}
      </a>`;
    })
    .join("");
}

function escapeHtml(str) {
  const d = document.createElement("div");
  d.textContent = str == null ? "" : String(str);
  return d.innerHTML;
}

function fmtMoney(n) {
  return "NT$" + Math.round(n || 0).toLocaleString("zh-Hant-TW");
}
