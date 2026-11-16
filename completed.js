/* Server-verified completion only. A URL or local flag cannot issue a code. */
(async()=>{
 const $=id=>document.getElementById(id),title=$('completion-title'),status=$('completion-status'),next=$('completion-next');
 const receipt=$('completion-receipt'),code=$('completion-code'),copy=$('completion-copy'),copyStatus=$('copy-status');
 function action(label,fn){next.textContent=label;next.hidden=false;next.onclick=fn;}
 if(!window.rsIdentity?.get()){
  title.textContent='开始你的购物体验';status.textContent='先告诉我们这次想买什么。';
  action('开始填写',()=>location.href='index.html');return;
 }
 async function load(){
  next.hidden=true;receipt.hidden=true;
  try{
   const a=await window.rsIdentity.request('/api/participant/study');
   if(!a.completed){
    title.textContent='这次体验还没有完成';status.textContent='继续第 '+a.round_index+' 轮购物，完成两轮后领取参与码。';
    action('继续购物',()=>location.replace((a.arm==='agent_browser'?'agent.html':'catalog.html')+'?scene='+encodeURIComponent(a.context?.confirmedNeed?.lifeContext?.id||'baby')));return;
   }
   const saved=await window.rsIdentity.request('/api/participant/study/completion-code',{});
   if(!/^RS[A-F0-9]{24}$/.test(saved.code))throw Error('参与码暂未生成，请重试');
   title.textContent='两轮购物已完成，谢谢参与！';
   status.textContent='最后一步：复制下方参与码，返回 Credamo 问卷粘贴并提交，才算完成本次问卷。';
   code.value=saved.code;receipt.hidden=false;
   copy.onclick=async()=>{
    try{await navigator.clipboard.writeText(code.value);copy.textContent='已复制参与码';copyStatus.textContent='请返回 Credamo 问卷，粘贴参与码并提交。';}
    catch{code.focus();code.select();copyStatus.textContent='已选中参与码，请长按或按 Ctrl+C / ⌘C 复制，再填回 Credamo。';}
   };
  }catch{
   title.textContent='正在领取参与码';status.textContent='暂时无法连接，请重试。已完成的购物无需重做。';
   action('重新领取参与码',load);
  }
 }
 await load();
})();
