import PptxGenJS from "https://cdn.jsdelivr.net/npm/pptxgenjs@3.12.0/+esm";

const KEY = "event-report-workspace-v1";
const SW = 13.333;
const SH = 7.5;
const M = 0.58;
const TEXT = "1F2328";
const MUTED = "6B7280";
const LINE = "D9DEE5";
const LIGHT = "F6F7F9";
const WHITE = "FFFFFF";

function readWorkspace(){try{return JSON.parse(localStorage.getItem(KEY)||"null")}catch{return null}}
function currentProject(){const w=readWorkspace();return (w?.projects||[]).find(p=>p.id===w.activeId)||null}
function cleanFileName(v="Post Event Report"){return String(v).replace(/[\\/:*?"<>|]+/g,"-").replace(/\s+/g," ").trim()}
function hex(v,fallback){const x=String(v||"").replace("#","").trim();return /^[0-9a-fA-F]{6}$/.test(x)?x.toUpperCase():fallback}
function pct(a,b){return b?`${Math.round(a/b*10000)/100}%`:"N/A"}
function chunk(arr,n){const out=[];for(let i=0;i<arr.length;i+=n)out.push(arr.slice(i,i+n));return out.length?out:[[]]}
function speaker(project,id){return (project.speakers||[]).find(s=>String(s.id)===String(id))||null}
function speakerText(project,id){const s=speaker(project,id);if(!s)return"";return [[s.zhName,s.name].filter(Boolean).join(" "),s.title,s.company].filter(Boolean).join("\n")}

async function toDataUrl(url){
  if(!url)return null;
  if(String(url).startsWith("data:"))return String(url);
  const res=await fetch(url,{mode:"cors"});
  if(!res.ok)throw new Error(`Image HTTP ${res.status}`);
  const blob=await res.blob();
  return await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(blob)});
}
async function imageInfo(url){
  if(!url)return null;
  try{
    const data=await toDataUrl(url);
    const dims=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve({w:img.naturalWidth||1,h:img.naturalHeight||1});img.onerror=reject;img.src=data});
    return {data,w:dims.w,h:dims.h};
  }catch(e){console.warn("PPTX image skipped",url,e);return null}
}
function contain(info,x,y,w,h){
  if(!info)return {x,y,w,h};
  const r=Math.min(w/info.w,h/info.h);const iw=info.w*r,ih=info.h*r;
  return {x:x+(w-iw)/2,y:y+(h-ih)/2,w:iw,h:ih};
}
async function addContainedImage(slide,url,x,y,w,h,bg=WHITE){
  slide.addShape("rect",{x,y,w,h,line:{color:LINE,width:0.7},fill:{color:bg}});
  const info=await imageInfo(url);if(!info)return false;
  slide.addImage({data:info.data,...contain(info,x,y,w,h)});return true;
}

function addFooter(slide,project,accent,pageNo){
  slide.addText(project.info?.eventName||"Event Project",{x:M,y:0.18,w:7.2,h:0.2,fontFace:"Arial",fontSize:7.5,color:MUTED,margin:0});
  slide.addText(String(pageNo),{x:12.1,y:0.18,w:0.55,h:0.2,fontFace:"Arial",fontSize:7.5,color:MUTED,align:"right",margin:0});
  slide.addText("Confidential | Authorized",{x:M,y:7.12,w:3.2,h:0.16,fontFace:"Arial",fontSize:7,color:MUTED,margin:0});
  slide.addShape("line",{x:M,y:7.0,w:12.15,h:0,line:{color:LINE,width:0.6}});
  slide.addShape("rect",{x:12.82,y:0,w:0.51,h:0.1,line:{color:accent,transparency:100},fill:{color:accent}});
}
function addTitle(slide,title,project,accent,pageNo){
  slide.background={color:WHITE};
  addFooter(slide,project,accent,pageNo);
  slide.addText(title,{x:M,y:0.55,w:8.9,h:0.45,fontFace:"Arial",fontSize:24,bold:true,color:TEXT,margin:0});
}
function addTable(slide,rows,{x=M,y=1.35,w=12.15,fontSize=10,rowH=0.44,colW}={}){
  slide.addTable(rows,{x,y,w,border:{type:"solid",color:LINE,pt:0.8},fontFace:"Arial",fontSize,color:TEXT,margin:0.07,rowH,valign:"mid",fill:WHITE,autoFit:false,colW});
}

async function addCover(pptx,project,accent,dark){
  const slide=pptx.addSlide();slide.background={color:WHITE};
  const kv=await imageInfo(project.visual?.kvUrl||project.visual?.kvDataUrl||"");
  if(kv){const box=contain(kv,0,0,SW,SH);slide.addImage({data:kv.data,...box});}
  else slide.background={color:dark};
  slide.addShape("rect",{x:0,y:5.05,w:SW,h:2.45,line:{color:dark,transparency:100},fill:{color:dark,transparency:kv?12:0}});
  slide.addText(project.info?.eventDate||"",{x:0.72,y:5.35,w:4.2,h:0.24,fontFace:"Arial",fontSize:11,color:WHITE,bold:true,margin:0});
  slide.addText(project.info?.eventName||"Untitled Event",{x:0.72,y:5.72,w:11.4,h:0.62,fontFace:"Arial",fontSize:28,color:WHITE,bold:true,margin:0,fit:"shrink"});
  slide.addText("Post Event Report",{x:0.72,y:6.48,w:4.5,h:0.3,fontFace:"Arial",fontSize:15,color:WHITE,margin:0});
  slide.addShape("rect",{x:0.72,y:5.05,w:0.85,h:0.07,line:{color:accent,transparency:100},fill:{color:accent}});
}

function addEventSummary(pptx,project,accent,pageNo){
  const slide=pptx.addSlide();addTitle(slide,"Event Summary",project,accent,pageNo);
  const i=project.info||{};const attended=(project.attendees||[]).filter(a=>a.attended).length;
  slide.addText("Overview :",{x:0.72,y:1.4,w:1.45,h:0.28,fontFace:"Arial",fontSize:14,bold:true,color:TEXT,margin:0});
  slide.addText(i.objective||"",{x:0.72,y:1.85,w:11.65,h:1.65,fontFace:"Arial",fontSize:12.5,color:TEXT,margin:0,breakLine:false,fit:"shrink",valign:"top"});
  const rows=[["Strategy :",i.strategy||""],["Date :",i.eventDate||""],["Venue :",[i.venue,i.room].filter(Boolean).join(", ")],["Result :",attended?`${attended} attendees`:""],["Registration :",String((project.attendees||[]).length||"")]];
  rows.forEach((r,idx)=>{const y=3.85+idx*0.52;slide.addText(r[0],{x:0.72,y,w:1.55,h:0.3,fontFace:"Arial",fontSize:11,bold:true,color:TEXT,margin:0});slide.addText(r[1],{x:2.18,y:y-0.01,w:9.9,h:0.32,fontFace:"Arial",fontSize:11,color:TEXT,margin:0,fit:"shrink"});});
}

function rsvpMatrix(project){
  const order=[];const map={};
  (project.attendees||[]).forEach(a=>{const t=a.type||"Other";if(!map[t]){map[t]={reg:0,att:0,walk:0};order.push(t)}map[t].reg++;if(a.attended)map[t].att++;if(a.walkin)map[t].walk++});
  const totalReg=(project.attendees||[]).length,totalAtt=(project.attendees||[]).filter(a=>a.attended).length,survey=Number(project.survey?.responseCount||0);
  return [["",...order,"Total"],["Registration",...order.map(t=>map[t].reg),totalReg],["Attendee",...order.map(t=>map[t].walk?`${map[t].att}\n(${map[t].walk} Walk-in Included)`:map[t].att),totalAtt],["Attendance Rate",...order.map(t=>pct(map[t].att,map[t].reg)),pct(totalAtt,totalReg)],[`Survey Form Collecting Rate\n(Total ${survey} collected)`,...order.map((t,i)=>i===0&&map[t].att?pct(survey,map[t].att):"N/A"),totalAtt?pct(survey,totalAtt):"N/A"]];
}
function addRsvp(pptx,project,accent,pageNo){
  const slide=pptx.addSlide();addTitle(slide,"RSVP Summary",project,accent,pageNo);
  const rows=rsvpMatrix(project);const cols=rows[0].length;const first=2.45,other=(12.05-first)/(cols-1);const colW=[first,...Array(cols-1).fill(other)];
  addTable(slide,rows,{x:0.65,y:1.48,w:12.05,fontSize:10.5,rowH:0.72,colW});
  slide.addShape("line",{x:0.65,y:1.43,w:12.05,h:0,line:{color:accent,width:2}});
}

function addAgenda(pptx,project,accent,startPage){
  let pageNo=startPage;const items=project.agenda||[];
  chunk(items,7).forEach(group=>{
    const slide=pptx.addSlide();addTitle(slide,"Agenda",project,accent,pageNo++);
    const rows=[["Time","Topic","Speaker"],...group.map(a=>[[a.startTime||a.time,a.endTime].filter(Boolean).join(" - "),a.topic||"",speakerText(project,a.speakerId)])];
    addTable(slide,rows,{x:0.65,y:1.35,w:12.05,fontSize:10,rowH:0.7,colW:[1.7,5.45,4.9]});
    slide.addShape("line",{x:0.65,y:1.30,w:12.05,h:0,line:{color:accent,width:2}});
  });
  return pageNo;
}

async function addSpeakers(pptx,project,accent,startPage){let pageNo=startPage;for(const group of chunk(project.speakers||[],3)){const slide=pptx.addSlide();addTitle(slide,"Speakers",project,accent,pageNo++);for(let i=0;i<group.length;i++){const s=group[i],x=0.7+i*4.15;await addContainedImage(slide,s.photoUrl||s.photo||"",x,1.45,3.45,3.5,LIGHT);slide.addText([s.zhName,s.name].filter(Boolean).join(" ")||"Speaker",{x,y:5.1,w:3.45,h:0.4,fontFace:"Arial",fontSize:14,bold:true,color:TEXT,align:"center",margin:0,fit:"shrink"});slide.addText([s.title,s.company].filter(Boolean).join(" | "),{x,y:5.6,w:3.45,h:0.52,fontFace:"Arial",fontSize:10,color:MUTED,align:"center",margin:0,fit:"shrink"});}}return pageNo}

async function addHighlights(pptx,project,accent,startPage){let pageNo=startPage;const photos=[...(project.photos||[])].sort((a,b)=>(a.sortOrder??9999)-(b.sortOrder??9999));for(const group of chunk(photos,4)){const slide=pptx.addSlide();addTitle(slide,"Event Highlight",project,accent,pageNo++);for(let i=0;i<group.length;i++){const p=group[i],col=i%2,row=Math.floor(i/2),x=0.7+col*6.05,y=1.35+row*2.65;await addContainedImage(slide,p.url||p.data||"",x,y,5.55,2.15,LIGHT);slide.addText(p.caption||p.category||"",{x,y:y+2.22,w:5.55,h:0.26,fontFace:"Arial",fontSize:9,color:MUTED,margin:0,align:"center",fit:"shrink"});}}return pageNo}

async function addAssets(pptx,project,accent,startPage,title,list){let pageNo=startPage;for(const group of chunk(list||[],2)){const slide=pptx.addSlide();addTitle(slide,title,project,accent,pageNo++);for(let i=0;i<group.length;i++){const a=group[i],x=0.75+i*6.15;await addContainedImage(slide,a.actualPhotoUrl||"",x,1.45,5.65,3.85,WHITE);slide.addText(a.name||"",{x,y:5.55,w:5.65,h:0.36,fontFace:"Arial",fontSize:14,bold:true,color:TEXT,margin:0,align:"center",fit:"shrink"});slide.addText(a.description||[a.type,a.audience,a.qty?`Qty ${a.qty}`:""].filter(Boolean).join(" · "),{x,y:6.0,w:5.65,h:0.45,fontFace:"Arial",fontSize:9.5,color:MUTED,margin:0,align:"center",fit:"shrink"});}}return pageNo}

function addSurvey(pptx,project,accent,startPage){let pageNo=startPage;const qs=project.survey?.questions||[];for(const [idx,q] of qs.entries()){const slide=pptx.addSlide();addTitle(slide,"Questionnaire Analysis",project,accent,pageNo++);slide.addText(`Q${idx+1}. ${q.header||""}`,{x:0.72,y:1.32,w:11.7,h:0.68,fontFace:"Arial",fontSize:15,bold:true,color:TEXT,margin:0,fit:"shrink"});if(q.type==="open"){slide.addText((q.responses||[]).slice(0,10).map(x=>`• ${x}`).join("\n"),{x:0.78,y:2.12,w:11.4,h:4.45,fontFace:"Arial",fontSize:11,color:TEXT,margin:0.03,breakLine:false,fit:"shrink"});continue}const opts=q.type==="matrix"?(q.subQuestions?.[0]?.options||[]):(q.options||[]);const rows=[["Item","Count","Percentage"],...opts.map(o=>[o.label||"",String(o.count??""),`${o.percent??0}%`])];addTable(slide,rows,{x:0.85,y:2.05,w:7.3,fontSize:10.5,rowH:0.5,colW:[4.6,1.2,1.5]});const max=Math.max(1,...opts.map(o=>Number(o.count)||0));opts.slice(0,7).forEach((o,i)=>{const y=2.1+i*0.62;slide.addText(String(o.label||""),{x:8.5,y,w:2.25,h:0.26,fontFace:"Arial",fontSize:8.5,color:MUTED,margin:0,fit:"shrink"});slide.addShape("rect",{x:10.75,y:y+0.02,w:1.6*(Number(o.count||0)/max),h:0.18,line:{color:accent,transparency:100},fill:{color:accent}});slide.addText(String(o.count??""),{x:12.43,y:y-0.01,w:0.35,h:0.22,fontFace:"Arial",fontSize:8.5,color:TEXT,margin:0,align:"right"});});}return pageNo}

function addRecap(pptx,project,accent,pageNo){const slide=pptx.addSlide();addTitle(slide,"Recap & Evaluation Summary",project,accent,pageNo);const r=project.recap||{};const blocks=[["Lowlight",r.lowlights],["Highlight",r.highlights],["Issues / Solutions",[r.issues,r.solutions].filter(Boolean).join("\n\n")],["Recommendations",r.recommendations]];blocks.forEach((b,i)=>{const col=i%2,row=Math.floor(i/2),x=0.72+col*6.0,y=1.45+row*2.55;slide.addText(`${b[0]}:`,{x,y,w:2.0,h:0.3,fontFace:"Arial",fontSize:13,bold:true,color:TEXT,margin:0});slide.addText(b[1]||"",{x,y:y+0.42,w:5.45,h:1.65,fontFace:"Arial",fontSize:10.5,color:TEXT,margin:0,fit:"shrink",valign:"top"});});}

export async function exportProjectPptx(projectArg=null,settingsArg=null){
  const project=projectArg||currentProject();if(!project)throw new Error("找不到目前專案");
  const settings=settingsArg||project.reportSettings||{};const sections={eventSummary:true,rsvp:true,agenda:true,speakers:true,highlights:true,media:true,collaterals:true,giveaway:true,survey:true,recap:true,...(settings.sections||{})};
  const accent=hex(settings.accentColor||project.visual?.accentColor,"01A982");const dark=hex(settings.darkColor,"263746");
  const pptx=new PptxGenJS();pptx.layout="LAYOUT_WIDE";pptx.author="Event Report System";pptx.company=project.info?.client||"";pptx.subject="Post Event Report";pptx.title=`${project.info?.eventName||"Event"} Post Event Report`;pptx.lang="zh-TW";pptx.theme={headFontFace:"Arial",bodyFontFace:"Arial",lang:"zh-TW"};
  let pageNo=1;await addCover(pptx,project,accent,dark);
  if(sections.eventSummary)addEventSummary(pptx,project,accent,pageNo++);
  if(sections.rsvp)addRsvp(pptx,project,accent,pageNo++);
  if(sections.agenda)pageNo=addAgenda(pptx,project,accent,pageNo);
  if(sections.speakers)pageNo=await addSpeakers(pptx,project,accent,pageNo);
  if(sections.highlights)pageNo=await addHighlights(pptx,project,accent,pageNo);
  if(sections.media){const s=pptx.addSlide();addTitle(s,"Media Promotion",project,accent,pageNo++);s.addText("Media Promotion data module will be connected here.",{x:0.8,y:2.7,w:11.7,h:0.5,fontFace:"Arial",fontSize:14,color:MUTED,align:"center",margin:0});}
  if(sections.collaterals)pageNo=await addAssets(pptx,project,accent,pageNo,"Deco & Collaterals",project.assets?.collaterals||[]);
  if(sections.giveaway)pageNo=await addAssets(pptx,project,accent,pageNo,"Giveaway",project.assets?.giveaways||[]);
  if(sections.survey)pageNo=addSurvey(pptx,project,accent,pageNo);
  if(sections.recap)addRecap(pptx,project,accent,pageNo++);
  const fileName=`${cleanFileName(project.info?.eventName||"Event")}_Post_Event_Report.pptx`;await pptx.writeFile({fileName});
}
