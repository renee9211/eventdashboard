import {
  auth, db, provider, signInWithRedirect, getRedirectResult, signOut, onAuthStateChanged,
  doc, getDoc, setDoc, serverTimestamp
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
let cloudRef = null;
let saveTimer = null;

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

async function loadSharedWorkspace(user) {
  cloudRef = doc(db, "shared", "workspace");
  const snap = await getDoc(cloudRef);
  if (snap.exists() && snap.data().workspace) {
    localStorage.setItem(WORKSPACE_KEY, JSON.stringify(snap.data().workspace));
    return;
  }

  let local = localStorage.getItem(WORKSPACE_KEY);
  if (!local) {
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      try {
        const p = JSON.parse(legacy);
        local = JSON.stringify({ projects: [p], activeId: p.id || null });
        localStorage.setItem(WORKSPACE_KEY, local);
      } catch {}
    }
  }

  const workspace = local ? JSON.parse(local) : { projects: [], activeId: null };
  await setDoc(cloudRef, {
    workspace,
    createdBy: user.uid,
    createdByEmail: user.email || "",
    updatedBy: user.uid,
    updatedByEmail: user.email || "",
    updatedAt: serverTimestamp()
  }, { merge: true });
}

function installCloudSave(user) {
  const nativeSet = localStorage.setItem.bind(localStorage);
  localStorage.setItem = function(key, value) {
    nativeSet(key, value);
    if (key !== WORKSPACE_KEY || !cloudRef) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      try {
        const workspace = JSON.parse(value);
        await setDoc(cloudRef, {
          workspace,
          updatedBy: user.uid,
          updatedByEmail: user.email || "",
          updatedAt: serverTimestamp()
        }, { merge: true });
        const s = document.querySelector("#saveState");
        if (s) s.textContent = "Saved to Firebase";
      } catch (e) {
        console.error(e);
        const s = document.querySelector("#saveState");
        if (s) s.textContent = "Firebase save failed";
      }
    }, 450);
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
    authMessage.textContent = "Loading shared projects from Firebase…";
    await loadSharedWorkspace(user);
    installCloudSave(user);
    showApp(user);
    started = true;
    await import("./app.js");
  } catch (e) {
    console.error(e);
    showGate(`Firebase 連線失敗：${e.message}`);
  }
});
