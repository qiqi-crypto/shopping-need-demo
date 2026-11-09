/* Only the server-run browser receives a write-only token. Never a source feature. */
(() => {
 const h=new URLSearchParams(location.hash.slice(1));let run=h.get('agent_run'),token=h.get('write_token');
 if(run&&token)sessionStorage.setItem('rs_agent_observer',JSON.stringify({run,token}));
 else{try{const saved=JSON.parse(sessionStorage.getItem('rs_agent_observer'));run=saved?.run;token=saved?.token;}catch{}}
 if(!run||!token)return;
 history.replaceState({},'',location.pathname+location.search);
 const queue=[];let busy=false;
 window.rsSendPlatformEvent=(record,sessionId)=>{queue.push({record,sessionId});};
 async function flush(){if(busy||!queue.length)return;busy=true;const batch=queue.slice(0,100);try{const r=await fetch('/api/platform/'+encodeURIComponent(run),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({session_id:batch[0].sessionId,events:batch.map(x=>x.record)}),keepalive:true});if(!r.ok)throw Error(r.status);queue.splice(0,batch.length);}catch(e){console.warn('Telemetry pending',e.message);}finally{busy=false;}}
 setInterval(flush,400);window.addEventListener('pagehide',flush);window.rsFlushPlatformEvents=flush;
 document.documentElement.dataset.agentBrowser='true';
})();
