
const STORAGE_KEY = "post-event-report-system-v1";

const defaultProject = {
  info: {
    eventName: "",
    client: "",
    eventDate: "",
    startTime: "",
    endTime: "",
    receptionTime: "",
    venue: "",
    room: "",
    eventType: "",
    expectedAttendance: "",
    objective: "",
    targetAudience: "",
    strategy: "",
    alliancePartner: "",
    projectOwner: ""
  },
  visual: {
    kvName: "",
    kvDataUrl: "",
    eventLogo: "",
    primaryColor: "#ff7a1a",
    secondaryColor: "#20252b",
    notes: ""
  },
  agenda: [],
  speakers: [],
  rsvp: {
    registrations: "",
    attendees: "",
    customersRegistered: "",
    customersAttended: "",
    partnersRegistered: "",
    partnersAttended: "",
    walkins: "",
    surveyCollected: ""
  },
  assets: {
    photosCount: 0,
    collateralsCount: 0,
    giveawayCount: 0,
    mediaEnabled: false
  },
  survey: {
    uploaded: false,
    fileName: "",
    notes: ""
  },
  recap: {
    highlights: "",
    lowlights: "",
    issues: "",
    solutions: "",
    recommendations: "",
    clientFeedback: ""
  }
};

let project = loadProject();
let currentView = "overview";

const root = document.querySelector("#viewRoot");
const projectTitle = document.querySelector("#projectTitle");
const projectMeta = document.querySelector("#projectMeta");
const saveState = document.querySelector("#saveState");

function deepClone(obj){ return JSON.parse(JSON.stringify(obj)); }

function loadProject(){
  const raw = localStorage.getItem(STORAGE_KEY);
  if(!raw) return deepClone(defaultProject);
  try {
    return {...deepClone(defaultProject), ...JSON.parse(raw)};
  } catch {
    return deepClone(defaultProject);
  }
}

function saveProject(){
  saveState.textContent = "Saving...";
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  window.setTimeout(() => saveState.textContent = "Saved locally", 250);
  refreshHeader();
}

function refreshHeader(){
  projectTitle.textContent = project.info.eventName || "Untitled Event";
  const meta = [project.info.eventDate, project.info.venue, project.info.room].filter(Boolean).join(" · ");
  projectMeta.textContent = meta || "尚未設定活動日期與場地";
  document.documentElement.style.setProperty("--accent", project.visual.primaryColor || "#ff7a1a");
  document.documentElement.style.setProperty("--dark", project.visual.secondaryColor || "#20252b");
}

function setView(view){
  currentView = view;
  document.querySelectorAll(".nav-item").forEach(btn => btn.classList.toggle("active", btn.dataset.view === view));
  renderView();
}

document.querySelectorAll(".nav-item").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.view)));
document.querySelectorAll("[data-jump]").forEach(btn => btn.addEventListener("click", () => setView(btn.dataset.jump)));

document.querySelector("#newProjectBtn").addEventListener("click", () => {
  if(confirm("建立新專案會清除目前瀏覽器中的示範資料，確定繼續嗎？")){
    project = deepClone(defaultProject);
    saveProject();
    setView("event-info");
  }
});

function completeness(){
  const checks = [
    !!project.info.eventName,
    !!project.info.eventDate,
    !!project.info.venue,
    !!project.visual.kvName || !!project.visual.kvDataUrl,
    project.agenda.length > 0,
    project.speakers.length > 0,
    !!project.rsvp.registrations,
    project.assets.photosCount > 0,
    project.assets.collateralsCount > 0,
    project.assets.giveawayCount > 0,
    project.survey.uploaded,
    !!project.recap.highlights || !!project.recap.lowlights
  ];
  return Math.round(checks.filter(Boolean).length / checks.length * 100);
}

function readiness(){
  return [
    ["Event Info","event-info", !!project.info.eventName && !!project.info.eventDate && !!project.info.venue, "活動基本資訊"],
    ["Event KV","visual", !!project.visual.kvName || !!project.visual.kvDataUrl, "每場活動獨立主視覺"],
    ["Agenda","agenda", project.agenda.length > 0, "議程資料"],
    ["Speakers","speakers", project.speakers.length > 0, "講師姓名 / Title / 公司"],
    ["RSVP / Attendance","rsvp", !!project.rsvp.registrations, "報名與實際出席"],
    ["Event Photos","photos", project.assets.photosCount > 0, "活動精選照片"],
    ["Collaterals","collaterals", project.assets.collateralsCount > 0, "設計稿與現場實拍"],
    ["Giveaway","giveaway", project.assets.giveawayCount > 0, "禮品資料與實拍"],
    ["Survey","survey", project.survey.uploaded, "問卷原始資料"],
    ["Recap","recap", !!project.recap.highlights || !!project.recap.lowlights, "Highlight / Lowlight"],
    ["Report","report", completeness() >= 70, "產生結案報告"]
  ];
}

function renderView(){
  refreshHeader();
  if(currentView === "overview") return renderOverview();
  if(currentView === "event-info") return renderEventInfo();
  if(currentView === "visual") return renderVisual();
  if(currentView === "agenda") return renderAgenda();
  if(currentView === "speakers") return renderSpeakers();
  if(currentView === "rsvp") return renderRsvp();
  if(currentView === "photos") return renderAssetCounter("Event Photos","活動後上傳精選照片；之後可加入分類與 Featured。","photosCount");
  if(currentView === "collaterals") return renderAssetCounter("Collaterals","每一項製作物保存 Design Preview 與 Actual Photo。","collateralsCount");
  if(currentView === "giveaway") return renderAssetCounter("Giveaway","禮品資料、對象、數量與實拍照片。","giveawayCount");
  if(currentView === "media") return renderMedia();
  if(currentView === "survey") return renderSurvey();
  if(currentView === "recap") return renderRecap();
  if(currentView === "report") return renderReport();
}

function formShell(title, desc, eyebrow="PROJECT DATA"){
  const t = document.querySelector("#formTemplate").content.cloneNode(true);
  t.querySelector("#formEyebrow").textContent = eyebrow;
  t.querySelector("#formTitle").textContent = title;
  t.querySelector("#formDesc").textContent = desc;
  root.replaceChildren(t);
  return root.querySelector("#formContent");
}

function renderOverview(){
  const t = document.querySelector("#overviewTemplate").content.cloneNode(true);
  root.replaceChildren(t);
  document.querySelector("#completionPercent").textContent = completeness() + "%";
  const grid = document.querySelector("#readinessGrid");
  readiness().forEach(([name, view, done, desc]) => {
    const card = document.createElement("button");
    card.className = "readiness-card";
    card.style.textAlign = "left";
    card.style.cursor = "pointer";
    card.innerHTML = `
      <div>
        <div class="status-pill ${done ? "done":"pending"}">${done ? "READY":"PENDING"}</div>
      </div>
      <div>
        <h4>${name}</h4>
        <p>${desc}</p>
      </div>`;
    card.addEventListener("click", () => setView(view));
    grid.appendChild(card);
  });
}

function inputField(label, key, value, type="text", full=false){
  const div = document.createElement("div");
  div.className = "field" + (full ? " full" : "");
  div.innerHTML = `<label>${label}</label>`;
  const el = type === "textarea" ? document.createElement("textarea") : document.createElement("input");
  if(type !== "textarea") el.type = type;
  el.value = value ?? "";
  el.addEventListener("input", e => {
    project.info[key] = e.target.value;
    saveProject();
  });
  div.appendChild(el);
  return div;
}

function renderEventInfo(){
  const c = formShell("Event Info","活動前建立一次，Post Report 直接沿用。");
  const card = document.createElement("div");
  card.className = "card form-grid";
  [
    ["Event Name","eventName","text"], ["Client","client","text"],
    ["Event Date","eventDate","date"], ["Event Type","eventType","text"],
    ["Start Time","startTime","time"], ["End Time","endTime","time"],
    ["Reception Time","receptionTime","time"], ["Expected Attendance","expectedAttendance","number"],
    ["Venue","venue","text"], ["Room","room","text"],
    ["Project Owner","projectOwner","text"], ["Alliance Partner","alliancePartner","text"]
  ].forEach(([l,k,t]) => card.appendChild(inputField(l,k,project.info[k],t)));
  [["Event Objective","objective"],["Target Audience","targetAudience"],["Strategy / Theme","strategy"]].forEach(([l,k]) => card.appendChild(inputField(l,k,project.info[k],"textarea",true)));
  c.appendChild(card);
}

function renderVisual(){
  const c = formShell("Event Visual Identity / KV","KV 是每場活動自己的，不與品牌模板綁死。","VISUAL IDENTITY");
  const grid = document.createElement("div");
  grid.className = "form-grid";

  const upload = document.createElement("div");
  upload.className = "card";
  upload.innerHTML = `
    <div class="card-title-row"><h3>Main KV</h3></div>
    <div class="kv-preview" id="kvPreview">
      ${project.visual.kvDataUrl ? `<img src="${project.visual.kvDataUrl}" alt="">` : `<div class="kv-placeholder">上傳活動主視覺<br><small>建議 16:9 或高解析橫式 KV</small></div>`}
    </div>
    <div class="upload-box" style="margin-top:12px">
      <input id="kvUpload" type="file" accept="image/*">
    </div>`;
  grid.appendChild(upload);

  const settings = document.createElement("div");
  settings.className = "card form-grid";
  settings.innerHTML = `
    <div class="field full"><label>KV Name</label><input id="kvName" value="${project.visual.kvName || ""}"></div>
    <div class="field"><label>Primary Color</label><input id="primaryColor" type="color" value="${project.visual.primaryColor || "#ff7a1a"}"></div>
    <div class="field"><label>Secondary Color</label><input id="secondaryColor" type="color" value="${project.visual.secondaryColor || "#20252b"}"></div>
    <div class="field full"><label>Event Logo / Lockup</label><input id="eventLogo" value="${project.visual.eventLogo || ""}" placeholder="先存名稱；之後接 Storage"></div>
    <div class="field full"><label>Visual Notes</label><textarea id="visualNotes">${project.visual.notes || ""}</textarea></div>`;
  grid.appendChild(settings);
  c.appendChild(grid);

  document.querySelector("#kvUpload").addEventListener("change", e => {
    const file = e.target.files[0];
    if(!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      project.visual.kvName = file.name;
      project.visual.kvDataUrl = reader.result;
      saveProject();
      renderVisual();
    };
    reader.readAsDataURL(file);
  });
  ["kvName","eventLogo","visualNotes"].forEach(id => document.querySelector("#"+id).addEventListener("input", e => {
    const map = {kvName:"kvName",eventLogo:"eventLogo",visualNotes:"notes"};
    project.visual[map[id]] = e.target.value; saveProject();
  }));
  ["primaryColor","secondaryColor"].forEach(id => document.querySelector("#"+id).addEventListener("input", e => {
    project.visual[id] = e.target.value; saveProject();
  }));
}

function renderAgenda(){
  const c = formShell("Agenda","Agenda 保留活動前 planning 資料，結案時可沿用實際議程。");
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="card-title-row"><h3>Agenda Items</h3><button id="addAgenda" class="button primary small">+ Add Agenda</button></div><div id="agendaRows" class="stack"></div>`;
  c.appendChild(card);

  const rows = document.querySelector("#agendaRows");
  if(!project.agenda.length) rows.innerHTML = `<div class="empty">尚未建立議程</div>`;
  project.agenda.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "repeater-row";
    row.innerHTML = `
      <input type="time" value="${item.time || ""}" data-k="time">
      <input value="${item.topic || ""}" placeholder="Topic" data-k="topic">
      <input value="${item.speaker || ""}" placeholder="Speaker" data-k="speaker">
      <button class="button small danger">Delete</button>`;
    row.querySelectorAll("input").forEach(inp => inp.addEventListener("input", e => {
      project.agenda[idx][e.target.dataset.k] = e.target.value; saveProject();
    }));
    row.querySelector("button").addEventListener("click", () => { project.agenda.splice(idx,1); saveProject(); renderAgenda(); });
    rows.appendChild(row);
  });
  document.querySelector("#addAgenda").addEventListener("click", () => { project.agenda.push({time:"",topic:"",speaker:""}); saveProject(); renderAgenda(); });
}

function renderSpeakers(){
  const c = formShell("Speakers","Speaker 是獨立資料，Agenda 與 Report 共用。");
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `<div class="card-title-row"><h3>Speaker Library</h3><button id="addSpeaker" class="button primary small">+ Add Speaker</button></div><div id="speakerRows" class="stack"></div>`;
  c.appendChild(card);

  const rows = document.querySelector("#speakerRows");
  if(!project.speakers.length) rows.innerHTML = `<div class="empty">尚未建立講師</div>`;
  project.speakers.forEach((item, idx) => {
    const row = document.createElement("div");
    row.className = "repeater-row speaker";
    row.innerHTML = `
      <input value="${item.name || ""}" placeholder="Name" data-k="name">
      <input value="${item.title || ""}" placeholder="Title" data-k="title">
      <input value="${item.company || ""}" placeholder="Company" data-k="company">
      <button class="button small danger">Delete</button>`;
    row.querySelectorAll("input").forEach(inp => inp.addEventListener("input", e => {
      project.speakers[idx][e.target.dataset.k] = e.target.value; saveProject();
    }));
    row.querySelector("button").addEventListener("click", () => { project.speakers.splice(idx,1); saveProject(); renderSpeakers(); });
    rows.appendChild(row);
  });
  document.querySelector("#addSpeaker").addEventListener("click", () => { project.speakers.push({name:"",title:"",company:"",photo:""}); saveProject(); renderSpeakers(); });
}

function num(v){ const n = Number(v); return Number.isFinite(n) ? n : 0; }
function rate(a,b){ return b ? (a/b*100).toFixed(1)+"%" : "—"; }

function renderRsvp(){
  const c = formShell("RSVP / Attendance","V1 先支援統計欄位；下一步再接 Excel / CSV 匯入。");
  const k = document.createElement("div");
  k.className = "kpi-grid";
  k.innerHTML = `
    <div class="kpi"><span>Total Registration</span><strong>${num(project.rsvp.registrations)}</strong></div>
    <div class="kpi"><span>Total Attendance</span><strong>${num(project.rsvp.attendees)}</strong></div>
    <div class="kpi"><span>Customer Rate</span><strong>${rate(num(project.rsvp.customersAttended),num(project.rsvp.customersRegistered))}</strong></div>
    <div class="kpi"><span>Partner Rate</span><strong>${rate(num(project.rsvp.partnersAttended),num(project.rsvp.partnersRegistered))}</strong></div>`;
  c.appendChild(k);

  const card = document.createElement("div");
  card.className = "card form-grid";
  card.style.marginTop = "14px";
  const fields = [
    ["Total Registration","registrations"],["Total Attendance","attendees"],
    ["Customer Registered","customersRegistered"],["Customer Attended","customersAttended"],
    ["Partner Registered","partnersRegistered"],["Partner Attended","partnersAttended"],
    ["Walk-ins","walkins"],["Survey Collected","surveyCollected"]
  ];
  fields.forEach(([label,key]) => {
    const div = document.createElement("div");
    div.className = "field";
    div.innerHTML = `<label>${label}</label><input type="number" min="0" value="${project.rsvp[key] || ""}">`;
    div.querySelector("input").addEventListener("input", e => { project.rsvp[key] = e.target.value; saveProject(); });
    card.appendChild(div);
  });
  c.appendChild(card);
}

function renderAssetCounter(title, desc, key){
  const c = formShell(title,desc,"ASSET LIBRARY");
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-title-row">
      <div><h3>${title}</h3><p style="margin:6px 0 0;color:var(--muted);font-size:13px">V1 prototype 先確認資料流程。</p></div>
      <button id="addAsset" class="button primary small">+ Add Placeholder</button>
    </div>
    <div class="photo-grid" id="assetGrid"></div>`;
  c.appendChild(card);

  const grid = document.querySelector("#assetGrid");
  const count = project.assets[key] || 0;
  if(!count) grid.innerHTML = `<div class="empty" style="grid-column:1/-1">尚未加入資料</div>`;
  for(let i=0;i<count;i++){
    const tile = document.createElement("div");
    tile.className = "photo-tile";
    tile.innerHTML = `<div class="fake-photo">${title} ${i+1}</div><div class="photo-meta"><span>Item ${i+1}</span><button class="button small danger">Delete</button></div>`;
    tile.querySelector("button").addEventListener("click", () => { project.assets[key]--; saveProject(); renderAssetCounter(title,desc,key); });
    grid.appendChild(tile);
  }
  document.querySelector("#addAsset").addEventListener("click", () => { project.assets[key]++; saveProject(); renderAssetCounter(title,desc,key); });
}

function renderMedia(){
  const c = formShell("Media Promotion","不是每場活動都有，因此設為 Optional Module。","OPTIONAL MODULE");
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="card-title-row"><h3>Enable Media Promotion</h3>
      <label><input id="mediaToggle" type="checkbox" ${project.assets.mediaEnabled ? "checked":""}> Include in this project</label>
    </div>
    <p style="color:var(--muted)">開啟後可記錄 EDM、Banner、Exposure、Open、Click、CTR、Reach、Engagement 等資料。</p>`;
  c.appendChild(card);
  document.querySelector("#mediaToggle").addEventListener("change", e => { project.assets.mediaEnabled = e.target.checked; saveProject(); });
}

function renderSurvey(){
  const c = formShell("Survey","V1 先建立匯入入口；正式版會解析 Excel / CSV、統計並產圖表。","POST EVENT");
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="upload-box">
      <strong>Survey Excel / CSV</strong>
      <p style="color:var(--muted);font-size:13px">目前 Prototype 只記錄檔名，不會解析內容。</p>
      <input id="surveyFile" type="file" accept=".xlsx,.xls,.csv">
    </div>
    <div style="margin-top:14px" class="field">
      <label>Survey Notes</label>
      <textarea id="surveyNotes">${project.survey.notes || ""}</textarea>
    </div>
    ${project.survey.fileName ? `<p><strong>Current file:</strong> ${project.survey.fileName}</p>` : ""}`;
  c.appendChild(card);
  document.querySelector("#surveyFile").addEventListener("change", e => {
    const f = e.target.files[0]; if(!f) return;
    project.survey.uploaded = true; project.survey.fileName = f.name; saveProject(); renderSurvey();
  });
  document.querySelector("#surveyNotes").addEventListener("input", e => { project.survey.notes = e.target.value; saveProject(); });
}

function renderRecap(){
  const c = formShell("Recap & Evaluation","保存活動 Highlight / Lowlight / Issue / Solution，未來可累積為 Event Knowledge Base。","POST EVENT");
  const card = document.createElement("div");
  card.className = "card form-grid";
  const fields = [
    ["Highlights","highlights"],["Lowlights","lowlights"],["Issues","issues"],
    ["Solutions","solutions"],["Recommendations","recommendations"],["Client Feedback","clientFeedback"]
  ];
  fields.forEach(([label,key]) => {
    const div = document.createElement("div");
    div.className = "field";
    div.innerHTML = `<label>${label}</label><textarea>${project.recap[key] || ""}</textarea>`;
    div.querySelector("textarea").addEventListener("input", e => { project.recap[key] = e.target.value; saveProject(); });
    card.appendChild(div);
  });
  c.appendChild(card);
}

function renderReport(){
  const c = formShell("Report Generator","先呈現報告準備度與 KV 套用概念；PPTX engine 下一階段接。","OUTPUT");
  const grid = document.createElement("div");
  grid.className = "form-grid";

  const settings = document.createElement("div");
  settings.className = "card";
  settings.innerHTML = `
    <div class="card-title-row"><h3>Report Settings</h3><div class="status-pill ${completeness() >= 70 ? "done":"pending"}">${completeness()}% READY</div></div>
    <div class="field"><label>Visual Source</label><select><option>Use Event Key Visual</option><option>Brand Template Only</option><option>Custom</option></select></div>
    <div class="field" style="margin-top:12px"><label>Language</label><select><option>English</option><option>Traditional Chinese</option><option>Bilingual</option></select></div>
    <div style="margin-top:18px">
      <button id="prototypeGenerate" class="button primary">Generate PPTX</button>
      <p id="generateMsg" style="color:var(--muted);font-size:12px"></p>
    </div>`;
  grid.appendChild(settings);

  const preview = document.createElement("div");
  preview.className = "report-preview";
  if(project.visual.kvDataUrl){
    preview.style.backgroundImage = `linear-gradient(rgba(20,24,29,.56),rgba(20,24,29,.65)),url("${project.visual.kvDataUrl}")`;
    preview.style.backgroundSize = "cover";
    preview.style.backgroundPosition = "center";
  }
  preview.innerHTML = `
    <div class="eyebrow" style="color:#fff">POST EVENT REPORT</div>
    <h2>${project.info.eventName || "Event Name"}</h2>
    <p>${project.info.eventDate || "Event Date"} · ${project.info.venue || "Venue"}</p>
    <small>Prototype cover preview · Event KV driven</small>`;
  grid.appendChild(preview);
  c.appendChild(grid);

  document.querySelector("#prototypeGenerate").addEventListener("click", () => {
    document.querySelector("#generateMsg").textContent = "Prototype 已完成資料與介面骨架；真正 PPTX 產出會在下一階段接上模板引擎。";
  });
}

refreshHeader();
renderView();
