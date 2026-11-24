/* A newly confirmed need starts a new pair only after the previous pair ended. */
(() => {
 const $=id=>document.getElementById(id),go=$('start'),status=$('entry-status');
 $('restore-entry').onclick=()=>$('identity-connect').click();
 function update(){const connected=!!window.rsIdentity.get();$('entry-code-label').hidden=connected;$('restore-entry').hidden=connected;}
 update();window.addEventListener('rs-identity-changed',update);
 let ctx=null;try{ctx=JSON.parse(sessionStorage.getItem('rs_need_handoff_v1'));}catch{}
 const eligible=!window.SHOPPING_STUDY_CONFIG?.requirePurchaseIntent||ctx?.confirmedNeed?.currentWords?.withoutStudy==='want';
 if(ctx?.confirmedNeed&&!eligible){go.hidden=true;status.textContent='你暂不符合本次研究的参与要求，谢谢你的时间。';return;}
 if(!ctx?.confirmedNeed){go.textContent='先填写我的购买需求';go.onclick=()=>location.href='index.html';return;}
 go.onclick=async()=>{
  go.disabled=true;status.textContent='';
  try{
   await window.rsIdentity.ensure($('entry-code').value.trim());
   await window.rsLinkVisit?.();
   ctx=await window.purchaseHistory.submit(ctx);
   let a=await window.rsIdentity.request('/api/participant/study',{context:ctx});
   const freshNeed=ctx.confirmedNeed.confirmedAt&&ctx.confirmedNeed.confirmedAt!==a.context?.confirmedNeed?.confirmedAt;
   // A new questionnaire must not silently replace the two-round study's
   // original need, or be silently overwritten with the older need.
   if(!a.completed&&freshNeed&&a.context?.confirmedNeed){
    status.textContent='你还有上一轮购物未完成，请先完成之前的购物，再开始新的需求。';
    go.textContent='继续之前的购物';go.disabled=false;
    go.onclick=()=>{
     sessionStorage.setItem('rs_need_handoff_v1',JSON.stringify(a.context));
     sessionStorage.setItem('rs_study_entry',JSON.stringify(a));
     const scene=a.context.confirmedNeed?.lifeContext?.id||'baby';
     location.replace((a.arm==='agent_browser'?'agent.html':'catalog.html')+'?scene='+encodeURIComponent(scene));
    };
    return;
   }
   const explicitRestart=sessionStorage.getItem('rs_restart_completed_study')===a.assigned_at;
   if(a.completed&&(freshNeed||explicitRestart)){
    a=await window.rsIdentity.request('/api/participant/study',{
     context:ctx,restart_completed:true,previous_study_id:a.assigned_at
    });
   }
   if(a.completed){location.replace('completed.html');return;}
   let old=null;try{old=JSON.parse(sessionStorage.getItem('rs_study_entry'));}catch{}
   // Clear old round pointers, never participant identity or stored history.
   if(old?.assigned_at!==a.assigned_at){
    sessionStorage.removeItem('shopping_agent_session');sessionStorage.removeItem('rs_active_catalog_session');
   }
   sessionStorage.removeItem('rs_restart_completed_study');
   if(a.context){ctx=a.context;sessionStorage.setItem('rs_need_handoff_v1',JSON.stringify(ctx));}
   sessionStorage.setItem('rs_study_entry',JSON.stringify(a));
   const scene=ctx.confirmedNeed?.lifeContext?.id||new URLSearchParams(location.search).get('scene')||'baby';
   location.replace((a.arm==='agent_browser'?'agent.html':'catalog.html')+'?scene='+encodeURIComponent(scene));
  }catch(e){status.textContent=e.message;go.disabled=false;}
 };
})();
