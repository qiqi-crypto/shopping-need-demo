/* Advance only after the server has the current round's terminal choice. */
window.showRoundNext=async function(container,reference){
 if(!window.rsIdentity?.get())return;
 const button=document.createElement('button');button.className='outcome-return primary';
 const status=document.createElement('p');status.setAttribute('role','status');
 button.textContent='正在保存本轮…';button.disabled=true;container.append(status,button);
 async function prepare(){
  button.disabled=true;status.textContent='';
  try{
   if(reference.client_id){const pending=await window.rsDrainPlatformEvents?.();if(pending?.pending)throw Error('保存尚未完成，请重试');}
   const a=await window.rsIdentity.request('/api/participant/study/complete',reference);
   sessionStorage.setItem('rs_study_entry',JSON.stringify(a));
   button.textContent=a.completed?'两轮已完成，返回首页':'继续第二轮：'+(a.arm==='agent_browser'?'购物助手代挑':'自己挑选')+' →';
   status.textContent=a.completed?'两轮均已完成，谢谢参与！':'第一轮已完成。下一轮沿用这次购买需求，请重新挑选。';
   button.disabled=false;button.onclick=()=>{
    sessionStorage.removeItem('shopping_agent_session');sessionStorage.removeItem('rs_active_catalog_session');
    location.href=a.completed?'completed.html':(a.arm==='agent_browser'?'agent.html':'catalog.html')+location.search;
   };
  }catch(e){status.textContent=e.message;button.textContent='重试保存，继续下一步';button.disabled=false;button.onclick=prepare;}
 }
 await prepare();
};
