import pptxgen from "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm";

const KEY = "event-report-workspace-v1";
const W = 13.333;
const H = 7.5;
const M = 0.55;
const TEXT = "27323C";
const MUTED = "74808B";
const LINE = "DCE3E8";
const LIGHT = "F4F7F9";

function readWorkspace() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

function currentProject() {
  const ws = readWorkspace();
  return (ws?.projects || []).find(p => p.id === ws.activeId) || null;
}

function safeFileName(value = "Post Event Report") {
  return String(value).replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, " ").trim();
}

function hex(value, fallback) {
  const v = String(value || "").replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(v) ? v.toUpperCase() : fallback;
}

function pct(a, b) {
  return b ? `${Math.round((a / b) * 1000) / 10}%` : "N/A";
}

function speakerName(project, id) {
  const s = (project.speakers || []).find(x => x.id === id);
  return s ? [s.zhName, s.name].filter(Boolean).join(" ") : "";
}

function attendeeTypeRows(project) {
  const map = {};
  (project.attendees || []).forEach(a => {
    const type = a.type || "Other";
    map[type] ||= { registration: 0, attendee: 0, walkin: 0 };
    map[type].registration += 1;
    if (a.attended) map[type].attendee += 1;
    if (a.walkin) map[type].walkin += 1;
  });
  return Object.entries(map).map(([type, x]) => [type, x.registration, x.attendee, pct(x.attendee, x.registration)]);
}

async function imageData(url) {
  if (!url) return null;
  if (String(url).startsWith("data:")) return url;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (e) {
    console.warn("PPTX image fetch skipped", url, e);
    return null;
  }
}

function addFooter(slide, project, accent) {
  slide.addShape(pptxgen.ShapeType.line, { x: M, y: 7.06, w: 12.2, h: 0, line: { color: LINE, width: 0.7 } });
  slide.addText(project.info?.eventName || "Event Project", { x: M, y: 7.12, w: 6.7, h: 0.16, fontFace: "Arial", fontSize: 7.5, color: MUTED, margin: 0 });
  slide.addText("Confidential | Authorized", { x: 9.6, y: 7.12, w: 3.15, h: 0.16, fontFace: "Arial", fontSize: 7.5, color: MUTED, align: "right", margin: 0 });
  slide.addShape(pptxgen.ShapeType.rect, { x: 12.82, y: 0, w: 0.51, h: 0.14, line: { color: accent, transparency: 100 }, fill: { color: accent } });
}

function addTitle(slide, title, project, accent, subtitle = "") {
  slide.background = { color: "FFFFFF" };
  slide.addText(title, { x: M, y: 0.42, w: 9.8, h: 0.48, fontFace: "Arial", fontSize: 24, bold: true, color: TEXT, margin: 0 });
  slide.addShape(pptxgen.ShapeType.rect, { x: M, y: 1.0, w: 0.68, h: 0.06, line: { color: accent, transparency: 100 }, fill: { color: accent } });
  if (subtitle) slide.addText(subtitle, { x: 8.7, y: 0.49, w: 4.0, h: 0.3, fontFace: "Arial", fontSize: 9, color: MUTED, align: "right", margin: 0 });
  addFooter(slide, project, accent);
}

function addTable(slide, rows, options = {}) {
  slide.addTable(rows, {
    x: options.x ?? M,
    y: options.y ?? 1.35,
    w: options.w ?? 12.2,
    h: options.h,
    border: { type: "solid", color: LINE, pt: 1 },
    color: TEXT,
    fontFace: "Arial",
    fontSize: options.fontSize ?? 11,
    margin: 0.08,
    rowH: options.rowH ?? 0.42,
    fill: "FFFFFF",
    valign: "mid",
    autoFit: false,
    ...options.extra,
  });
}

async function addCover(pres, project, accent, dark) {
  const slide = pres.addSlide();
  slide.background = { color: dark };
  const kv = await imageData(project.visual?.kvUrl || project.visual?.kvDataUrl || "");
  if (kv) {
    slide.addImage({ data: kv, x: 0, y: 0, w: W, h: H });
    slide.addShape(pptxgen.ShapeType.rect, { x: 0, y: 0, w: W, h: H, line: { color: dark, transparency: 100 }, fill: { color: dark, transparency: 38 } });
  }
  slide.addShape(pptxgen.ShapeType.rect, { x: 0.62, y: 0.62, w: 0.74, h: 0.08, line: { color: accent, transparency: 100 }, fill: { color: accent } });
  slide.addText(project.info?.eventDate || "", { x: 0.65, y: 4.68, w: 4.5, h: 0.28, fontFace: "Arial", fontSize: 12, color: "FFFFFF", bold: true, margin: 0 });
  slide.addText(project.info?.eventName || "Untitled Event", { x: 0.65, y: 5.03, w: 10.8, h: 0.78, fontFace: "Arial", fontSize: 30, color: "FFFFFF", bold: true, margin: 0, breakLine: false });
  slide.addText("Post Event Report", { x: 0.65, y: 5.93, w: 5.0, h: 0.36, fontFace: "Arial", fontSize: 16, color: "FFFFFF", margin: 0 });
}

function addEventSummary(pres, project, accent) {
  const slide = pres.addSlide();
  addTitle(slide, "Event Summary", project, accent);
  const i = project.info || {};
  const attended = (project.attendees || []).filter(a => a.attended).length;
  slide.addText("Overview", { x: 0.65, y: 1.4, w: 2.0, h: 0.35, fontFace: "Arial", fontSize: 16, bold: true, color: TEXT, margin: 0 });
  slide.addText(i.objective || "", { x: 0.65, y: 1.88, w: 6.9, h: 1.55, fontFace: "Arial", fontSize: 14, color: TEXT, margin: 0.02, valign: "top", breakLine: false, fit: "shrink" });
  const labels = ["Strategy", "Date", "Venue", "Result", "Registration"];
  const values = [i.strategy || "", i.eventDate || "", [i.venue, i.room].filter(Boolean).join(", "), attended ? `${attended} attendees` : "", String((project.attendees || []).length || "")];
  labels.forEach((label, idx) => {
    const y = 3.72 + idx * 0.54;
    slide.addText(label, { x: 0.68, y, w: 1.55, h: 0.3, fontFace: "Arial", fontSize: 10, bold: true, color: MUTED, margin: 0 });
    slide.addText(values[idx], { x: 2.22, y: y - 0.03, w: 5.35, h: 0.34, fontFace: "Arial", fontSize: 13, color: TEXT, margin: 0 });
  });
  slide.addShape(pptxgen.ShapeType.roundRect, { x: 8.25, y: 1.4, w: 3.9, h: 4.7, rectRadius: 0.08, line: { color: LINE, width: 1 }, fill: { color: LIGHT } });
  slide.addText(String(attended), { x: 8.7, y: 2.2, w: 3.0, h: 0.8, fontFace: "Arial", fontSize: 44, bold: true, color: accent, align: "center", margin: 0 });
  slide.addText("ATTENDEES", { x: 8.7, y: 3.05, w: 3.0, h: 0.3, fontFace: "Arial", fontSize: 11, bold: true, color: MUTED, align: "center", margin: 0 });
  slide.addText(String((project.attendees || []).length), { x: 8.7, y: 4.1, w: 3.0, h: 0.7, fontFace: "Arial", fontSize: 34, bold: true, color: TEXT, align: "center", margin: 0 });
  slide.addText("REGISTRATIONS", { x: 8.7, y: 4.82, w: 3.0, h: 0.3, fontFace: "Arial", fontSize: 11, bold: true, color: MUTED, align: "center", margin: 0 });
}

function addRsvp(pres, project, accent) {
  const slide = pres.addSlide();
  addTitle(slide, "RSVP Summary", project, accent);
  const rows = [["Type", "Registration", "Attendee", "Attendance Rate"], ...attendeeTypeRows(project)];
  const total = (project.attendees || []).length;
  const attended = (project.attendees || []).filter(a => a.attended).length;
  rows.push(["Total", total, attended, pct(attended, total)]);
  addTable(slide, rows, { y: 1.48, rowH: 0.5, fontSize: 11, extra: { bold: false } });
  const survey = Number(project.survey?.responseCount || 0);
  slide.addShape(pptxgen.ShapeType.roundRect, { x: 0.65, y: 5.72, w: 5.2, h: 0.72, rectRadius: 0.04, line: { color: accent, transparency: 75 }, fill: { color: accent, transparency: 90 } });
  slide.addText(`Survey Form Collecting Rate: ${survey} collected${attended ? ` · ${pct(survey, attended)}` : ""}`, { x: 0.9, y: 5.94, w: 4.7, h: 0.25, fontFace: "Arial", fontSize: 11.5, bold: true, color: TEXT, margin: 0 });
}

function chunk(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out.length ? out : [[]];
}

function addAgenda(pres, project, accent) {
  const items = project.agenda || [];
  chunk(items, 10).forEach((group, idx) => {
    const slide = pres.addSlide();
    addTitle(slide, idx ? `Agenda (${idx + 1})` : "Agenda", project, accent);
    const rows = [["Time", "Topic", "Speaker"], ...group.map(a => [
      [a.startTime || a.time, a.endTime].filter(Boolean).join(" - "),
      a.topic || "",
      speakerName(project, a.speakerId),
    ])];
    addTable(slide, rows, { y: 1.45, rowH: 0.48, fontSize: 10.5 });
  });
}

async function addSpeakers(pres, project, accent) {
  const groups = chunk(project.speakers || [], 3);
  for (let g = 0; g < groups.length; g++) {
    const slide = pres.addSlide();
    addTitle(slide, g ? `Speakers (${g + 1})` : "Speakers", project, accent);
    const group = groups[g];
    for (let i = 0; i < group.length; i++) {
      const s = group[i];
      const x = 0.65 + i * 4.15;
      const img = await imageData(s.photoUrl || s.photo || "");
      slide.addShape(pptxgen.ShapeType.roundRect, { x, y: 1.46, w: 3.5, h: 3.6, rectRadius: 0.04, line: { color: LINE, width: 1 }, fill: { color: LIGHT } });
      if (img) slide.addImage({ data: img, x: x + 0.18, y: 1.64, w: 3.14, h: 2.35 });
      slide.addText([s.zhName, s.name].filter(Boolean).join(" ") || "Speaker", { x: x + 0.18, y: 4.22, w: 3.14, h: 0.4, fontFace: "Arial", fontSize: 16, bold: true, color: TEXT, align: "center", margin: 0, fit: "shrink" });
      slide.addText(s.title || "", { x: x + 0.18, y: 4.72, w: 3.14, h: 0.34, fontFace: "Arial", fontSize: 10.5, color: MUTED, align: "center", margin: 0, fit: "shrink" });
      slide.addText(s.company || "", { x: x + 0.18, y: 5.1, w: 3.14, h: 0.34, fontFace: "Arial", fontSize: 10.5, bold: true, color: accent, align: "center", margin: 0, fit: "shrink" });
    }
  }
}

async function addHighlights(pres, project, accent) {
  const photos = [...(project.photos || [])].sort((a, b) => (a.sortOrder ?? 9999) - (b.sortOrder ?? 9999));
  for (const [g, group] of chunk(photos, 4).entries()) {
    const slide = pres.addSlide();
    addTitle(slide, g ? `Event Highlight (${g + 1})` : "Event Highlight", project, accent);
    for (let i = 0; i < group.length; i++) {
      const p = group[i];
      const col = i % 2, row = Math.floor(i / 2);
      const x = 0.65 + col * 6.05, y = 1.42 + row * 2.65;
      const img = await imageData(p.url || p.data || "");
      if (img) slide.addImage({ data: img, x, y, w: 5.55, h: 2.15 });
      else slide.addShape(pptxgen.ShapeType.rect, { x, y, w: 5.55, h: 2.15, line: { color: LINE }, fill: { color: LIGHT } });
      slide.addText(p.caption || p.category || "", { x, y: y + 2.2, w: 5.55, h: 0.25, fontFace: "Arial", fontSize: 9.5, color: MUTED, margin: 0, fit: "shrink" });
    }
  }
}

async function addAssets(pres, project, accent, title, list) {
  for (const [g, group] of chunk(list || [], 2).entries()) {
    const slide = pres.addSlide();
    addTitle(slide, g ? `${title} (${g + 1})` : title, project, accent);
    for (let i = 0; i < group.length; i++) {
      const item = group[i];
      const x = 0.7 + i * 6.15;
      const img = await imageData(item.actualPhotoUrl || "");
      if (img) slide.addImage({ data: img, x, y: 1.45, w: 5.5, h: 3.45 });
      else slide.addShape(pptxgen.ShapeType.rect, { x, y: 1.45, w: 5.5, h: 3.45, line: { color: LINE }, fill: { color: LIGHT } });
      slide.addText(item.name || "", { x, y: 5.08, w: 5.5, h: 0.36, fontFace: "Arial", fontSize: 16, bold: true, color: TEXT, margin: 0, fit: "shrink" });
      slide.addText(item.description || "", { x, y: 5.5, w: 5.5, h: 0.72, fontFace: "Arial", fontSize: 10, color: MUTED, margin: 0, fit: "shrink" });
    }
  }
}

function addSurvey(pres, project, accent) {
  const questions = project.survey?.questions || [];
  if (!questions.length) return;
  questions.forEach((q, index) => {
    const slide = pres.addSlide();
    addTitle(slide, "Questionnaire Analysis", project, accent, `Q${index + 1}`);
    slide.addText(q.header || "", { x: 0.7, y: 1.35, w: 11.8, h: 0.6, fontFace: "Arial", fontSize: 18, bold: true, color: TEXT, margin: 0, fit: "shrink" });
    if (q.type === "open") {
      (q.responses || []).slice(0, 8).forEach((r, i) => slide.addText(`• ${r}`, { x: 0.9, y: 2.15 + i * 0.52, w: 11.2, h: 0.38, fontFace: "Arial", fontSize: 11, color: TEXT, margin: 0, fit: "shrink" }));
      return;
    }
    if (q.type === "matrix") {
      const subs = q.subQuestions || [];
      subs.slice(0, 4).forEach((s, i) => {
        const y = 2.0 + i * 1.18;
        slide.addText(s.label || "", { x: 0.75, y, w: 4.0, h: 0.28, fontFace: "Arial", fontSize: 10.5, bold: true, color: TEXT, margin: 0, fit: "shrink" });
        const top = (s.options || [])[0];
        slide.addText(top ? `${top.label}: ${top.count} (${top.percent}%)` : "", { x: 4.9, y, w: 6.8, h: 0.28, fontFace: "Arial", fontSize: 10.5, color: MUTED, margin: 0, fit: "shrink" });
      });
      return;
    }
    const options = q.options || [];
    options.slice(0, 8).forEach((o, i) => {
      const y = 2.05 + i * 0.57;
      slide.addText(o.label || "", { x: 0.85, y, w: 4.25, h: 0.28, fontFace: "Arial", fontSize: 10.5, color: TEXT, margin: 0, fit: "shrink" });
      slide.addShape(pptxgen.ShapeType.rect, { x: 5.15, y: y + 0.03, w: 5.6, h: 0.19, line: { color: LIGHT, transparency: 100 }, fill: { color: LIGHT } });
      slide.addShape(pptxgen.ShapeType.rect, { x: 5.15, y: y + 0.03, w: 5.6 * Math.min(100, Number(o.percent || 0)) / 100, h: 0.19, line: { color: accent, transparency: 100 }, fill: { color: accent } });
      slide.addText(`${o.count} · ${o.percent}%`, { x: 10.95, y, w: 1.15, h: 0.28, fontFace: "Arial", fontSize: 10, bold: true, color: TEXT, align: "right", margin: 0 });
    });
  });
}

function addRecap(pres, project, accent) {
  const slide = pres.addSlide();
  addTitle(slide, "Recap & Evaluation Summary", project, accent);
  const r = project.recap || {};
  const blocks = [
    ["Highlight", r.highlights || ""],
    ["Lowlight", r.lowlights || ""],
    ["Issues / Solutions", [r.issues, r.solutions].filter(Boolean).join("\n\n")],
    ["Recommendations", r.recommendations || ""],
  ];
  blocks.forEach(([title, body], i) => {
    const col = i % 2, row = Math.floor(i / 2);
    const x = 0.7 + col * 6.12, y = 1.4 + row * 2.62;
    slide.addShape(pptxgen.ShapeType.roundRect, { x, y, w: 5.5, h: 2.2, rectRadius: 0.03, line: { color: LINE }, fill: { color: LIGHT } });
    slide.addText(title, { x: x + 0.22, y: y + 0.2, w: 5.05, h: 0.32, fontFace: "Arial", fontSize: 14, bold: true, color: accent, margin: 0 });
    slide.addText(body, { x: x + 0.22, y: y + 0.66, w: 5.05, h: 1.24, fontFace: "Arial", fontSize: 10.5, color: TEXT, margin: 0, valign: "top", fit: "shrink" });
  });
}

function addMediaPlaceholder(pres, project, accent) {
  const slide = pres.addSlide();
  addTitle(slide, "Media Promotion", project, accent);
  slide.addText("Media Promotion data module will be connected here.", { x: 0.85, y: 2.65, w: 11.5, h: 0.6, fontFace: "Arial", fontSize: 18, color: MUTED, align: "center", margin: 0 });
}

export async function exportProjectPptx(project = currentProject(), settings = null) {
  if (!project) throw new Error("找不到目前專案");
  const sections = {
    eventSummary: true, rsvp: true, agenda: true, speakers: true, highlights: true,
    media: true, collaterals: true, giveaway: true, survey: true, recap: true,
    ...(settings?.sections || project.reportSettings?.sections || {}),
  };
  const accent = hex(project.visual?.primaryColor, "6F8FA8");
  const dark = hex(project.visual?.secondaryColor, "31465A");
  const pres = new pptxgen();
  pres.layout = "LAYOUT_WIDE";
  pres.author = "Event Report System";
  pres.company = project.info?.client || "";
  pres.subject = "Post Event Report";
  pres.title = `${project.info?.eventName || "Event"} - Post Event Report`;
  pres.lang = "zh-TW";
  pres.theme = {
    headFontFace: "Arial",
    bodyFontFace: "Arial",
    lang: "zh-TW",
  };

  await addCover(pres, project, accent, dark);
  if (sections.eventSummary) addEventSummary(pres, project, accent);
  if (sections.rsvp) addRsvp(pres, project, accent);
  if (sections.agenda) addAgenda(pres, project, accent);
  if (sections.speakers) await addSpeakers(pres, project, accent);
  if (sections.highlights) await addHighlights(pres, project, accent);
  if (sections.media) addMediaPlaceholder(pres, project, accent);
  if (sections.collaterals) await addAssets(pres, project, accent, "Deco & Collaterals", project.assets?.collaterals || []);
  if (sections.giveaway) await addAssets(pres, project, accent, "Giveaway", project.assets?.giveaways || []);
  if (sections.survey) addSurvey(pres, project, accent);
  if (sections.recap) addRecap(pres, project, accent);

  const name = safeFileName(`${project.info?.eventDate ? project.info.eventDate + "_" : ""}${project.info?.eventName || "Event"}_Post Event Report.pptx`);
  await pres.writeFile({ fileName: name });
  return name;
}
