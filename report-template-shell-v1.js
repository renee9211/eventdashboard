const $=(s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
function active(){return $$('.nav-item.active').some(x=>x.dataset.view==='report-template')}
function ensure(){
  if(!active())return;
  const root=$('#viewRoot'); if(!root||$('#reportTemplateManager'))return;
  if(!$('#formContent',root)){
    root.innerHTML=`<div class="page"><div class="section-head"><div><div class="eyebrow">REPORT TEMPLATE</div><h2>Report Template</h2><p>Upload and map a client PowerPoint template for report generation.</p></div></div><div id="formContent"></div></div>`;
  }
}
document.addEventListener('click',e=>{if(e.target.closest?.('.nav-item[data-view="report-template"]'))setTimeout(ensure,20)});
const root=$('#viewRoot');if(root)new MutationObserver(()=>setTimeout(ensure,0)).observe(root,{childList:true,subtree:true});
setTimeout(ensure,400);
