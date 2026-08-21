import {
  auth, storage, storageRef, uploadBytesResumable, getDownloadURL, deleteObject
} from "./firebase.js?v=20260821-storage-v1";

const KEY = "event-report-workspace-v1";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const uid = () => `media-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));

function readWS() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function projectOf(ws = readWS()) {
  return (ws?.projects || []).find(p => p.id === ws.activeId) || null;
}
function saveWS(ws) { localStorage.setItem(KEY, JSON.stringify(ws)); }
function canEdit() { return (($('#userRole')?.textContent || 'VIEWER').trim().toLowerCase() !== 'viewer'); }
function safeName(name = "image") { return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image"; }
function activeNav(view, phase = null) {
  return $$('.nav-item.active').find(x => x.dataset.view === view && (phase === null || x.dataset.phase === phase));
}
function message(text, error = false) {
  let bar = $('#cloudMediaStatus');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'cloudMediaStatus';
    bar.className = 'cloud-media-status';
    document.body.appendChild(bar);
  }
  bar.textContent = text;
  bar.classList.toggle('error', error);
  bar.classList.add('show');
  clearTimeout(message.timer);
  message.timer = setTimeout(() => bar.classList.remove('show'), 3500);
}
function storageError(e) {
  const code = e?.code || '';
  if (code.includes('storage/unauthorized')) return 'Storage 權限不足，請確認 Firebase Storage Rules。';
  if (code.includes('storage/bucket-not-found') || code.includes('storage/unknown')) return 'Firebase Storage 尚未完成啟用，請先在 Firebase Console 建立 Storage bucket。';
  return `圖片上傳失敗：${e?.message || e}`;
}

async function uploadImage(file, projectId, section, itemId, onProgress) {
  if (!auth.currentUser) throw new Error('請先登入');
  if (!file?.type?.startsWith('image/')) throw new Error('只接受圖片檔');
  const path = `projects/${projectId}/${section}/${itemId}/${Date.now()}_${safeName(file.name)}`;
  const ref = storageRef(storage, path);
  const task = uploadBytesResumable(ref, file, { contentType: file.type });
  await new Promise((resolve, reject) => task.on('state_changed', snap => {
    const pct = snap.totalBytes ? Math.round(snap.bytesTransferred / snap.totalBytes * 100) : 0;
    onProgress?.(pct);
  }, reject, resolve));
  const url = await getDownloadURL(ref);
  return { url, path, name: file.name };
}
async function removeStored(path) {
  if (!path) return;
  try { await deleteObject(storageRef(storage, path)); } catch (e) { console.warn('delete storage file', e); }
}

function enhanceKV() {
  if (!activeNav('visual')) return;
  const root = $('#formContent');
  if (!root || $('#cloudKvUpload')) return;
  const ws = readWS(), p = projectOf(ws); if (!p) return;
  const card = $('.card', root); if (!card) return;
  const wrap = document.createElement('div');
  wrap.className = 'cloud-upload-row';
  wrap.innerHTML = `<label class="button primary file-button">Upload KV to Cloud<input id="cloudKvUpload" type="file" accept="image/*"></label><span class="hint">${p.visual?.kvUrl ? 'Cloud image saved' : 'Firestore stores URL only'}</span>`;
  card.appendChild(wrap);
  if (p.visual?.kvUrl) {
    const img = $('.kv-preview img', root);
    if (img && !img.src) img.src = p.visual.kvUrl;
    if (!img) $('.kv-preview', root)?.insertAdjacentHTML('afterbegin', `<img src="${esc(p.visual.kvUrl)}">`);
  }
  const input = $('#cloudKvUpload'); if (!input) return;
  input.disabled = !canEdit();
  input.onchange = async () => {
    const file = input.files?.[0]; if (!file) return;
    try {
      message('KV 上傳中 0%');
      const oldPath = p.visual?.kvStoragePath || '';
      const result = await uploadImage(file, p.id, 'kv', 'main', pct => message(`KV 上傳中 ${pct}%`));
      p.visual = p.visual || {};
      p.visual.kvUrl = result.url; p.visual.kvStoragePath = result.path; p.visual.kvName = result.name; p.visual.kvDataUrl = result.url;
      saveWS(ws); await removeStored(oldPath); message('KV 已儲存到 Firebase Storage');
      const preview = $('.kv-preview', root); if (preview) preview.innerHTML = `<img src="${esc(result.url)}">`;
    } catch (e) { message(storageError(e), true); }
    finally { input.value = ''; }
  };
}

function enhanceSpeakers() {
  if (!activeNav('speakers')) return;
  const ws = readWS(), p = projectOf(ws); if (!p) return;
  $$('#speakerGrid .speaker-card').forEach((card, index) => {
    if ($('.cloud-speaker-upload', card)) return;
    const s = p.speakers?.[index]; if (!s) return;
    if (s.photoUrl) {
      const photo = $('.speaker-photo', card);
      if (photo) photo.innerHTML = `<img src="${esc(s.photoUrl)}">`;
    }
    const fields = $('.speaker-fields', card); if (!fields) return;
    const label = document.createElement('label');
    label.className = 'mini-upload cloud-speaker-upload';
    label.innerHTML = `Upload Headshot to Cloud<input type="file" accept="image/*">`;
    fields.appendChild(label);
    const input = $('input', label); input.disabled = !canEdit();
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        message('Speaker Headshot 上傳中 0%');
        const oldPath = s.photoStoragePath || '';
        const result = await uploadImage(file, p.id, 'speakers', s.id || index, pct => message(`Speaker Headshot 上傳中 ${pct}%`));
        s.photoUrl = result.url; s.photoStoragePath = result.path; s.photoName = result.name; s.photo = result.url;
        saveWS(ws); await removeStored(oldPath); message('Speaker Headshot 已儲存');
        const photo = $('.speaker-photo', card); if (photo) photo.innerHTML = `<img src="${esc(result.url)}">`;
      } catch (e) { message(storageError(e), true); }
      finally { input.value = ''; }
    };
  });
}

function enhanceActualAssets(view, arrayKey, section) {
  if (!activeNav(view, 'actual')) return;
  const ws = readWS(), p = projectOf(ws); if (!p) return;
  p.assets = p.assets || {};
  const list = Array.isArray(p.assets[arrayKey]) ? p.assets[arrayKey] : [];
  $$('.workflow-item').forEach((item, index) => {
    if ($('.cloud-actual-media', item)) return;
    const row = list[index]; if (!row) return;
    const box = document.createElement('div'); box.className = 'cloud-actual-media';
    box.innerHTML = `<div class="actual-photo-preview">${row.actualPhotoUrl ? `<img src="${esc(row.actualPhotoUrl)}">` : '<span>No actual photo</span>'}</div><div class="cloud-upload-row"><label class="button primary small file-button">Upload Actual Photo<input type="file" accept="image/*"></label>${row.actualPhotoUrl ? '<button type="button" class="button small danger cloud-remove-photo">Remove Photo</button>' : ''}</div>`;
    item.appendChild(box);
    const input = $('input[type=file]', box); input.disabled = !canEdit();
    input.onchange = async () => {
      const file = input.files?.[0]; if (!file) return;
      try {
        message('Actual Photo 上傳中 0%');
        const oldPath = row.actualPhotoStoragePath || '';
        const result = await uploadImage(file, p.id, section, row.id || index, pct => message(`Actual Photo 上傳中 ${pct}%`));
        row.actualPhotoUrl = result.url; row.actualPhotoStoragePath = result.path; row.actualPhotoName = result.name; row.actualDone = true;
        saveWS(ws); await removeStored(oldPath); message('Actual Photo 已儲存');
        $('.actual-photo-preview', box).innerHTML = `<img src="${esc(result.url)}">`;
        if (!$('.cloud-remove-photo', box)) {
          const btn = document.createElement('button'); btn.type='button'; btn.className='button small danger cloud-remove-photo'; btn.textContent='Remove Photo'; $('.cloud-upload-row', box).appendChild(btn); wireRemove(btn);
        }
      } catch (e) { message(storageError(e), true); }
      finally { input.value = ''; }
    };
    function wireRemove(btn) {
      btn.onclick = async () => {
        if (!canEdit() || !confirm('移除這張 Actual Photo？')) return;
        const path = row.actualPhotoStoragePath || '';
        row.actualPhotoUrl=''; row.actualPhotoStoragePath=''; row.actualPhotoName=''; saveWS(ws); await removeStored(path);
        $('.actual-photo-preview', box).innerHTML='<span>No actual photo</span>'; btn.remove(); message('Actual Photo 已移除');
      };
    }
    const remove = $('.cloud-remove-photo', box); if (remove) wireRemove(remove);
  });
}

function renderHighlights() {
  if (!activeNav('photos')) return;
  const root = $('#formContent'); if (!root || root.dataset.cloudHighlights === '1') return;
  const ws = readWS(), p = projectOf(ws); if (!p) return;
  p.photos = Array.isArray(p.photos) ? p.photos : [];
  root.dataset.cloudHighlights = '1';
  const sorted = [...p.photos].sort((a,b)=>(a.sortOrder??9999)-(b.sortOrder??9999));
  root.innerHTML = `<div class="card"><div class="card-title-row"><div><h3>Event Highlights</h3><p class="hint">活動後上傳現場精選照片。可設定分類、Featured 與順序，之後 Report Generator 會直接使用。</p></div><label class="button primary file-button">Upload Photos<input id="cloudHighlightsUpload" type="file" accept="image/*" multiple></label></div><div id="cloudHighlightGrid" class="photo-grid cloud-highlight-grid">${sorted.map((x,i)=>`<article class="photo-tile" data-id="${esc(x.id)}"><div class="cloud-photo-frame">${x.url ? `<img src="${esc(x.url)}" class="real-photo">` : '<div class="empty">Missing cloud image</div>'}</div><div class="photo-controls"><input data-field="caption" value="${esc(x.caption||'')}" placeholder="Caption"><select data-field="category"><option ${x.category==='Overview'?'selected':''}>Overview</option><option ${x.category==='Speaker'?'selected':''}>Speaker</option><option ${x.category==='Audience'?'selected':''}>Audience</option><option ${x.category==='Networking'?'selected':''}>Networking</option><option ${x.category==='Group Photo'?'selected':''}>Group Photo</option><option ${x.category==='Other'?'selected':''}>Other</option></select><label class="featured-check"><input data-field="featured" type="checkbox" ${x.featured?'checked':''}> Featured</label><div class="photo-order-actions"><button class="button small" data-move="up">↑</button><button class="button small" data-move="down">↓</button><button class="button small danger" data-delete>Delete</button></div></div></article>`).join('') || '<div class="empty" style="grid-column:1/-1">活動結束後再上傳 Event Highlights。</div>'}</div></div>`;
  const upload = $('#cloudHighlightsUpload'); if (upload) {
    upload.disabled = !canEdit();
    upload.onchange = async () => {
      const files = [...(upload.files || [])]; if (!files.length) return;
      try {
        for (let i=0;i<files.length;i++) {
          const itemId=uid(); const file=files[i];
          message(`Event Photo ${i+1}/${files.length} 上傳中`);
          const result=await uploadImage(file,p.id,'highlights',itemId,pct=>message(`Event Photo ${i+1}/${files.length} · ${pct}%`));
          p.photos.push({id:itemId,url:result.url,storagePath:result.path,fileName:result.name,caption:'',category:'Overview',featured:false,sortOrder:p.photos.length});
          saveWS(ws);
        }
        message(`已上傳 ${files.length} 張 Event Highlights`); root.dataset.cloudHighlights=''; renderHighlights();
      } catch(e) { message(storageError(e),true); }
      finally { upload.value=''; }
    };
  }
  $$('#cloudHighlightGrid .photo-tile').forEach(tile => {
    const id=tile.dataset.id, get=()=>p.photos.find(x=>String(x.id)===String(id));
    $$('[data-field]',tile).forEach(el=>{el.disabled=!canEdit();el.onchange=()=>{const x=get();if(!x)return;x[el.dataset.field]=el.type==='checkbox'?el.checked:el.value;saveWS(ws);};});
    const del=$('[data-delete]',tile); if(del){del.disabled=!canEdit();del.onclick=async()=>{const x=get();if(!x||!confirm('刪除這張 Event Photo？'))return;await removeStored(x.storagePath);p.photos=p.photos.filter(a=>String(a.id)!==String(id));saveWS(ws);root.dataset.cloudHighlights='';renderHighlights();};}
    $$('[data-move]',tile).forEach(btn=>{btn.disabled=!canEdit();btn.onclick=()=>{const ordered=[...p.photos].sort((a,b)=>(a.sortOrder??9999)-(b.sortOrder??9999));const idx=ordered.findIndex(x=>String(x.id)===String(id));const target=btn.dataset.move==='up'?idx-1:idx+1;if(idx<0||target<0||target>=ordered.length)return;[ordered[idx].sortOrder,ordered[target].sortOrder]=[ordered[target].sortOrder??target,ordered[idx].sortOrder??idx];saveWS(ws);root.dataset.cloudHighlights='';renderHighlights();};});
  });
}

function run() {
  enhanceKV(); enhanceSpeakers(); enhanceActualAssets('collaterals','collaterals','collaterals-actual'); enhanceActualAssets('giveaway','giveaways','giveaway-actual'); renderHighlights();
}
const root = $('#viewRoot');
if (root) new MutationObserver(() => setTimeout(run, 0)).observe(root, { childList:true, subtree:true });
document.addEventListener('click', e => { if (e.target.closest?.('.nav-item')) setTimeout(run, 50); });
setTimeout(run, 300);
