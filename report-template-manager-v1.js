import {
  auth, storage, storageRef, uploadBytesResumable, getDownloadURL, deleteObject
} from "./firebase.js?v=20260821-storage-v1";

const KEY = "event-report-workspace-v1";
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = v => String(v ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const uid = () => `tpl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const SECTION_LABELS = {
  cover: "Cover",
  eventSummary: "Event Summary",
  rsvp: "RSVP Summary",
  agenda: "Agenda",
  speakers: "Speakers",
  highlights2: "Event Highlights · 2 Photos",
  highlights3: "Event Highlights · 3 Photos",
  highlights4: "Event Highlights · 4 Photos",
  collaterals: "Deco & Collaterals",
  giveaway: "Giveaway",
  survey: "Questionnaire Analysis",
  recap: "Recap & Evaluation"
};

function readWS() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function projectOf(ws = readWS()) {
  return (ws?.projects || []).find(p => p.id === ws.activeId) || null;
}
function saveWS(ws) {
  localStorage.setItem(KEY, JSON.stringify(ws));
  window.dispatchEvent(new CustomEvent("event-report-template-changed"));
}
function canEdit() {
  return (($("#userRole")?.textContent || "VIEWER").trim().toLowerCase() !== "viewer");
}
function active() {
  return $$('.nav-item.active').some(x => x.dataset.view === 'report-template');
}
function safeName(name = "template.pptx") {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "template.pptx";
}
function status(text, error = false) {
  let bar = $('#reportTemplateStatus');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'reportTemplateStatus';
    bar.className = 'report-template-status';
    document.body.appendChild(bar);
  }
  bar.textContent = text;
  bar.classList.toggle('error', error);
  bar.classList.add('show');
  clearTimeout(status.timer);
  status.timer = setTimeout(() => bar.classList.remove('show'), 4200);
}

function xmlText(xml, selector) {
  return xml.querySelector(selector)?.textContent?.trim() || "";
}
function parseXml(text) {
  return new DOMParser().parseFromString(text, "application/xml");
}
function attr(el, localName) {
  if (!el) return "";
  for (const a of [...el.attributes]) if (a.localName === localName) return a.value;
  return "";
}
function nodesByLocalName(root, name) {
  return [...root.getElementsByTagNameNS('*', name)];
}
function colorFromNode(node) {
  if (!node) return "";
  const srgb = nodesByLocalName(node, 'srgbClr')[0];
  if (srgb) return attr(srgb, 'val');
  const sys = nodesByLocalName(node, 'sysClr')[0];
  if (sys) return attr(sys, 'lastClr') || attr(sys, 'val');
  return "";
}

async function analyzeTemplate(file) {
  if (!window.JSZip) throw new Error('JSZip 尚未載入');
  const zip = await window.JSZip.loadAsync(file);
  const all = Object.keys(zip.files);
  const layoutPaths = all
    .filter(x => /^ppt\/slideLayouts\/slideLayout\d+\.xml$/i.test(x))
    .sort((a, b) => Number(a.match(/(\d+)/)?.[1] || 0) - Number(b.match(/(\d+)/)?.[1] || 0));

  const presentationEntry = zip.file('ppt/presentation.xml');
  let slideSize = { cx: 12192000, cy: 6858000, ratio: '16:9' };
  if (presentationEntry) {
    const pxml = parseXml(await presentationEntry.async('text'));
    const sldSz = nodesByLocalName(pxml, 'sldSz')[0];
    const cx = Number(attr(sldSz, 'cx') || slideSize.cx);
    const cy = Number(attr(sldSz, 'cy') || slideSize.cy);
    slideSize = { cx, cy, ratio: Math.abs(cx / cy - 16/9) < .08 ? '16:9' : `${Math.round(cx / cy * 100) / 100}:1` };
  }

  const layouts = [];
  for (const path of layoutPaths) {
    const xml = parseXml(await zip.file(path).async('text'));
    const cSld = nodesByLocalName(xml, 'cSld')[0];
    const layoutRoot = nodesByLocalName(xml, 'sldLayout')[0];
    const placeholders = nodesByLocalName(xml, 'ph').map(ph => ({
      type: attr(ph, 'type') || 'body',
      idx: attr(ph, 'idx') || '',
      sz: attr(ph, 'sz') || ''
    }));
    const shapeNames = nodesByLocalName(xml, 'cNvPr').map(n => attr(n, 'name')).filter(Boolean);
    const number = Number(path.match(/slideLayout(\d+)\.xml/i)?.[1] || layouts.length + 1);
    layouts.push({
      id: `layout-${number}`,
      number,
      path,
      name: attr(cSld, 'name') || attr(layoutRoot, 'matchingName') || `Layout ${number}`,
      type: attr(layoutRoot, 'type') || '',
      placeholders,
      shapeNames: shapeNames.slice(0, 30)
    });
  }

  const themePath = all.find(x => /^ppt\/theme\/theme\d+\.xml$/i.test(x));
  const theme = { name: '', majorFont: '', minorFont: '', colors: {} };
  if (themePath) {
    const txml = parseXml(await zip.file(themePath).async('text'));
    const themeRoot = nodesByLocalName(txml, 'theme')[0];
    theme.name = attr(themeRoot, 'name');
    const majorLatin = nodesByLocalName(txml, 'majorFont')[0]?.getElementsByTagNameNS('*', 'latin')?.[0];
    const minorLatin = nodesByLocalName(txml, 'minorFont')[0]?.getElementsByTagNameNS('*', 'latin')?.[0];
    theme.majorFont = attr(majorLatin, 'typeface');
    theme.minorFont = attr(minorLatin, 'typeface');
    ['dk1','lt1','dk2','lt2','accent1','accent2','accent3','accent4','accent5','accent6','hlink','folHlink'].forEach(key => {
      const node = nodesByLocalName(txml, key)[0];
      const value = colorFromNode(node);
      if (value) theme.colors[key] = value;
    });
  }

  return {
    fileType: file.name.toLowerCase().endsWith('.potx') ? 'potx' : 'pptx',
    fileSize: file.size,
    slideSize,
    layoutCount: layouts.length,
    layouts,
    theme
  };
}

function scoreLayout(layout, section) {
  const text = `${layout.name} ${layout.type} ${(layout.shapeNames || []).join(' ')}`.toLowerCase();
  const pics = (layout.placeholders || []).filter(x => x.type === 'pic' || x.type === 'obj').length;
  const bodies = (layout.placeholders || []).filter(x => ['body','obj','subTitle'].includes(x.type)).length;
  const rules = {
    cover: [['cover', 15], ['title slide', 10], ['title', 3]],
    eventSummary: [['two content', 12], ['content', 5], ['summary', 12], ['multipurpose', 4]],
    rsvp: [['table', 12], ['content', 4], ['summary', 8], ['multipurpose', 5]],
    agenda: [['agenda', 25], ['content', 4]],
    speakers: [['three pictures', 20], ['pictures with text', 14], ['picture', 5]],
    highlights2: [['two pictures', 25], ['pictures with text', 12]],
    highlights3: [['three pictures', 25], ['pictures with text', 12]],
    highlights4: [['four pictures', 25], ['pictures', 8], ['multipurpose', 5]],
    collaterals: [['pictures with text', 15], ['picture with content', 15], ['picture', 6]],
    giveaway: [['pictures with text', 15], ['picture with content', 15], ['picture', 6]],
    survey: [['content', 8], ['multipurpose', 8], ['chart', 15]],
    recap: [['two content', 15], ['three content', 15], ['content', 6], ['multipurpose', 8]]
  };
  let score = 0;
  (rules[section] || []).forEach(([term, value]) => { if (text.includes(term)) score += value; });
  if (section === 'speakers' && pics >= 3) score += 15;
  if (section === 'highlights2' && pics === 2) score += 20;
  if (section === 'highlights3' && pics === 3) score += 20;
  if (section === 'highlights4' && pics >= 4) score += 20;
  if (['collaterals','giveaway'].includes(section) && pics >= 1) score += 8;
  if (['eventSummary','rsvp','survey','recap'].includes(section) && bodies >= 1) score += 4;
  return score;
}
function autoMapping(layouts) {
  const mapping = {};
  Object.keys(SECTION_LABELS).forEach(section => {
    const ranked = [...layouts].map(l => [l, scoreLayout(l, section)]).sort((a, b) => b[1] - a[1]);
    mapping[section] = ranked[0]?.[1] > 0 ? ranked[0][0].id : '';
  });
  return mapping;
}

async function uploadTemplate(file, projectId, onProgress) {
  if (!auth.currentUser) throw new Error('請先登入');
  if (!/\.(pptx|potx)$/i.test(file.name)) throw new Error('只接受 .pptx 或 .potx');
  const path = `projects/${projectId}/report-templates/${Date.now()}_${safeName(file.name)}`;
  const ref = storageRef(storage, path);
  const task = uploadBytesResumable(ref, file, { contentType: file.type || 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  await new Promise((resolve, reject) => task.on('state_changed', snap => {
    const value = snap.totalBytes ? Math.round(snap.bytesTransferred / snap.totalBytes * 100) : 0;
    onProgress?.(value);
  }, reject, resolve));
  return { path, url: await getDownloadURL(ref) };
}
async function removeStored(path) {
  if (!path) return;
  try { await deleteObject(storageRef(storage, path)); } catch (e) { console.warn(e); }
}

function layoutOption(layout, selected) {
  const ph = (layout.placeholders || []).length;
  return `<option value="${esc(layout.id)}" ${layout.id === selected ? 'selected' : ''}>${String(layout.number).padStart(2,'0')} · ${esc(layout.name)}${ph ? ` · ${ph} placeholders` : ''}</option>`;
}

function render() {
  if (!active()) return;
  const root = $('#formContent');
  const ws = readWS(), p = projectOf(ws);
  if (!root || !p) return;
  const t = p.reportTemplate || null;
  const analysis = t?.analysis || {};
  const layouts = analysis.layouts || [];
  const mapping = t?.mapping || {};
  const editable = canEdit();

  root.innerHTML = `<div id="reportTemplateManager" class="report-template-manager">
    <section class="card template-hero">
      <div>
        <div class="eyebrow">REPORT TEMPLATE ENGINE</div>
        <h2>PowerPoint Template</h2>
        <p class="hint">上傳客戶的 .PPTX / .POTX。系統會分析 Slide Layout、Placeholder、Theme 與字型，之後 Report Generator 依這份 Mapping 產出客戶版結案報告。</p>
      </div>
      <label class="button primary file-button ${editable ? '' : 'disabled'}">${t ? 'Replace Template' : 'Upload Template'}<input id="reportTemplateUpload" type="file" accept=".pptx,.potx,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.openxmlformats-officedocument.presentationml.template" ${editable ? '' : 'disabled'}></label>
    </section>

    ${t ? `<section class="card template-file-card">
      <div class="template-file-icon">PPT</div>
      <div class="template-file-info">
        <h3>${esc(t.name || t.fileName || 'PowerPoint Template')}</h3>
        <p>${esc(t.fileName || '')}</p>
        <div class="template-meta-chips">
          <span>${esc((analysis.fileType || '').toUpperCase())}</span>
          <span>${analysis.layoutCount || layouts.length} layouts</span>
          <span>${esc(analysis.slideSize?.ratio || '')}</span>
          ${analysis.theme?.majorFont ? `<span>${esc(analysis.theme.majorFont)}</span>` : ''}
        </div>
      </div>
      <div class="template-file-actions">
        ${t.fileUrl ? `<a class="button ghost small" href="${esc(t.fileUrl)}" target="_blank" rel="noopener">Original File</a>` : ''}
        <button id="removeReportTemplate" class="button danger small" ${editable ? '' : 'disabled'}>Remove</button>
      </div>
    </section>` : `<section class="card template-empty"><div class="template-empty-mark">PPTX</div><h3>No Report Template</h3><p>先上傳客戶 PowerPoint Template。HPE、Nokia、NVIDIA 或其他客戶都可以建立自己的格式。</p></section>`}

    ${t ? `<div class="template-grid">
      <section class="card">
        <div class="card-title-row"><div><h3>Template Profile</h3><p class="hint">這些資訊從 PowerPoint Open XML 自動讀取。</p></div></div>
        <div class="template-profile-grid">
          <div><span>Theme</span><b>${esc(analysis.theme?.name || '—')}</b></div>
          <div><span>Major Font</span><b>${esc(analysis.theme?.majorFont || '—')}</b></div>
          <div><span>Minor Font</span><b>${esc(analysis.theme?.minorFont || '—')}</b></div>
          <div><span>Slide Ratio</span><b>${esc(analysis.slideSize?.ratio || '—')}</b></div>
        </div>
        <div class="template-colors">${Object.entries(analysis.theme?.colors || {}).slice(0,8).map(([k,v]) => `<div title="${esc(k)} #${esc(v)}"><i style="background:#${esc(v)}"></i><small>${esc(k)}</small></div>`).join('')}</div>
      </section>
      <section class="card">
        <div class="card-title-row"><div><h3>Layout Analysis</h3><p class="hint">偵測到 ${layouts.length} 個 PowerPoint Layout。</p></div></div>
        <div class="template-layout-list">${layouts.slice(0,12).map(l => `<div><b>${String(l.number).padStart(2,'0')}</b><span>${esc(l.name)}</span><small>${(l.placeholders || []).length} placeholders</small></div>`).join('')}${layouts.length > 12 ? `<div class="more-layouts">+ ${layouts.length - 12} more layouts</div>` : ''}</div>
      </section>
    </div>

    <section class="card mapping-card">
      <div class="card-title-row"><div><h3>Report Layout Mapping</h3><p class="hint">系統先自動推薦；第一次確認後保存。之後同客戶可直接沿用。</p></div><button id="autoMapTemplate" class="button ghost small" ${editable ? '' : 'disabled'}>Auto Map</button></div>
      <div class="mapping-grid">${Object.entries(SECTION_LABELS).map(([key,label]) => `<label><span>${esc(label)}</span><select data-template-map="${key}" ${editable ? '' : 'disabled'}><option value="">Not mapped</option>${layouts.map(l => layoutOption(l, mapping[key])).join('')}</select></label>`).join('')}</div>
    </section>` : ''}
  </div>`;

  const input = $('#reportTemplateUpload', root);
  if (input) input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (!/\.(pptx|potx)$/i.test(file.name)) { status('請上傳 .pptx 或 .potx', true); input.value = ''; return; }
    try {
      status('正在分析 PowerPoint Template…');
      const analysis = await analyzeTemplate(file);
      status(`已分析 ${analysis.layoutCount} 個 Layout，準備上傳…`);
      const uploaded = await uploadTemplate(file, p.id, pct => status(`Template 上傳中 ${pct}%`));
      const oldPath = p.reportTemplate?.storagePath || '';
      p.reportTemplate = {
        id: p.reportTemplate?.id || uid(),
        name: file.name.replace(/\.(pptx|potx)$/i, ''),
        client: p.info?.client || '',
        fileName: file.name,
        fileUrl: uploaded.url,
        storagePath: uploaded.path,
        uploadedAt: new Date().toISOString(),
        analysis,
        mapping: autoMapping(analysis.layouts)
      };
      saveWS(ws);
      await removeStored(oldPath);
      status(`Template 已完成：${analysis.layoutCount} layouts`);
      render();
    } catch (e) {
      console.error(e);
      status(`Template 處理失敗：${e.message || e}`, true);
    } finally { input.value = ''; }
  };

  $('#removeReportTemplate', root)?.addEventListener('click', async () => {
    if (!canEdit() || !confirm('移除目前 Report Template？')) return;
    const path = p.reportTemplate?.storagePath || '';
    delete p.reportTemplate;
    saveWS(ws);
    await removeStored(path);
    status('Report Template 已移除');
    render();
  });

  $('#autoMapTemplate', root)?.addEventListener('click', () => {
    p.reportTemplate.mapping = autoMapping(layouts);
    saveWS(ws);
    status('已重新自動推薦 Layout Mapping');
    render();
  });

  $$('[data-template-map]', root).forEach(select => {
    select.onchange = () => {
      p.reportTemplate.mapping = p.reportTemplate.mapping || {};
      p.reportTemplate.mapping[select.dataset.templateMap] = select.value;
      saveWS(ws);
      status(`${SECTION_LABELS[select.dataset.templateMap]} mapping 已保存`);
    };
  });
}

const vr = $('#viewRoot');
if (vr) new MutationObserver(() => { if (active()) setTimeout(render, 0); }).observe(vr, { childList: true, subtree: true });
document.addEventListener('click', e => {
  if (e.target.closest?.('.nav-item[data-view="report-template"]')) setTimeout(render, 60);
});
setTimeout(render, 350);
