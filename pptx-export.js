import PptxGenJS from "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm";

const KEY = "event-report-workspace-v1";
const W = 13.333, H = 7.5, M = 0.55;
const TEXT = "27323C", MUTED = "74808B", LINE = "DCE3E8", LIGHT = "F4F7F9";
const SHAPE = { rect: "rect", roundRect: "roundRect", line: "line" };

function readWorkspace(){try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch{return null}}
function currentProject(){const ws=readWorkspace();return (ws?.projects||[]).find(p=>p.id===ws.activeId)||null}
function safeFileName(v="Post Event Report"){return String(v).replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").trim()}
function hex(v,f){const x=String(v||"").replace("#","").trim();return /^[0-9a-fA-F]{6}$/.test(x)?x.toUpperCase():f}
function pct(a,b){return b?`${Math.round(a/b*1000)/10}%`:"N/A"}
function speakerName(p,id){const s=(p.speakers||[]).find(x=>x.id===id);return s?[s.zhName,s.name].filter(Boolean).join(" "):""}
function chunk(arr,size){const out=[];for(let i=0;i<arr.length;i+=size)out.push(arr.slice(i,i+size));return out.length?out:[[]]}

async function imageData(url){
  if(!url)return null;
  if(String(url).startsWith("data:"))return url;
  try{
    const r=await fetch(url,{mode:"cors"}); if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const b=await r.blob();
    return await new Promise((resolve,reject)=>{const fr=new FileReader();fr.onload=()=>resolve(fr.result);fr.onerror=reject;fr.readAsDataURL(b)});
  }catch(e){console.warn("PPTX image skipped",e);return null}
}

function addFooter(slide,p,accent){
  slide.addShape(SHAPE.line,{x:M,y:7.06,w:12.2,h:0,line:{color:LINE,width:0.7}});
  slide.addText(p.info?.eventName||"Event Project",{x:M,y:7.12,w:6.7,h:0.16,fontFace:"Arial",fontSize:7.5,color:MUTED,margin:0});
  slide.addText("Confidential | Authorized",{x:9.6,y:7.12,w:3.15,h:0.16,fontFace:"Arial",fontSize:7.5,color:MUTED,align:"right",margin:0});
  slide.addShape(SHAPE.rect,{x:12.82,y:0,w:0.51,h:0.14,line:{color:accent,transparency:100},fill:{color:accent}});
}
function addTitle(slide,title,p,accent,subtitle=""){
  slide.background={color:"FFFFFF"};
  slide.addText(title,{x:M,y:0.42,w:9.8,h:0.48,fontFace:"Arial",fontSize:24,bold:true,color:TEXT,margin:0});
  slide.addShape(SHAPE.rect,{x:M,y:1.0,w:0.68,h:0.06,line:{color:accent,transparency:100},fill:{color:accent}});
  if(subtitle)slide.addText(subtitle,{x:8.7,y:0.49,w:4,h:0.3,fontFace:"Arial",fontSize:9,color:MUTED,align:"right",margin:0});
  addFooter(slide,p,accent);
}
function addTable(slide,rows,opts={}){
  slide.addTable(rows,{x:opts.x??M,y:opts.y??1.35,w:opts.w??12.2,border:{type:"solid",color:LINE,pt:1},color:TEXT,fontFace:"Arial",fontSize:opts.fontSize??11,margin:0.08,rowH:opts.rowH??0.42,fill:"FFFFFF",valign:"mid",autoFit:false,...(opts.extra||{})});
}

async function addCover(pres,p,accent,dark){
  const s=pres.addSlide(); s.background={color:dark};
  const kv=await imageData(p.visual?.kvUrl||p.visual?.kvDataUrl||"");
  if(kv){s.addImage({data:kv,x:0,y:0,w:W,h:H});s.addShape(SHAPE.rect,{x:0,y:0,w:W,h:H,line:{color:dark,transparency:100},fill:{color:dark,transparency:38}})}
  s.addShape(SHAPE.rect,{x:0.62,y:0.62,w:0.74,h:0.08,line:{color:accent,transparency:100},fill:{color:accent}});
  s.addText(p.info?.eventDate||"",{x:0.65,y:4.68,w:4.5,h:0.28,fontFace:"Arial",fontSize:12,color:"FFFFFF",bold:true,margin:0});
  s.addText(p.info?.eventName||"Untitled Event",{x:0.65,y:5.03,w:10.8,h:0.78,fontFace:"Arial",fontSize:30,color:"FFFFFF",bold:true,margin:0,fit:"shrink"});
  s.addText("Post Event Report",{x:0.65,y:5.93,w:5,h:0.36,fontFace:"Arial",fontSize:16,color:"FFFFFF",margin:0});
}
function addEventSummary(pres,p,accent){
  const s=pres.addSlide(); addTitle(s,"Event Summary",p,accent); const i=p.info||{}; const attended=(p.attendees||[]).filter(a=>a.attended).length;
  s.addText("Overview",{x:0.65,y:1.4,w:2,h:0.35,fontFace:"Arial",fontSize:16,bold:true,color:TEXT,margin:0});
  s.addText(i.objective||"",{x:0.65,y:1.88,w:6.9,h:1.55,fontFace:"Arial",fontSize:14,color:TEXT,margin:0.02,valign:"top",fit:"shrink"});
  const labels=["Strategy","Date","Venue","Result","Registration"], vals=[i.strategy||"",i.eventDate||"",[i.venue,i.room].filter(Boolean).join(", "),attended?`${attended} attendees`:"",String((p.attendees||[]).length||"")];
  labels.forEach((lab,idx)=>{const y=3.72+idx*0.54;s.addText(lab,{x:0.68,y,w:1.55,h:0.3,fontFace:"Arial",fontSize:10,bold:true,color:MUTED,margin:0});s.addText(vals[idx],{x:2.22,y:y-0.03,w:5.35,h:0.34,fontFace:"Arial",fontSize:13,color:TEXT,margin:0,fit:"shrink"})});
  s.addShape(SHAPE.roundRect,{x:8.25,y:1.4,w:3.9,h:4.7,line:{color:LINE,width:1},fill:{color:LIGHT}});
  s.addText(String(attended),{x:8.7,y:2.2,w:3,h:0.8,fontFace:"Arial",fontSize:44,bold:true,color:accent,align:"center",margin:0});
  s.addText("ATTENDEES",{x:8.7,y:3.05,w:3,h:0.3,fontFace:"Arial",fontSize:11,bold:true,color:MUTED,align:"center",margin:0});
  s.addText(String((p.attendees||[]).length),{x:8.7,y:4.1,w:3,h:0.7,fontFace:"Arial",fontSize:34,bold:true,color:TEXT,align:"center",margin:0});
  s.addText("REGISTRATIONS",{x:8.7,y:4.82,w:3,h:0.3,fontFace:"Arial",fontSize:11,bold:true,color:MUTED,align:"center",margin:0});
}
function attendeeTypeRows(p){const map={};(p.attendees||[]).forEach(a=>{const t=a.type||"Other";map[t]||={registration:0,attendee:0};map[t].registration++;if(a.attended)map[t].attendee++});return Object.entries(map).map(([t,x])=>[t,x.registration,x.attendee,pct(x.attendee,x.registration)])}
function addRsvp(pres,p,accent){const s=pres.addSlide();addTitle(s,"RSVP Summary",p,accent);const total=(p.attendees||[]).length,att=(p.attendees||[]).filter(a=>a.attended).length;const rows=[["Type","Registration","Attendee","Attendance Rate"],...attendeeTypeRows(p),["Total",total,att,pct(att,total)]];addTable(s,rows,{y:1.48,rowH:0.5,fontSize:11});const survey=Number(p.survey?.responseCount||0);s.addShape(SHAPE.roundRect,{x:0.65,y:5.72,w:5.2,h:0.72,line:{color:accent,transparency:75},fill:{color:accent,transparency:90}});s.addText(`Survey Form Collecting Rate: ${survey} collected${att?` · ${pct(survey,att)}`:""}`,{x:0.9,y:5.94,w:4.7,h:0.25,fontFace:"Arial",fontSize:11.5,bold:true,color:TEXT,margin:0})}
function addAgenda(pres,p,accent){chunk(p.agenda||[],10).forEach((grp,idx)=>{const s=pres.addSlide();addTitle(s,idx?`Agenda (${idx+1})`:"Agenda",p,accent);const rows=[["Time","Topic","Speaker"],...grp.map(a=>[[a.startTime||a.time,a.endTime].filter(Boolean).join(" - "),a.topic||"",speakerName(p,a.speakerId)])];addTable(s,rows,{y:1.45,rowH:0.48,fontSize:10.5})})}
async function addSpeakers(pres,p,accent){for(const [g,grp] of chunk(p.speakers||[],3).entries()){const s=pres.addSlide();addTitle(s,g?`Speakers (${g+1})`:"Speakers",p,accent);for(let i=0;i<grp.length;i++){const sp=grp[i],x=0.65+i*4.15,img=await imageData(sp.photoUrl||sp.photo||"");s.addShape(SHAPE.roundRect,{x,y:1.46,w:3.5,h:3.6,line:{color:LINE,width:1},fill:{color:LIGHT}});if(img)s.addImage({data:img,x:x+0.18,y:1.64,w:3.14,h:2.35});s.addText([sp.zhName,sp.name].filter(Boolean).join(" ")||"Speaker",{x:x+0.18,y:4.22,w:3.14,h:0.4,fontFace:"Arial",fontSize:16,bold:true,color:TEXT,align:"center",margin:0,fit:"shrink"});s.addText(sp.title||"",{x:x+0.18,y:4.72,w:3.14,h:0.34,fontFace:"Arial",fontSize:10.5,color:MUTED,align:"center",margin:0,fit:"shrink"});s.addText(sp.company||"",{x:x+0.18,y:5.1,w:3.14,h:0.34,fontFace:"Arial",fontSize:10.5,bold:true,color:accent,align:"center",margin:0,fit:"shrink"})}}}
async function addHighlights(pres,p,accent){const photos=[...(p.photos||[])].sort((a,b)=>(a.sortOrder??9999)-(b.sortOrder??9999));for(const [g,grp] of chunk(photos,4).entries()){const s=pres.addSlide();addTitle(s,g?`Event Highlight (${g+1})`:"Event Highlight",p,accent);for(let i=0;i<grp.length;i++){const ph=grp[i],col=i%2,row=Math.floor(i/2),x=0.65+col*6.05,y=1.42+row*2.65,img=await imageData(ph.url||ph.data||"");if(img)s.addImage({data:img,x,y,w:5.55,h:2.15});else s.addShape(SHAPE.rect,{x,y,w:5.55,h:2.15,line:{color:LINE},fill:{color:LIGHT}});s.addText(ph.caption||ph.category||"",{x,y:y+2.18,w:5.55,h:0.24,fontFace:"Arial",fontSize:9,color:MUTED,margin:0,fit:"shrink"})}}}
async function addAssets(pres,p,accent,key,title){const list=p.assets?.[key]||[];for(const [g,grp] of chunk(list,3).entries()){const s=pres.addSlide();addTitle(s,g?`${title} (${g+1})`:title,p,accent);for(let i=0;i<grp.length;i++){const it=grp[i],x=0.65+i*4.12,img=await imageData(it.actualPhotoUrl||"");if(img)s.addImage({data:img,x,y:1.55,w:3.55,h:2.65});else s.addShape(SHAPE.rect,{x,y:1.55,w:3.55,h:2.65,line:{color:LINE},fill:{color:LIGHT}});s.addText(it.name||"",{x,y:4.35,w:3.55,h:0.36,fontFace:"Arial",fontSize:15,bold:true,color:TEXT,margin:0,fit:"shrink"});s.addText(it.description||"",{x,y:4.8,w:3.55,h:0.75,fontFace:"Arial",fontSize:10,color:MUTED,margin:0,fit:"shrink"})}}}
function addSurvey(pres,p,accent){const qs=p.survey?.questions||[];if(!qs.length){const s=pres.addSlide();addTitle(s,"Questionnaire Analysis",p,accent);s.addText("No survey analysis",{x:0.8,y:2,w:4,h:0.5,fontFace:"Arial",fontSize:18,color:MUTED});return}qs.forEach((q,idx)=>{const s=pres.addSlide();addTitle(s,"Questionnaire Analysis",p,accent,`Q${idx+1}`);s.addText(q.header||"",{x:0.65,y:1.35,w:12,h:0.7,fontFace:"Arial",fontSize:18,bold:true,color:TEXT,margin:0,fit:"shrink"});if(q.type==="open"){s.addText((q.responses||[]).slice(0,8).map(x=>`• ${x}`).join("\n"),{x:0.8,y:2.2,w:11.6,h:4.2,fontFace:"Arial",fontSize:13,color:TEXT,margin:0.03,breakLine:false,fit:"shrink"});return}const opts=q.type==="matrix"?(q.subQuestions?.[0]?.options||[]):q.options||[];opts.slice(0,8).forEach((o,i)=>{const y=2.05+i*0.52,w=Math.max(0.15,Math.min(8.5,(Number(o.percent)||0)/100*8.5));s.addText(String(o.label||""),{x:0.75,y,w:3.25,h:0.28,fontFace:"Arial",fontSize:10,color:TEXT,margin:0,fit:"shrink"});s.addShape(SHAPE.rect,{x:4.05,y:y+0.03,w,h:0.2,line:{color:accent,transparency:100},fill:{color:accent}});s.addText(`${o.count??""} · ${o.percent??0}%`,{x:12.0,y,w:0.75,h:0.25,fontFace:"Arial",fontSize:9,color:MUTED,align:"right",margin:0})})})}
function addRecap(pres,p,accent){const s=pres.addSlide();addTitle(s,"Recap & Evaluation Summary",p,accent);const r=p.recap||{},blocks=[["Highlight",r.highlights],["Lowlight",r.lowlights],["Issues / Solutions",[r.issues,r.solutions].filter(Boolean).join("\n\n")],["Recommendations",r.recommendations]];blocks.forEach((b,i)=>{const col=i%2,row=Math.floor(i/2),x=0.65+col*6.05,y=1.45+row*2.55;s.addShape(SHAPE.roundRect,{x,y,w:5.55,h:2.05,line:{color:LINE},fill:{color:LIGHT}});s.addText(b[0],{x:x+0.2,y:y+0.18,w:5.1,h:0.3,fontFace:"Arial",fontSize:14,bold:true,color:accent,margin:0});s.addText(b[1]||"",{x:x+0.2,y:y+0.58,w:5.1,h:1.2,fontFace:"Arial",fontSize:11,color:TEXT,margin:0.02,fit:"shrink"})})}

export async function exportProjectPptx(projectArg=null, settingsArg=null){
  const p=projectArg||currentProject(); if(!p)throw new Error("找不到目前專案資料");
  const sections={eventSummary:true,rsvp:true,agenda:true,speakers:true,highlights:true,media:true,collaterals:true,giveaway:true,survey:true,recap:true,...(settingsArg?.sections||p.reportSettings?.sections||{})};
  const pres=new PptxGenJS(); pres.layout="LAYOUT_WIDE"; pres.author="Event Report System"; pres.subject="Post Event Report"; pres.title=p.info?.eventName||"Post Event Report"; pres.company=p.info?.client||""; pres.lang="zh-TW";
  const accent=hex(p.visual?.primaryColor,"6F8FA8"), dark=hex(p.visual?.secondaryColor,"31465A");
  await addCover(pres,p,accent,dark);
  if(sections.eventSummary)addEventSummary(pres,p,accent);
  if(sections.rsvp)addRsvp(pres,p,accent);
  if(sections.agenda)addAgenda(pres,p,accent);
  if(sections.speakers)await addSpeakers(pres,p,accent);
  if(sections.highlights)await addHighlights(pres,p,accent);
  if(sections.media){const s=pres.addSlide();addTitle(s,"Media Promotion",p,accent);s.addText("Media Promotion data module will be connected here.",{x:0.8,y:2,w:6,h:0.5,fontFace:"Arial",fontSize:17,color:MUTED})}
  if(sections.collaterals)await addAssets(pres,p,accent,"collaterals","Deco & Collaterals");
  if(sections.giveaway)await addAssets(pres,p,accent,"giveaways","Giveaway");
  if(sections.survey)addSurvey(pres,p,accent);
  if(sections.recap)addRecap(pres,p,accent);
  const filename=`${safeFileName(p.info?.eventName||"Event")}_Post Event Report.pptx`;
  await pres.writeFile({fileName:filename});
}
