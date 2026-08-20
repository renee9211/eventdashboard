import {
  auth, db, provider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, serverTimestamp
} from "./firebase.js?v=20260820-popup-v1";

const WORKSPACE_KEY = "event-report-workspace-v1";
const LEGACY_KEY = "post-event-report-system-v1";
const STRUCTURED = ["agenda", "speakers", "attendees"];
const gate = document.querySelector("#authGate");
const systemApp = document.querySelector("#systemApp");
const loginBtn = document.querySelector("#googleLoginBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const authMessage = document.querySelector("#authMessage");
const userName = document.querySelector("#userName");
const userRole = document.querySelector("#userRole");
const usersBtn = document.querySelector("#usersBtn");
const usersModal = document.querySelector("#usersModal");
const usersList = document.querySelector("#usersList");
let started = false;
let saveTimer = null;
let knownProjectIds = new Set();
let knownChildIds = new Map();
let currentRole = "viewer";
let activeUid = null;
let cloudSaveInstalled = false;
let viewerObserver = null;

const childKey = (projectId, type) => `${projectId}:${type}`;
const getKnownChildren = (projectId, type) => knownChildIds.get(childKey(projectId, type)) || new Set();
const setKnownChildren = (projectId, type, ids) => knownChildIds.set(childKey(projectId, type), new Set(ids));

function showGate(message = "請登入以繼續") {
  gate.classList.remove("auth-hidden");
  systemApp.classList.add("auth-hidden");
  authMessage.textContent = message;
}

function showApp(user) {
  gate.classList.add("auth-hidden");
  systemApp.classList.remove("auth-hidden");
  userName.textContent = user.displayName || user.email || "Signed in";
  userRole.textContent = currentRole.toUpperCase();
  userRole.className = `role-chip role-${currentRole}`;
  usersBtn.style.display = currentRole === "admin" ? "" : "none";
  const newBtn = document.querySelector("#newProjectBtn");
  if (newBtn) newBtn.style.display = currentRole === "viewer" ? "none" : "";
}

function refreshCurrentViewForRole() {
  if (!started) return;
  const activeNav = document.querySelector(".nav-item.active");
  if (activeNav && typeof activeNav.onclick === "function") activeNav.onclick();
  setTimeout(applyRoleMode, 0);
}

loginBtn.addEventListener("click", async () => {
  authMessage.textContent = "Opening Google sign-in…";
  loginBtn.disabled = true;
  try {
    const result = await signInWithPopup(auth, provider);
    if (result?.user) authMessage.textContent = "Google 登入成功，正在載入權限…";
  } catch (e) {
    console.error(e);
    if (e?.code === "auth/popup-blocked") authMessage.textContent = "登入視窗被瀏覽器阻擋，請允許此網站的彈出式視窗後再試一次。";
    else if (e?.code === "auth/popup-closed-by-user") authMessage.textContent = "登入視窗已關閉，請再按一次 Continue with Google。";
    else authMessage.textContent = `登入失敗：${e.message}`;
  } finally { loginBtn.disabled = false; }
});

logoutBtn.addEventListener("click", async () => { usersModal.classList.add("hidden"); await signOut(auth); });

async function ensureUserProfile(user) {
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);
  if (existing.exists()) {
    const data = existing.data();
    currentRole = ["admin", "editor", "viewer"].includes(data.role) ? data.role : "viewer";
    await setDoc(ref, { displayName:user.displayName||data.displayName||"", email:user.email||data.email||"", lastLoginAt:serverTimestamp() }, { merge:true });
    return;
  }
  currentRole = "viewer";
  await setDoc(ref, { uid:user.uid, displayName:user.displayName||"", email:user.email||"", role:"viewer", createdAt:serverTimestamp(), lastLoginAt:serverTimestamp() });
}

function projectCore(project) {
  const p = JSON.parse(JSON.stringify(project || {}));
  STRUCTURED.forEach(k => delete p[k]);
  if (p.visual) p.visual.kvDataUrl = "";
  if (Array.isArray(p.photos)) p.photos = p.photos.map(({ data, ...rest }) => rest);
  return p;
}

function mergeLocalAssets(cloudProject, localProject) {
  if (!localProject) return cloudProject;
  const merged = JSON.parse(JSON.stringify(cloudProject));
  if (localProject.visual?.kvDataUrl) merged.visual = { ...(merged.visual||{}), kvDataUrl:localProject.visual.kvDataUrl };
  if (Array.isArray(merged.speakers)) {
    const localById = new Map((localProject.speakers||[]).map(s=>[s.id,s]));
    merged.speakers = merged.speakers.map(s=>({ ...s, photo:localById.get(s.id)?.photo||s.photo||"" }));
  }
  if (Array.isArray(merged.photos)) {
    const localById = new Map((localProject.photos||[]).map(p=>[p.id,p]));
    merged.photos = merged.photos.map(p=>({ ...p, data:localById.get(p.id)?.data||"" }));
  }
  return merged;
}

async function readChildCollection(projectId,type) {
  const snap = await getDocs(collection(db,"projects",projectId,type));
  const rows = snap.docs.map(d=>({ ...d.data(), id:d.data()?.id||d.id }));
  setKnownChildren(projectId,type,rows.map(x=>x.id).filter(Boolean));
  return rows;
}

async function migrateLegacyChildren(projectId,type,legacyRows,user) {
  if (currentRole === "viewer" || !Array.isArray(legacyRows) || !legacyRows.length) return legacyRows || [];
  const rows=[];
  for (let i=0;i<legacyRows.length;i++) {
    const source=legacyRows[i]||{}; const id=source.id||`${type}-${Date.now().toString(36)}-${i}`; const clean={...source,id};
    if (type === "speakers") clean.photo="";
    await setDoc(doc(db,"projects",projectId,type,id),{...clean,updatedBy:user.uid,updatedByEmail:user.email||"",updatedAt:serverTimestamp()},{merge:true});
    rows.push({...source,id});
  }
  setKnownChildren(projectId,type,rows.map(x=>x.id)); return rows;
}

async function hydrateStructuredData(project,raw,user) {
  const result={...project};
  for (const type of STRUCTURED) {
    let cloudRows=await readChildCollection(project.id,type); const legacyRows=Array.isArray(raw?.[type])?raw[type]:[];
    if (!cloudRows.length && legacyRows.length) cloudRows=await migrateLegacyChildren(project.id,type,legacyRows,user);
    result[type]=cloudRows.length?cloudRows:legacyRows;
  }
  return result;
}

async function loadProjectsFromFirestore(user) {
  const snap=await getDocs(collection(db,"projects"));
  const localWorkspace=(()=>{try{return JSON.parse(localStorage.getItem(WORKSPACE_KEY)||"null")}catch{return null}})();
  const localById=new Map((localWorkspace?.projects||[]).map(p=>[p.id,p])); knownChildIds=new Map(); let projects=[];
  for (const d of snap.docs) {
    const raw=d.data()?.data||d.data(); const base={...raw,id:raw.id||d.id}; const hydrated=await hydrateStructuredData(base,raw,user);
    projects.push(mergeLocalAssets(hydrated,localById.get(hydrated.id)));
  }
  if (!projects.length && currentRole!=="viewer") {
    let migration=localWorkspace;
    if (!migration) { const legacy=localStorage.getItem(LEGACY_KEY); if (legacy) try { const p=JSON.parse(legacy); migration={projects:[p],activeId:p.id||null}; } catch {} }
    if (migration?.projects?.length) {
      for (const p of migration.projects) {
        if (!p.id) continue;
        await setDoc(doc(db,"projects",p.id),{data:projectCore(p),createdBy:user.uid,createdByEmail:user.email||"",updatedBy:user.uid,updatedByEmail:user.email||"",updatedAt:serverTimestamp()},{merge:true});
        for (const type of STRUCTURED) await migrateLegacyChildren(p.id,type,p[type]||[],user);
      }
      projects=migration.projects;
    }
  }
  knownProjectIds=new Set(projects.map(p=>p.id).filter(Boolean));
  localStorage.setItem(WORKSPACE_KEY,JSON.stringify({projects,activeId:localWorkspace?.activeId||null}));
}

async function syncChildCollection(projectId,type,rows,user) {
  const current=Array.isArray(rows)?rows:[]; const currentIds=new Set();
  for (let i=0;i<current.length;i++) {
    const source=current[i]||{}; const id=source.id||`${type}-${Date.now().toString(36)}-${i}`; source.id=id; currentIds.add(id); const clean={...source,id};
    if (type==="speakers") clean.photo="";
    await setDoc(doc(db,"projects",projectId,type,id),{...clean,updatedBy:user.uid,updatedByEmail:user.email||"",updatedAt:serverTimestamp()},{merge:true});
  }
  const known=getKnownChildren(projectId,type); for (const id of known) if (!currentIds.has(id)) await deleteDoc(doc(db,"projects",projectId,type,id));
  setKnownChildren(projectId,type,currentIds);
}

async function syncWorkspaceToFirestore(workspace,user) {
  if (!user || currentRole==="viewer") return;
  const projects=workspace?.projects||[]; const currentIds=new Set(projects.map(p=>p.id).filter(Boolean));
  for (const p of projects) {
    if (!p.id) continue;
    await setDoc(doc(db,"projects",p.id),{data:projectCore(p),updatedBy:user.uid,updatedByEmail:user.email||"",updatedAt:serverTimestamp(),...(knownProjectIds.has(p.id)?{}:{createdBy:user.uid,createdByEmail:user.email||""})},{merge:true});
    for (const type of STRUCTURED) await syncChildCollection(p.id,type,p[type]||[],user);
  }
  if (currentRole==="admin") for (const id of knownProjectIds) if (!currentIds.has(id)) await deleteDoc(doc(db,"projects",id));
  knownProjectIds=currentIds;
}

function installCloudSave() {
  if (cloudSaveInstalled) return; cloudSaveInstalled=true; const nativeSet=localStorage.setItem.bind(localStorage);
  localStorage.setItem=function(key,value) {
    nativeSet(key,value); if (key!==WORKSPACE_KEY || currentRole==="viewer") return; clearTimeout(saveTimer);
    saveTimer=setTimeout(async()=>{
      try { const user=auth.currentUser; if (!user || user.uid!==activeUid) return; await syncWorkspaceToFirestore(JSON.parse(value),user); const s=document.querySelector("#saveState"); if(s)s.textContent="Saved to Firestore"; }
      catch(e){ console.error(e); const s=document.querySelector("#saveState"); if(s)s.textContent=e?.code==="permission-denied"?"Permission denied":"Firestore save failed"; }
    },500);
  };
}

function enhanceSpeakerFields() {
  const cards=[...document.querySelectorAll("#speakerGrid .speaker-card")];
  if (!cards.length) return;
  let workspace; try { workspace=JSON.parse(localStorage.getItem(WORKSPACE_KEY)||"null"); } catch { return; }
  const project=(workspace?.projects||[]).find(p=>p.id===workspace?.activeId); if (!project) return;
  cards.forEach((card,index)=>{
    const speaker=project.speakers?.[index]; if (!speaker) return;
    const fields=card.querySelector(".speaker-fields"); if (!fields) return;
    const english=fields.querySelector('input[data-k="name"]'); const titleInput=fields.querySelector('input[data-k="title"]'); const companyInput=fields.querySelector('input[data-k="company"]');
    if (english) english.placeholder="English Name";
    if (titleInput) titleInput.placeholder="Title";
    if (companyInput) companyInput.placeholder="Company";
    if (!fields.querySelector('input[data-speaker-zh]')) {
      const zh=document.createElement("input"); zh.type="text"; zh.placeholder="中文姓名"; zh.value=speaker.zhName||""; zh.dataset.speakerZh="1";
      zh.oninput=e=>{ let w; try{w=JSON.parse(localStorage.getItem(WORKSPACE_KEY)||"null")}catch{return} const p=(w?.projects||[]).find(x=>x.id===w.activeId); const s=p?.speakers?.[index]; if(!s)return; s.zhName=e.target.value; localStorage.setItem(WORKSPACE_KEY,JSON.stringify(w)); };
      if (english?.nextSibling) fields.insertBefore(zh,english.nextSibling); else fields.prepend(zh);
    }
  });
}

function applyRoleMode() {
  const root=document.querySelector("#viewRoot"); if(!root)return;
  enhanceSpeakerFields();
  const controls=root.querySelectorAll("input, textarea, select");
  const actionEls=root.querySelectorAll(".button.primary, .button.danger, .mini-upload, .file-button");
  if(currentRole==="viewer") {
    controls.forEach(el=>el.disabled=true); actionEls.forEach(el=>el.style.display="none"); const save=document.querySelector("#saveState"); if(save)save.textContent="View only";
  } else {
    controls.forEach(el=>el.disabled=false); actionEls.forEach(el=>el.style.display="");
  }
  if(!viewerObserver) {
    viewerObserver=new MutationObserver(()=>{ enhanceSpeakerFields(); const r=document.querySelector("#viewRoot"); if(!r)return; if(currentRole==="viewer"){r.querySelectorAll("input, textarea, select").forEach(el=>el.disabled=true);r.querySelectorAll(".button.primary, .button.danger, .mini-upload, .file-button").forEach(el=>el.style.display="none");} else {r.querySelectorAll("input, textarea, select").forEach(el=>el.disabled=false);r.querySelectorAll(".button.primary, .button.danger, .mini-upload, .file-button").forEach(el=>el.style.display="");}});
    viewerObserver.observe(root,{childList:true,subtree:true});
  }
}

async function renderUsers() {
  if(currentRole!=="admin")return; const snap=await getDocs(collection(db,"users")); const adminIds=snap.docs.filter(d=>d.data()?.role==="admin").map(d=>d.id);
  usersList.innerHTML=snap.docs.map(d=>{const u=d.data();return `<div class="user-row"><div><strong>${u.displayName||"Unnamed"}</strong><span>${u.email||""}</span></div><select data-uid="${d.id}" data-original="${u.role||"viewer"}"><option value="admin" ${u.role==="admin"?"selected":""}>Admin</option><option value="editor" ${u.role==="editor"?"selected":""}>Editor</option><option value="viewer" ${u.role==="viewer"?"selected":""}>Viewer</option></select></div>`}).join("")||'<div class="empty">No users yet.</div>';
  usersList.querySelectorAll("select[data-uid]").forEach(sel=>{sel.onchange=async()=>{const targetUid=sel.dataset.uid,original=sel.dataset.original||"viewer",next=sel.value,isLastAdmin=original==="admin"&&adminIds.length===1;if(isLastAdmin&&next!=="admin"){alert("系統至少需要保留一位 Admin，最後一位 Admin 不能降級。");sel.value="admin";return}try{await setDoc(doc(db,"users",targetUid),{role:next,updatedAt:serverTimestamp()},{merge:true});sel.dataset.original=next;if(targetUid===auth.currentUser?.uid){currentRole=next;showApp(auth.currentUser);refreshCurrentViewForRole()}await renderUsers()}catch(e){console.error(e);alert("角色更新失敗：你目前沒有這個操作權限。");sel.value=original}}});
}

usersBtn.addEventListener("click",async()=>{if(currentRole!=="admin")return;usersModal.classList.remove("hidden");await renderUsers()});
document.querySelectorAll("[data-close-users]").forEach(x=>x.addEventListener("click",()=>usersModal.classList.add("hidden")));

async function loadSession(user) { currentRole="viewer"; activeUid=user.uid; authMessage.textContent="Loading user permissions…"; await ensureUserProfile(user); authMessage.textContent="Loading shared projects from Firestore…"; await loadProjectsFromFirestore(user); showApp(user); }

onAuthStateChanged(auth,async user=>{
  if(!user){activeUid=null;currentRole="viewer";loginBtn.disabled=false;usersModal.classList.add("hidden");showGate("請使用 Google 帳號登入");return}
  try{
    const previousUid=activeUid; await loadSession(user); const isAccountSwitch=previousUid!==null&&previousUid!==user.uid;
    if(!started){installCloudSave();started=true;await import("./app.js?v=20260820-subcollections-v1");applyRoleMode()}
    else if(isAccountSwitch||previousUid===user.uid){refreshCurrentViewForRole()}
  }catch(e){console.error(e);activeUid=null;currentRole="viewer";showGate(`Firebase 連線失敗：${e.message}`)}
});