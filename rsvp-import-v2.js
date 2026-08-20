const RSVP_WORKSPACE_KEY = "event-report-workspace-v1";

const rsvpNorm = v => String(v ?? "").trim().toLowerCase().replace(/[\s_\-\/()：:]/g, "");
const rsvpYes = v => ["v", "yes", "y", "true", "1", "是", "有", "已出席", "attended", "checkedin"].includes(rsvpNorm(v));
const rsvpWalkIn = v => /walk\s*-?\s*in|現場報名/i.test(String(v ?? ""));

const HEADER_ALIASES = {
  notes: ["備註", "remark", "remarks", "note", "notes"],
  attended: ["出席", "出席狀況", "attendance", "attended", "checkin", "checkedin"],
  survey: ["問卷", "survey"],
  code: ["編號", "no", "number", "id"],
  mco: ["mco"],
  type: ["type", "類別", "category", "attendeetype"],
  name: ["姓名", "name", "fullname", "attendeename"],
  company: ["中文公司名稱", "公司", "company", "companyname"],
  title: ["中文職稱", "職稱", "title", "jobtitle"],
  department: ["部門別", "部門", "department"],
  jobLevel: ["職位別", "職位", "joblevel", "seniority"],
  decisionRole: ["決策角色", "decisionrole", "role"],
  email: ["電子信箱", "電子郵件", "email", "mail"],
  companyPhone: ["公司電話", "officephone", "companyphone"],
  extension: ["分機", "ext", "extension"],
  phone: ["行動電話", "手機", "mobile", "phone"],
  registrationSource: ["報名資訊來源", "registrationsource", "invitesource"],
  consentContact: ["同意連絡", "同意聯絡"],
  consentPrivacy: ["同意使用個資", "個資同意"],
  submittedAt: ["填寫時間", "submittedat", "timestamp"],
  reserved: ["保留欄位"],
  source: ["來源", "source"],
  confirmPhone: ["確認電話"]
};

function canonicalHeader(value) {
  const n = rsvpNorm(value);
  for (const [key, aliases] of Object.entries(HEADER_ALIASES)) {
    if (aliases.some(a => rsvpNorm(a) === n)) return key;
  }
  return null;
}

function detectHeaderRow(matrix) {
  let best = { index: -1, score: 0 };
  const max = Math.min(matrix.length, 15);
  for (let i = 0; i < max; i++) {
    const row = matrix[i] || [];
    const recognized = row.map(canonicalHeader).filter(Boolean);
    const mustHave = recognized.includes("name") && (recognized.includes("type") || recognized.includes("code") || recognized.includes("company"));
    const score = recognized.length + (mustHave ? 10 : 0);
    if (score > best.score) best = { index: i, score };
  }
  return best.score >= 12 ? best.index : -1;
}

function sheetToAttendees(sheetName, wsSheet) {
  const matrix = XLSX.utils.sheet_to_json(wsSheet, { header: 1, defval: "", raw: false });
  const headerIndex = detectHeaderRow(matrix);
  if (headerIndex < 0) return [];

  const headers = matrix[headerIndex].map(canonicalHeader);
  const results = [];
  for (let r = headerIndex + 1; r < matrix.length; r++) {
    const sourceRow = matrix[r] || [];
    const item = {};
    headers.forEach((key, c) => { if (key) item[key] = sourceRow[c] ?? ""; });

    const name = String(item.name || "").trim();
    const code = String(item.code || "").trim();
    const email = String(item.email || "").trim();
    if (!name && !code && !email) continue;

    const notes = String(item.notes || "").trim();
    const inferredType = String(item.type || sheetName || "").trim();
    const walkedIn = rsvpWalkIn(notes);

    results.push({
      id: code || `${String(sheetName).toLowerCase()}-${r + 1}-${Date.now().toString(36)}`,
      code,
      type: inferredType,
      name,
      company: String(item.company || "").trim(),
      title: String(item.title || "").trim(),
      department: String(item.department || "").trim(),
      jobLevel: String(item.jobLevel || "").trim(),
      decisionRole: String(item.decisionRole || "").trim(),
      email,
      companyPhone: String(item.companyPhone || "").trim(),
      extension: String(item.extension || "").trim(),
      phone: String(item.phone || "").trim(),
      registrationSource: String(item.registrationSource || "").trim(),
      source: String(item.source || "").trim(),
      notes,
      mco: String(item.mco || "").trim(),
      consentContact: String(item.consentContact || "").trim(),
      consentPrivacy: String(item.consentPrivacy || "").trim(),
      submittedAt: String(item.submittedAt || "").trim(),
      reserved: String(item.reserved || "").trim(),
      confirmPhone: String(item.confirmPhone || "").trim(),
      attended: rsvpYes(item.attended) || walkedIn,
      walkin: walkedIn,
      survey: rsvpYes(item.survey),
      importSheet: sheetName
    });
  }
  return results;
}

function dedupeAttendees(rows) {
  const map = new Map();
  for (const row of rows) {
    const key = row.code || (row.email ? `email:${row.email.toLowerCase()}` : `${row.type}:${row.name}:${row.company}`.toLowerCase());
    if (!key || key === "::") continue;
    if (!map.has(key)) map.set(key, row);
    else {
      const old = map.get(key);
      map.set(key, { ...old, ...row, attended: old.attended || row.attended, walkin: old.walkin || row.walkin, survey: old.survey || row.survey });
    }
  }
  return [...map.values()];
}

function saveImportedAttendees(attendees) {
  let workspace;
  try { workspace = JSON.parse(localStorage.getItem(RSVP_WORKSPACE_KEY) || "null"); } catch { workspace = null; }
  if (!workspace?.activeId) throw new Error("目前沒有開啟中的專案");
  const project = (workspace.projects || []).find(p => p.id === workspace.activeId);
  if (!project) throw new Error("找不到目前專案");
  project.attendees = attendees;
  localStorage.setItem(RSVP_WORKSPACE_KEY, JSON.stringify(workspace));
}

function refreshRsvpView() {
  const activeRsvp = [...document.querySelectorAll('.nav-item[data-view="rsvp"]')].find(x => x.classList.contains("active")) || document.querySelector('.nav-item[data-view="rsvp"]');
  if (activeRsvp && typeof activeRsvp.onclick === "function") activeRsvp.onclick();
}

async function importRsvpWorkbook(file) {
  const data = await file.arrayBuffer();
  const book = XLSX.read(data, { type: "array" });
  const all = [];
  for (const sheetName of book.SheetNames) {
    all.push(...sheetToAttendees(sheetName, book.Sheets[sheetName]));
  }
  const attendees = dedupeAttendees(all);
  if (!attendees.length) throw new Error("找不到可匯入的 RSVP 名單，請確認檔案中有「姓名／Type／編號」等欄位。");
  saveImportedAttendees(attendees);
  refreshRsvpView();
  const byType = attendees.reduce((acc, x) => { const k = x.type || "Other"; acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const attended = attendees.filter(x => x.attended).length;
  const walkins = attendees.filter(x => x.walkin).length;
  const detail = Object.entries(byType).map(([k,v]) => `${k} ${v}`).join(" / ");
  alert(`RSVP 匯入完成：${attendees.length} 人\n${detail}\n已出席 ${attended} 人，其中 Walk-in ${walkins} 人`);
}

document.addEventListener("change", async event => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.type !== "file" || !input.files?.length) return;
  const file = input.files[0];
  const lower = file.name.toLowerCase();
  if (!/\.(xlsx|xls|csv)$/.test(lower)) return;
  const rsvpPage = document.querySelector('.nav-item[data-view="rsvp"].active');
  if (!rsvpPage) return;

  event.preventDefault();
  event.stopImmediatePropagation();
  try {
    await importRsvpWorkbook(file);
  } catch (e) {
    console.error("RSVP import failed", e);
    alert(`RSVP 匯入失敗：${e.message}`);
  } finally {
    input.value = "";
  }
}, true);
