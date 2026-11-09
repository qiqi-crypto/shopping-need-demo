/* Participant-facing pages cannot offer a mode switch. The server owns assignment. */
window.rsStudyReady=(async()=>{
 const agentObserver=new URLSearchParams(location.hash.slice(1)).has('agent_run')||sessionStorage.getItem('rs_agent_observer');
 if(agentObserver)return true;
 document.documentElement.classList.add('study-loading');
 try{if(!window.rsIdentity?.get())throw Error('entry');const a=await window.rsIdentity.request('/api/participant/study');const target=a.arm==='agent_browser'?'agent.html':'catalog.html';
 if(!location.pathname.endsWith(target)){location.replace(target+location.search);return false;}
 document.documentElement.classList.remove('study-loading');return true;
 }catch{location.replace('participate.html'+location.search);return false;}
})();
