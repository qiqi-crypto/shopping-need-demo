/* Participant-facing pages cannot offer a mode switch. The server owns assignment. */
window.rsStudyReady=(async()=>{
 const agentObserver=new URLSearchParams(location.hash.slice(1)).has('agent_run')||sessionStorage.getItem('rs_agent_observer');
 if(agentObserver)return true;
 document.documentElement.classList.add('study-loading');
 try{if(!window.rsIdentity?.get())throw Error('entry');const a=await window.rsIdentity.request('/api/participant/study');if(a.completed){location.replace('completed.html?v=20261126-open2');return false;}if(a.protocol==='shopping-sequential-v1'&&!a.arm){location.replace('moving.html?v=20261126-balanced1');return false;}window.rsStudyAssignment=a;try{const old=JSON.parse(sessionStorage.getItem('shopping_agent_session'));if(old&&a.arm==='agent_browser'&&old.id!==a.active_run_id)sessionStorage.removeItem('shopping_agent_session');}catch{}if(a.context)sessionStorage.setItem('rs_need_handoff_v1',JSON.stringify(a.context));const target=a.arm==='agent_browser'?'agent.html':'catalog.html';
 if(!location.pathname.endsWith(target)){location.replace(target+location.search);return false;}
 document.documentElement.classList.remove('study-loading');window.rsSyncStatus?.((a.protocol==='shopping-sequential-v1'?'第 '+a.round_index+' 个需求':'第 '+a.round_index+' / 2 轮')+' · '+(a.arm==='agent_browser'?'购物助手代挑':'自己挑选'));return true;
 }catch{location.replace('participate.html'+location.search);return false;}
})();
