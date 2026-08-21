const PRE_KEY='event-report-workspace-v1';
const pq=(s,r=document)=>r.querySelector(s), pqa=(s,r=document)=>[...r.querySelectorAll(s)];
const pesc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const pid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,7);
function pws(){try{return JSON.parse(localStorage.getItem(PRE_KEY)||'null')}catch{return null}}
function pproject(){const w=pws();return [w,(w?.projects||[]).find(p=>p.id===w.activeId)||null]}
function psave(w){localStorage.setItem(PRE_KEY,JSON.stringify(w))}
function pcanEdit(){return (pq('#userRole')?.textContent||'VIEWER').trim().toLowerCase()!=='viewer'}
function pactivate(btn){pqa('.nav-item').forEach(x=>x.classList.toggle('active',x===btn))}
function pshell(title,desc,eyebrow='PRE-EVENT PLAN'){pq('#viewRoot').innerHTML=`<div class="page"><div class="section-head"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2><p>${desc}</p></div></div><div id="preEventContent"></div></div>`;return pq('#preEventContent')}
function speakerLabel(s){return [s.name,s.zhName,s.company].filter(Boolean).join(' · ')||'Unnamed Speaker'}
function speakerOptions(p,id=''){return '<option value="">— Select Speaker —</option>'+(p.speakers||[]).map(s=>`<option value="${pesc(s.id)}" ${String(s.id)===String(id)?'selected':''}>${pesc(speakerLabel(s))}</option>`).join('')}
function renderAgendaV2(){
  const [w,p]=pproject();if(!p)return;p.agenda=Array.isArray(p.agenda)?p.agenda:[];
  p.agenda.forEach(a=>{if(a.startTime==null)a.startTime=a.time||'';if(a.endTime==null)a.endTime='';});
  const c=pshell('Agenda','活動前建立完整議程；Post Event Report 直接沿用，不需重新輸入。');
  c.innerHTML=`<div class="card"><div class="card-title-row"><div><h3>Agenda Plan</h3><p class="hint">Start / End Time、Topic 與 Speaker。Speaker 直接連結 Speaker Library。</p></div>${pcanEdit()?'<button id="preAddAgenda" class="button primary small">+ Add Agenda</button>':''}</div><div class="pre-agenda-head"><span>Start</span><span>End</span><span>Topic</span><span>Speaker</span><span></span></div><div id="preAgendaRows" class="stack">${p.agenda.map((a,i)=>`<div class="pre-agenda-row" data-i="${i}"><input type="time" data-k="startTime" value="${pesc(a.startTime||'')}"><input type="time" data-k="endTime" value="${pesc(a.endTime||'')}"><input data-k="topic" value="${pesc(a.topic||'')}" placeholder="Topic"><select data-k="speakerId">${speakerOptions(p,a.speakerId)}</select>${pcanEdit()?'<button class="button small danger" data-delete>Delete</button>':'<span></span>'}</div>`).join('')||'<div class="empty">尚未建立議程。</div>'}</div></div>`;
  pqa('.pre-agenda-row').forEach(row=>{const a=p.agenda[+row.dataset.i];pqa('[data-k]',row).forEach(el=>{if(!pcanEdit())el.disabled=true;el.onchange=()=>{a[el.dataset.k]=el.value;a.time=a.startTime||'';psave(w)}});const del=pq('[data-delete]',row);if(del)del.onclick=()=>{p.agenda.splice(+row.dataset.i,1);psave(w);renderAgendaV2()}});
  const add=pq('#preAddAgenda');if(add)add.onclick=()=>{p.agenda.push({id:pid(),startTime:'',endTime:'',time:'',topic:'',speakerId:''});psave(w);renderAgendaV2()};
}
function planChecks(p){const coll=p.assets?.collaterals||[], gifts=p.assets?.giveaways||[];return [
  ['Event Info','event-info',!!(p.info?.eventName&&p.info?.eventDate&&p.info?.venue),'活動名稱、日期、場地'],
  ['Event KV','visual',!!p.visual?.kvDataUrl,'活動主視覺'],
  ['Agenda','agenda',!!p.agenda?.length,'活動議程'],
  ['Speakers','speakers',!!p.speakers?.length,'講師資料'],
  ['RSVP','rsvp',!!p.attendees?.length,'報名名單'],
  ['Collaterals Plan','collaterals',!!coll.length,'製作物規劃','plan'],
  ['Giveaway Plan','giveaway',!!gifts.length,'禮品規劃','plan']
]}
function postChecks(p){const coll=p.assets?.collaterals||[], gifts=p.assets?.giveaways||[];return [
  ['Attendance Result','rsvp',!!(p.attendees||[]).some(x=>x.attended||x.walkin),'實際出席結果','actual'],
  ['Event Highlights','photos',!!p.photos?.length,'活動精選照片'],
  ['Collaterals Actual','collaterals',!!coll.some(x=>x.actualDone),'製作物實際成果','actual'],
  ['Giveaway Actual','giveaway',!!gifts.some(x=>x.actualDone),'禮品實際成果','actual'],
  ['Survey Analysis','survey',!!p.survey?.uploaded,'問卷分析'],
  ['Recap & Evaluation','recap',!!(p.recap?.highlights||p.recap?.lowlights||p.recap?.recommendations),'活動回顧']
]}
function pct(items){return items.length?Math.round(items.filter(x=>x[2]).length/items.length*100):0}
function readinessCards(items){return items.map(([name,view,done,desc,phase])=>`<button class="readiness-card pre-ready-card" data-view="${view}" ${phase?`data-phase="${phase}"`:''}><div><span class="status-pill ${done?'done':'pending'}">${done?'READY':'PENDING'}</span></div><div><h4>${pesc(name)}</h4><p>${pesc(desc)}</p></div></button>`).join('')}
function renderOverviewV2(){
  const [,p]=pproject();if(!p)return;const plan=planChecks(p),post=postChecks(p),planPct=pct(plan),postPct=pct(post);
  const c=pshell('Project Overview','活動前先完成 Plan；活動後只補 Actual，最後直接生成 Post Event Report。','PLAN → POST EVENT');
  c.innerHTML=`<div class="readiness-summary-grid"><div class="readiness-summary-card"><span>PRE-EVENT PLAN</span><strong>${planPct}%</strong><p>${plan.filter(x=>x[2]).length} / ${plan.length} completed</p></div><div class="readiness-summary-card"><span>POST-EVENT</span><strong>${postPct}%</strong><p>${post.filter(x=>x[2]).length} / ${post.length} completed</p></div><div class="readiness-summary-card report-summary"><span>REPORT READINESS</span><strong>${Math.round((planPct+postPct)/2)}%</strong><p>Plan 與 Post-event 綜合完成度</p></div></div><div class="section-head"><div><h3>Pre-event Plan</h3><p>活動前應先完成的資料。</p></div></div><div class="readiness-grid">${readinessCards(plan)}</div><div class="section-head"><div><h3>Post-event</h3><p>活動結束後再補的實際成果。</p></div></div><div class="readiness-grid">${readinessCards(post)}</div>`;
  pqa('.pre-ready-card').forEach(btn=>btn.onclick=()=>{const selector=`.nav-item[data-view="${btn.dataset.view}"]${btn.dataset.phase?`[data-phase="${btn.dataset.phase}"]`:''}`;const nav=pq(selector);if(nav)nav.click()});
}
function normalizeSpeakers(){const w=pws();let changed=false;(w?.projects||[]).forEach(p=>(p.speakers||[]).forEach(s=>{if(s.zhName==null){s.zhName='';changed=true}if(s.company==null){s.company='';changed=true}if(s.title==null){s.title='';changed=true}if(s.name==null){s.name='';changed=true}}));if(changed)psave(w)}
function hook(){normalizeSpeakers();pqa('.nav-item[data-view="agenda"],.nav-item[data-view="overview"]').forEach(btn=>btn.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();pactivate(btn);if(btn.dataset.view==='agenda')renderAgendaV2();else renderOverviewV2()},true))}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',hook);else hook();