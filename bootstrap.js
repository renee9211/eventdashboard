import {
  auth, db, provider, signInWithPopup, signOut, onAuthStateChanged,
  collection, doc, getDocs, getDoc, setDoc, deleteDoc, serverTimestamp
} from "./firebase.js?v=20260820-popup-v1";

const WORKSPACE_KEY = "event-report-workspace-v1";
const LEGACY_KEY = "post-event-report-system-v1";
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
let currentRole = "viewer";
let activeUid = null;
let cloudSaveInstalled = false;
let viewerObserver = null;

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
    if (e?.code === "auth/popup-blocked") {
      authMessage.textContent = "登入視窗被瀏覽器阻擋，請允許此網站的彈出式視窗後再試一次。";
    } else if (e?.code === "auth/popup-closed-by-user") {
      authMessage.textContent = "登入視窗已關閉，請再按一次 Continue with Google。";
    } else {
      authMessage.textContent = `登入失敗：${e.message}`;
    }
  } finally {
    loginBtn.disabled = false;
  }
});

logoutBtn.addEventListener("click", async () => {
  usersModal.classList.add("hidden");
  await signOut(auth);
});

async function ensureUserProfile(user) {
  const ref = doc(db, "users", user.uid);
  const existing = await getDoc(ref);

  if (existing.exists()) {
    const data = existing.data();
    currentRole = ["admin", "editor", "viewer"].includes(data.role) ? data.role : "viewer";
    await setDoc(ref, {
      displayName: user.displayName || data.displayName || "",
      email: user.email || data.email || "",
      lastLoginAt: serverTimestamp()
    }, { merge: true });
    return;
  }

  currentRole = "viewer";
  await setDoc(ref, {
    uid: user.uid,
    displayName: user.displayName || "",
    email: user.email || "",
    role: "viewer",
    createdAt: serverTimestamp(),
    lastLoginAt: serverTimestamp()
  });
}

function stripBinary(project) {
  const p = JSON.parse(JSON.stringify(project || {}));
  if (p.visual) p.visual.kvDataUrl = "";
  if (Array.isArray(p.speakers)) p.speakers = p.speakers.map(s => ({ ...s, photo: "" }));
  if (Array.isArray(p.photos)) p.photos = p.photos.map(({ data, ...rest }) => rest);
  return p;
}

function mergeLocalAssets(cloudProject, localProject) {
  if (!localProject) return cloudProject;
  const merged = JSON.parse(JSON.stringify(cloudProject));
  if (localProject.visual?.kvDataUrl) merged.visual = { ...(merged.visual || {}), kvDataUrl: localProject.visual.kvDataUrl };
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
  const localWorkspace = (() => { try { return JSON.parse(localStorage.getItem(WORKSPACE_KEY) || "null"); } catch { return null; } })();
  const localById = new Map((localWorkspace?.projects || []).map(p => [p.id, p]));
  let projects = snap.docs.map(d => {
    const raw = d.data()?.data || d.data();
    return mergeLocalAssets({ ...raw, id: raw.id || d.id }, localById.get(raw.id || d.id));
  });

  if (!projects.length && currentRole !== "viewer") {
    let migration = localWorkspace;
    if (!migration) {
      const legacy = localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        try { const p = JSON.parse(legacy); migration = { projects: [p], activeId: p.id || null }; } catch {}
      }
    }
    if (migration?.projects?.length) {
      for (const p of migration.projects) {
        if (!p.id) continue;
        await setDoc(doc(db, "projects", p.id), {
          data: stripBinary(p), createdBy: user.uid, createdByEmail: user.email || "",
          updatedBy: user.uid, updatedByEmail: user.email || "", updatedAt: serverTimestamp()
        }, { merge: true });
      }
      projects = migration.projects;
    }
  }

  knownProjectIds = new Set(projects.map(p => p.id).filter(Boolean));
  localStorage.setItem(WORKSPACE_KEY, JSON.stringify({ projects, activeId: localWorkspace?.activeId || null }));
}

async function syncWorkspaceToFirestore(workspace, user) {
  if (!user || currentRole === "viewer") return;
  const projects = workspace?.projects || [];
  const currentIds = new Set(projects.map(p => p.id).filter(Boolean));
  for (const p of projects) {
    if (!p.id) continue;
    await setDoc(doc(db, "projects", p.id), {
      data: stripBinary(p), updatedBy: user.uid, updatedByEmail: user.email || "", updatedAt: serverTimestamp(),
      ...(knownProjectIds.has(p.id) ? {} : { createdBy: user.uid, createdByEmail: user.email || "" })
    }, { merge: true });
  }
  if (currentRole === "admin") {
    for (const id of knownProjectIds) if (!currentIds.has(id)) await deleteDoc(doc(db, "projects", id));
  }
  knownProjectIds = currentIds;
}

function installCloudSave() {
  if (cloudSaveInstalled) return;
  cloudSaveInstalled = true;
  const nativeSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    nativeSet(key, value);
    if (key !== WORKSPACE_KEY || currentRole === "viewer") return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const user = auth.currentUser;
        if (!user || user.uid !== activeUid) return;
        await syncWorkspaceToFirestore(JSON.parse(value), user);
        const s = document.querySelector("#saveState");
        if (s) s.textContent = "Saved to Firestore";
      } catch (e) {
        console.error(e);
        const s = document.querySelector("#saveState");
        if (s) s.textContent = e?.code === "permission-denied" ? "Permission denied" : "Firestore save failed";
      }
    }, 500);
  };
}

function applyRoleMode() {
  const root = document.querySelector("#viewRoot");
  if (!root) return;

  if (currentRole === "viewer") {
    root.querySelectorAll("input, textarea, select").forEach(el => el.disabled = true);
    root.querySelectorAll(".button.primary, .button.danger, .mini-upload, .file-button").forEach(el => el.style.display = "none");
    const save = document.querySelector("#saveState");
    if (save) save.textContent = "View only";
  }

  if (!viewerObserver) {
    viewerObserver = new MutationObserver(() => {
      if (currentRole === "viewer") applyRoleMode();
    });
    viewerObserver.observe(root, { childList: true, subtree: true });
  }
}

async function renderUsers() {
  if (currentRole !== "admin") return;
  const snap = await getDocs(collection(db, "users"));
  const adminIds = snap.docs.filter(d => d.data()?.role === "admin").map(d => d.id);
  usersList.innerHTML = snap.docs.map(d => {
    const u = d.data();
    return `<div class="user-row"><div><strong>${u.displayName || "Unnamed"}</strong><span>${u.email || ""}</span></div><select data-uid="${d.id}" data-original="${u.role || "viewer"}"><option value="admin" ${u.role==="admin"?"selected":""}>Admin</option><option value="editor" ${u.role==="editor"?"selected":""}>Editor</option><option value="viewer" ${u.role==="viewer"?"selected":""}>Viewer</option></select></div>`;
  }).join("") || '<div class="empty">No users yet.</div>';

  usersList.querySelectorAll("select[data-uid]").forEach(sel => {
    sel.onchange = async () => {
      const targetUid = sel.dataset.uid;
      const original = sel.dataset.original || "viewer";
      const next = sel.value;
      const isLastAdmin = original === "admin" && adminIds.length === 1;
      if (isLastAdmin && next !== "admin") {
        alert("系統至少需要保留一位 Admin，最後一位 Admin 不能降級。");
        sel.value = "admin";
        return;
      }
      try {
        await setDoc(doc(db, "users", targetUid), { role: next, updatedAt: serverTimestamp() }, { merge: true });
        sel.dataset.original = next;
        if (targetUid === auth.currentUser?.uid) {
          currentRole = next;
          showApp(auth.currentUser);
          refreshCurrentViewForRole();
        }
        await renderUsers();
      } catch (e) {
        console.error(e);
        alert("角色更新失敗：你目前沒有這個操作權限。");
        sel.value = original;
      }
    };
  });
}

usersBtn.addEventListener("click", async () => {
  if (currentRole !== "admin") return;
  usersModal.classList.remove("hidden");
  await renderUsers();
});
document.querySelectorAll("[data-close-users]").forEach(x => x.addEventListener("click", () => usersModal.classList.add("hidden")));

async function loadSession(user) {
  currentRole = "viewer";
  activeUid = user.uid;
  authMessage.textContent = "Loading user permissions…";
  await ensureUserProfile(user);
  authMessage.textContent = "Loading shared projects from Firestore…";
  await loadProjectsFromFirestore(user);
  showApp(user);
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    activeUid = null;
    currentRole = "viewer";
    loginBtn.disabled = false;
    usersModal.classList.add("hidden");
    showGate("請使用 Google 帳號登入");
    return;
  }

  try {
    const isAccountSwitch = activeUid !== null && activeUid !== user.uid;
    await loadSession(user);

    if (!started) {
      installCloudSave();
      started = true;
      await import("./app.js?v=20260820-account-switch-v1");
      applyRoleMode();
    } else {
      // Auth changed while the app is already mounted: refresh the current view so
      // controls are rebuilt for the newly loaded role without requiring F5.
      if (isAccountSwitch || activeUid === user.uid) refreshCurrentViewForRole();
    }
  } catch (e) {
    console.error(e);
    activeUid = null;
    currentRole = "viewer";
    showGate(`Firebase 連線失敗：${e.message}`);
  }
});
