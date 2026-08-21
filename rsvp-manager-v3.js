const RSVP3_KEY = "event-report-workspace-v1";
const $r = (s, root = document) => root.querySelector(s);
const $$r = (s, root = document) => [...root.querySelectorAll(s)];
const escR = v => String(v ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const normR = v => String(v ?? "").trim().toLowerCase().replace(/[\s_\-\/()：:]/g, "");
const yesR = v => ["v","yes","y","true","1","是","有","已出席","attended","checkedin"].includes(normR(v));
const walkR = v => /walk\s*-?\s*in|現場報名/i.test(String(v ?? ""));
const rid = () => `rsvp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;

const ALIASES = {
  notes:["備註","remark","remarks","note","notes"], attended:["出席","出席狀況","attendance","attended","checkin","checkedin"], survey:["問卷","survey"],
  code:["編號","no","number","id"], mco:["mco"], type:["type","類別","category","attendeetype"], name:["姓名","name","fullname","attendeename"],
  company:["中文公司名稱","公司","company","companyname"], title:["中文職稱","職稱","title","jobtitle"], department:["部門別","部門","department"],
  jobLevel:["職位別","職位","joblevel","seniority"], decisionRole:["決策角色","decisionrole","role"], email:["電子信箱","電子郵件","email","mail"],
  companyPhone:["公司電話","officephone","companyphone"], extension:["分機","ext","extension"], phone:["行動電話","手機","mobile","phone"],
  registrationSource:["報名資訊來源","registrationsource","invitesource"], consentContact:["同意連絡","同意聯絡"], consentPrivacy:["同意使用個資","個資同意"],
  submittedAt:["填寫時間","submittedat","timestamp"], reserved:["保留欄位"], source:["來源","source"], confirmPhone:["確認電話"]
};
function canon(v){const n=normR(v);for(const [k,a] of Object.entries(ALIASES)) if(a.some(x=>normR(x)===n)) return k;return null;}
function headerRow(matrix){let best={i:-1,score:0};for(let i=0;i<Math.min(20,matrix.length);i++){const keys=(matrix[i]||[]).map(canon).filter(Boolean);const must=keys.includes("name")&&(keys.includes("type")||keys.includes("code")||keys.includes("company"));const score=keys.length+(must?20:0);if(score>best.score)best={i,score};}return best.score>=22?best.i:-1;}
function parseSheet(sheetName, sheet){
  const matrix=XLSX.utils.sheet_to_json(sheet,{header:1,defval:"",raw:false}); const h=headerRow(matrix); if(h<0)return [];
  const headers=matrix[h].map(canon), out=[];
  for(let r=h+1;r<matrix.length;r++){
    const src=matrix[r]||[], x={}; headers.forEach((k,c)=>{if(k)x[k]=src[c]??""});
    const name=String(x.name||"").trim(), code=String(x.code||"").trim(), email=String(x.email||"").trim(); if(!name&&!code&&!email)continue;
    const notes=String(x.notes||"").trim(), walkin=walkR(notes), type=String(x.type||sheetName||"").trim();
    out.push({id:code||rid(),code,type,name,company:String(x.company||"").trim(),title:String(x.title||"").trim(),department:String(x.department||"").trim(),jobLevel:String(x.jobLevel||"").trim(),decisionRole:String(x.decisionRole||"").trim(),email,companyPhone:String(x.companyPhone||"").trim(),extension:String(x.extension||"").trim(),phone:String(x.phone||"").trim(),registrationSource:String(x.registrationSource||"").trim(),source:String(x.source||"").trim(),notes,mco:String(x.mco||"").trim(),consentContact:String(x.consentContact||"").trim(),consentPrivacy:String(x.consentPrivacy||"").trim(),submittedAt:String(x.submittedAt||"").trim(),reserved:String(x.reserved||"").trim(),confirmPhone:String(x.confirmPhone||"").trim(),attended:yesR(x.attended)||walkin,walkin,survey:yesR(x.survey),importSheet:sheetName});
  } return out;
}
function keyOf(x){return x.code?`code:${String(x.code).toLowerCase()}`:x.email?`email:${String(x.email).toLowerCase()}`:`person:${String(x.type)}|${String(x.name)}|${String(x.company)}`.toLowerCase();}
function dedupe(rows){const m=new Map();for(const x of rows){const k=keyOf(x);if(!m.has(k))m.set(k,x);else{const o=m.get(k);m.set(k,{...o,...x,id:o.id||x.id,attended:o.attended||x.attended,walkin:o.walkin||x.walkin,survey:o.survey||x.survey});}}return [...m.values()];}
function readWS(){try{return JSON.parse(localStorage.getItem(RSVP3_KEY)||"null")}catch{return null}}
function currentProject(ws=readWS()){return (ws?.projects||[]).find(p=>p.id===ws.activeId)||null}
function writeAttendees(mutator){const ws=readWS();const p=currentProject(ws);if(!p)return false;p.attendees=Array.isArray(p.attendees)?p.attendees:[];mutator(p.attendees,p);localStorage.setItem(RSVP3_KEY,JSON.stringify(ws));return true;}
function role(){return ($r("#userRole")?.textContent||"VIEWER").trim().toLowerCase();}
function editable(){return role()!=="viewer";}
function refresh(){setTimeout(renderManager,20);}

async function importWorkbook(file){
  const book=XLSX.read(await file.arrayBuffer(),{type:"array"}); let incoming=[]; for(const s of book.SheetNames)incoming.push(...parseSheet(s,book.Sheets[s])); incoming=dedupe(incoming);
  if(!incoming.length)throw new Error("找不到可匯入資料。系統會自動搜尋姓名／Type／編號所在的欄位列。");
  let added=0,updated=0; writeAttendees(existing=>{const map=new Map(existing.map(x=>[keyOf(x),x]));for(const x of incoming){const k=keyOf(x);if(map.has(k)){Object.assign(map.get(k),x,{id:map.get(k).id||x.id});updated++;}else{existing.push(x);map.set(k,x);added++;}}});
  const types=incoming.reduce((a,x)=>{const k=x.type||"Other";a[k]=(a[k]||0)+1;return a},{}); const typeText=Object.entries(types).map(([k,v])=>`${k} ${v}`).join(" / ");
  alert(`RSVP 匯入完成：${incoming.length} 筆\n新增 ${added} / 更新 ${updated}\n${typeText}`); refresh();
}

function managerHTML(p){
  const rows=p?.attendees||[], attended=rows.filter(x=>x.attended).length, walkins=rows.filter(x=>x.walkin).length;
  return `<div id="rsvpManagerV3" class="rsvp-manager-v3">
    <div class="card rsvp-tools-card">
      <div class="card-title-row"><div><h3>RSVP / Attendance Manager</h3><p class="hint">活動前匯入或手動建立 RSVP；活動後直接在同一份名單更新 Attended / Walk-in。</p></div><div class="inline-actions rsvp-main-actions"><label class="button primary small file-button">Import Excel<input id="rsvp3Import" type="file" accept=".xlsx,.xls,.csv"></label><button id="rsvp3Add" class="button primary small">+ Add Attendee</button></div></div>
      <div class="kpi-grid rsvp-kpis"><div class="kpi"><span>Total RSVP</span><strong>${rows.length}</strong></div><div class="kpi"><span>Attended</span><strong>${attended}</strong></div><div class="kpi"><span>No Show</span><strong>${Math.max(0,rows.length-attended)}</strong></div><div class="kpi"><span>Walk-in</span><strong>${walkins}</strong></div></div>
      <div class="rsvp-filter-row"><input id="rsvp3Search" placeholder="Search name / company / email / code"><input id="rsvp3TypeFilter" list="rsvp3Types" placeholder="Filter Type"><datalist id="rsvp3Types"><option value="Customer"><option value="Partner"><option value="Other"><option value="HPE"></datalist><button id="rsvp3ClearFilter" class="button small">Clear</button></div>
    </div>
    <div class="card rsvp-batch-card"><div class="rsvp-batch-row"><strong><span id="rsvp3SelectedCount">0</span> selected</strong><input id="rsvp3BatchType" list="rsvp3Types" placeholder="Type (可自行輸入)"><button class="button small" data-batch="type">Set Type</button><button class="button small" data-batch="attend-yes">Attended ✓</button><button class="button small" data-batch="attend-no">No Show</button><button class="button small" data-batch="walkin-yes">Walk-in ✓</button><button class="button small" data-batch="walkin-no">Not Walk-in</button><button class="button small danger" data-batch="delete">Delete</button></div></div>
    <div class="card"><div class="attendee-table-wrap"><table class="attendee-table rsvp3-table"><thead><tr><th><input id="rsvp3All" type="checkbox"></th><th>編號</th><th>Type</th><th>姓名</th><th>公司</th><th>職稱</th><th>Email</th><th>報名資訊來源</th><th>來源</th><th>Attended</th><th>Walk-in</th></tr></thead><tbody id="rsvp3Body"></tbody></table></div></div>
    <div id="rsvp3Modal" class="modal hidden"><div class="modal-backdrop" data-rsvp3-close></div><div class="modal-card"><div class="modal-head"><div><div class="eyebrow">RSVP</div><h2>Add Attendee</h2><p>Type 可直接輸入 Customer / Partner / HPE 或自訂分類。</p></div><button class="modal-close" data-rsvp3-close>×</button></div><form id="rsvp3Form" class="form-grid"><div class="field"><label>Type *</label><input name="type" list="rsvp3TypesModal" required placeholder="Customer / Partner / Other / HPE"><datalist id="rsvp3TypesModal"><option value="Customer"><option value="Partner"><option value="Other"><option value="HPE"></datalist></div><div class="field"><label>編號</label><input name="code"></div><div class="field"><label>姓名 *</label><input name="name" required></div><div class="field"><label>公司</label><input name="company"></div><div class="field"><label>職稱</label><input name="title"></div><div class="field"><label>Email</label><input name="email" type="email"></div><div class="field"><label>行動電話</label><input name="phone"></div><div class="field"><label>報名資訊來源</label><input name="registrationSource"></div><div class="field"><label>來源</label><input name="source"></div><div class="field"><label>備註</label><input name="notes"></div><div class="field"><label><input name="attended" type="checkbox"> Attended</label></div><div class="field"><label><input name="walkin" type="checkbox"> Walk-in</label></div><div class="modal-actions full"><button type="button" class="button" data-rsvp3-close>Cancel</button><button class="button primary" type="submit">Add Attendee</button></div></form></div></div>
  </div>`;
}

function renderRows(){
  const p=currentProject(); if(!p)return; const body=$r("#rsvp3Body"); if(!body)return;
  const q=normR($r("#rsvp3Search")?.value), tf=normR($r("#rsvp3TypeFilter")?.value); const rows=(p.attendees||[]).filter(x=>{const hay=normR([x.code,x.type,x.name,x.company,x.title,x.email,x.registrationSource,x.source].join(" "));return(!q||hay.includes(q))&&(!tf||normR(x.type).includes(tf));});
  body.innerHTML=rows.length?rows.map(x=>`<tr data-id="${escR(x.id)}"><td><input class="rsvp3-select" type="checkbox"></td><td>${escR(x.code)}</td><td><input data-field="type" value="${escR(x.type)}" list="rsvp3Types"></td><td><input data-field="name" value="${escR(x.name)}"></td><td><input data-field="company" value="${escR(x.company)}"></td><td><input data-field="title" value="${escR(x.title)}"></td><td><input data-field="email" value="${escR(x.email)}"></td><td><input data-field="registrationSource" value="${escR(x.registrationSource)}"></td><td><input data-field="source" value="${escR(x.source)}"></td><td class="check-cell"><input data-field="attended" type="checkbox" ${x.attended?"checked":""}></td><td class="check-cell"><input data-field="walkin" type="checkbox" ${x.walkin?"checked":""}></td></tr>`).join(""):`<tr><td colspan="11" class="table-empty">No attendees</td></tr>`;
  $$r("#rsvp3Body tr[data-id]").forEach(tr=>{const id=tr.dataset.id;$$r("[data-field]",tr).forEach(el=>{el.disabled=!editable();el.onchange=()=>{const field=el.dataset.field;writeAttendees(arr=>{const x=arr.find(a=>String(a.id)===String(id));if(!x)return;x[field]=el.type==="checkbox"?el.checked:el.value;if(field==="walkin"&&el.checked)x.attended=true;});refresh();};});});
  updateSelected();
}
function selectedIds(){return $$r("#rsvp3Body tr[data-id]").filter(tr=>$r(".rsvp3-select",tr)?.checked).map(tr=>tr.dataset.id);}
function updateSelected(){const n=selectedIds().length;const el=$r("#rsvp3SelectedCount");if(el)el.textContent=n;}
function batch(action){const ids=new Set(selectedIds());if(!ids.size)return alert("請先勾選名單。");if(!editable())return;const type=String($r("#rsvp3BatchType")?.value||"").trim();if(action==="type"&&!type)return alert("請輸入要套用的 Type。");if(action==="delete"&&!confirm(`確定刪除 ${ids.size} 筆 RSVP？`))return;writeAttendees(arr=>{if(action==="delete"){for(let i=arr.length-1;i>=0;i--)if(ids.has(String(arr[i].id)))arr.splice(i,1);return;}arr.forEach(x=>{if(!ids.has(String(x.id)))return;if(action==="type")x.type=type;if(action==="attend-yes")x.attended=true;if(action==="attend-no")x.attended=false;if(action==="walkin-yes"){x.walkin=true;x.attended=true;}if(action==="walkin-no")x.walkin=false;});});refresh();}

function wire(){
  const imp=$r("#rsvp3Import"); if(imp)imp.onchange=async e=>{const file=e.target.files?.[0];if(!file)return;try{await importWorkbook(file)}catch(err){console.error(err);alert(`RSVP 匯入失敗：${err.message}`)}finally{e.target.value=""}};
  const add=$r("#rsvp3Add"); if(add)add.onclick=()=>{$r("#rsvp3Modal")?.classList.remove("hidden")}; $$r("[data-rsvp3-close]").forEach(x=>x.onclick=()=>{$r("#rsvp3Modal")?.classList.add("hidden")});
  const form=$r("#rsvp3Form"); if(form)form.onsubmit=e=>{e.preventDefault();const f=new FormData(form),walkin=f.get("walkin")==="on";const row={id:rid(),type:String(f.get("type")||"").trim(),code:String(f.get("code")||"").trim(),name:String(f.get("name")||"").trim(),company:String(f.get("company")||"").trim(),title:String(f.get("title")||"").trim(),email:String(f.get("email")||"").trim(),phone:String(f.get("phone")||"").trim(),registrationSource:String(f.get("registrationSource")||"").trim(),source:String(f.get("source")||"").trim(),notes:String(f.get("notes")||"").trim(),attended:f.get("attended")==="on"||walkin,walkin};writeAttendees(a=>a.push(row));form.reset();$r("#rsvp3Modal")?.classList.add("hidden");refresh();};
  const search=$r("#rsvp3Search"),tf=$r("#rsvp3TypeFilter");if(search)search.oninput=renderRows;if(tf)tf.oninput=renderRows;const clear=$r("#rsvp3ClearFilter");if(clear)clear.onclick=()=>{if(search)search.value="";if(tf)tf.value="";renderRows();};
  const all=$r("#rsvp3All");if(all)all.onchange=()=>{$$r(".rsvp3-select").forEach(x=>x.checked=all.checked);updateSelected();};document.querySelectorAll(".rsvp3-select").forEach(x=>x.onchange=updateSelected);$$r("[data-batch]").forEach(b=>b.onclick=()=>batch(b.dataset.batch));
  if(!editable()){$$r("#rsvpManagerV3 .button.primary,#rsvpManagerV3 .button.danger,#rsvpManagerV3 [data-batch],#rsvp3BatchType").forEach(x=>x.style.display="none");}
}

function renderManager(){
  const activeRsvp=$$r('.nav-item[data-view="rsvp"]').some(x=>x.classList.contains("active")); if(!activeRsvp)return;
  const formContent=$r("#formContent"); if(!formContent)return; const p=currentProject(); if(!p)return;
  formContent.innerHTML=managerHTML(p); renderRows(); wire();
}

const obs=new MutationObserver(()=>{const active=$$r('.nav-item[data-view="rsvp"]').some(x=>x.classList.contains("active"));if(active&&!$r("#rsvpManagerV3"))setTimeout(renderManager,0);});
const root=$r("#viewRoot");if(root)obs.observe(root,{childList:true,subtree:true});
document.addEventListener("click",e=>{const nav=e.target.closest?.('.nav-item[data-view="rsvp"]');if(nav)setTimeout(renderManager,30)});
setTimeout(renderManager,200);
