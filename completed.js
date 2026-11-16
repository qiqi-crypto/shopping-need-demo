/* This URL is not proof of completion: always check the current server state. */
(async()=>{
 const $=id=>document.getElementById(id),title=$('completion-title'),status=$('completion-status'),next=$('completion-next');
 function action(label,fn){next.textContent=label;next.hidden=false;next.onclick=fn;}
 if(!window.rsIdentity?.get()){
  title.textContent='开始你的购物体验';status.textContent='先告诉我们这次想买什么。';
  action('开始填写',()=>location.href='index.html');return;
 }
 try{
  const a=await window.rsIdentity.request('/api/participant/study');
  if(!a.completed){
   title.textContent='这次体验还没有完成';status.textContent='继续第 '+a.round_index+' 轮购物。';
   action('继续购物',()=>location.replace((a.arm==='agent_browser'?'agent.html':'catalog.html')+'?scene='+encodeURIComponent(a.context?.confirmedNeed?.lifeContext?.id||'baby')));return;
  }
  title.textContent='上一次体验已完成';status.textContent='可以再体验一次，也可以重新填写购买需求。';
  action('重新体验',()=>{
   let ctx=null;try{ctx=JSON.parse(sessionStorage.getItem('rs_need_handoff_v1'));}catch{}
   if(!ctx?.confirmedNeed)ctx=a.context;
   if(!ctx?.confirmedNeed){location.href='index.html';return;}
   sessionStorage.setItem('rs_need_handoff_v1',JSON.stringify(ctx));
   sessionStorage.setItem('rs_restart_completed_study',a.assigned_at);
   location.href='participate.html?scene='+encodeURIComponent(ctx.confirmedNeed.lifeContext?.id||'baby');
  });
 }catch{
  title.textContent='还未确认体验进度';status.textContent='请从购物入口继续。';
  action('进入购物',()=>location.href='participate.html');
 }
})();
