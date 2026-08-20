import {
  auth, db, provider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
  collection, doc, getDocs, setDoc, deleteDoc, serverTimestamp
} from "./firebase.js";

const WORKSPACE_KEY = "event-report-workspace-v1";
const LEGACY_KEY = "post-event-report-system-v1";
const gate = document.querySelector("#authGate");
const systemApp = document.querySelector("#systemApp");
const loginBtn = document.querySelector("#googleLoginBtn");
const logoutBtn = document.querySelector("#logoutBtn");
const authMessage = document.querySelector("#authMessage");
const userName = document.querySelector("#userName");
let started = false;
let saveTimer = null;
let knownProjectIds = new Set();

function showGate(message = "請登入以繼續") {
  gate.classList.remove("auth-hidden");
  systemApp.classList.add("auth-hidden");
  authMessage.textContent = message;
}

function showApp(user) {
  gate.classList.add("auth-hidden");
  systemApp.classList.remove("auth-hidden");
  userName.textContent = user.displayName || user.email || "Signed in";
}

loginBtn.addEventListener("click", async () => {
  authMessage.textContent = "Redirecting to Google sign-in…";
  loginBtn.disabled = true;
  try { await signInWithRedirect(auth, provider); }
  catch (e) {
    loginBtn.disabled = false;
    authMessage.textContent = `登入失敗：${e.message}`;
  }
});
logoutBtn.addEventListener("click", () => signOut(auth));

try {
  const result = await getRedirectResult(auth);
  if (result?.user) authMessage.textContent = "Google 登入成功，正在載入專案…";
} catch (e) {
  console.error(e);
  authMessage.textContent = `登入失敗：${e.message}`;
}

function stripBinary(project) {
  const p = JSON.parse(JSON.stringify(project || {}));
  if (p.visual) {
    p.visual.kvDataUrl = "";
  }
  if (Array.isArray(p.speakers)) {
    p.speakers = p.speakers.map(s => ({ ...s, photo: "" }));
  }
  if (Array.isArray(p.photos)) {
    p.photos = p.photos.map(({ data, ...rest }) => rest);
  }
  return p;
}

function mergeLocalAssets(cloudProject, localProject) {
  if (!localProject) return cloudProject;
  const merged = JSON.parse(JSON.stringify(cloudProject));
  if (localProject.visual?.kvDataUrl) {
    merged.visual = { ...(merged.visual || {}), kvDataUrl: localProject.visual.kvDataUrl };
  }
  if (Array.isArray(merged.speakers)) {
    const localById = new Map((localProject.speakers || []).map(s => [s.id, s]));
    merged.speakers = merged.speakers.map(s => ({ ...s, photo: localById.get(s.id)?.photo || s.photo || "" }));
  }
  if (Array.isArray(merged.photos)) {
    const localById = new Map((localProject.photos || []).map(p => [p.id, p]));
    merged.photos = merged.photos.map(p => ({ ...p, data: localById.get(p.id)?.data || "" }));
  }
  return merged;
}

async function loadProjectsFromFirestore(user) {
  const snap = await getDocs(collection(db, "projects"));
  const localWorkspace = (() => {
    try { return JSON.parse(localStorage.getItem(WORKSPACE_KEY) || "null"); }
    catch { return null; }
  })();
  const localById = new Map((localWorkspace?.projects || []).map(p => [p.id, p]));
  let projects = snap.docs.map(d => {
    const raw = d.data()?.data || d.data();
    const project = { ...raw, id: raw.id || d.id };
    return mergeLocalAssets(project, localById.get(project.id));
  });

  if (!projects.length) {
    let migration = localWorkspace;
    if (!migration) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        try {
          const p = JSON.parse(legacy);
          migration = { projects: [p], activeId: p.id || null };
        } catch {}
      }
    }
    if (migration?.projects?.length) {
      for (const p of migration.projects) {
        if (!p.id) continue;
        await setDoc(doc(db, "projects", p.id), {
          data: stripBinary(p),
          createdBy: user.uid,
          createdByEmail: user.email || "",
          updatedBy: user.uid,
          updatedByEmail: user.email || "",
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      projects = migration.projects;
    }
  }

  knownProjectIds = new Set(projects.map(p => p.id).filter(Boolean));
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ projects, activeId: localWorkspace?.activeId || null }));
}

async function syncWorkspaceToFirestore(workspace, user) {
  const projects = workspace?.projects || [];
  const currentIds = new Set(projects.map(p => p.id).filter(Boolean));

  for (const p of projects) {
    if (!p.id) continue;
    await setDoc(doc(db, "projects", p.id), {
      data: stripBinary(p),
      updatedBy: user.uid,
      updatedByEmail: user.email || "",
      updatedAt: serverTimestamp(),
      ...(knownProjectIds.has(p.id) ? {} : {
        createdBy: user.uid,
        createdByEmail: user.email || ""
      })
    }, { merge: true });
  }

  for (const id of knownProjectIds) {
    if (!currentIds.has(id)) await deleteDoc(doc(db, "projects", id));
  }
  knownProjectIds = currentIds;
}

function installCloudSave(user) {
  const nativeSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    nativeSet(key, value);
    if (key !== WORKSPACE_KEY) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const workspace = JSON.parse(value);
        await syncWorkspaceToFirestore(workspace, user);
        const s = document.querySelector("#saveState");
        if (s) s.textContent = "Saved to Firestore";
      } catch (e) {
        console.error(e);
        const s = document.querySelector("#saveState");
        if (s) s.textContent = "Firestore save failed";
      }
    }, 500);
  };
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    loginBtn.disabled = false;
    showGate("請使用 Google 帳號登入");
    return;
  }
  if (started) { showApp(user); return; }
  try {
    authMessage.textContent = "Loading shared projects from Firestore…";
    await loadProjectsFromFirestore(user);
    installCloudSave(user);
    showApp(user);
    started = true;
    await import("./app.js");
  } catch (e) {
    console.error(e);
    showGate(`Firebase 連線失敗：${e.message}`);
  }
});
