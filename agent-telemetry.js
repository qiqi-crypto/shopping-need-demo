/* Identical event envelope; identity and operator source are attached by the server. */
(() => {
 const h=new URLSearchParams(location.hash.slice(1));let run=h.get('agent_run'),token=h.get('write_token');
 if(run&&token){sessionStorage.setItem('rs_agent_observer',JSON.stringify({run,token}));history.replaceState({},'',location.pathname+location.search);}
 else{try{const saved=JSON.parse(sessionStorage.getItem('rs_agent_observer'));run=saved?.run;token=saved?.token;}catch{}}
 if(run&&token){
 document.documentElement.dataset.agentBrowser='true';
 const pointer=document.createElement('div');pointer.setAttribute('aria-hidden','true');pointer.style.cssText='display:none;position:fixed;z-index:2147483647;pointer-events:none;color:#ee5816;font-size:24px;filter:drop-shadow(0 1px 2px white)';pointer.innerHTML='➤<span style="font:12px system-ui;background:white;padding:3px;border-radius:4px">上次点击</span>';
 document.addEventListener('click',e=>{if(!e.isTrusted||(!e.clientX&&!e.clientY))return;window.rsLastPointer={x:e.clientX,y:e.clientY,at:new Date().toISOString(),kind:'actual_click',label:(e.target.closest('button,a')?.textContent||'页面').trim().slice(0,60)};pointer.style.display='block';pointer.style.left=e.clientX+'px';pointer.style.top=e.clientY+'px';const host=document.querySelector('dialog[open]')||document.body;host.append(pointer);setTimeout(()=>{(document.querySelector('dialog[open]')||document.body).append(pointer);},0);},true);
 }
 const prefix='rs_event_outbox_v2:';let busy=false;
 function queued(){const q=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(prefix)){try{q.push(JSON.parse(localStorage.getItem(k)));}catch{}}}return q.sort((a,b)=>a.record.at.localeCompare(b.record.at)||a.record.event_id-b.record.event_id);}
 function owner(){return run?'run:'+run:window.rsIdentity?.get()?.participant_id;}
 window.rsSendPlatformEvent=(record,sessionId)=>{const id=owner();if(!id)return;try{localStorage.setItem(prefix+record.event_uuid,JSON.stringify({record,sessionId,owner:id}));}catch{window.rsSyncStatus?.('缓存已满，请导出本机记录并保持页面打开。');}};
 async function flush(){
  if(busy)return;const queue=queued(),id=owner(),first=queue.find(x=>x.owner===id);if(!first)return;
  const batch=queue.filter(x=>x.owner===id&&x.sessionId===first.sessionId).sort((a,b)=>a.record.event_id-b.record.event_id).slice(0,50);busy=true;
  try{
   const agent=!!run,credential=agent?token:window.rsIdentity?.get()?.token;
   const base=agent?'':(window.SHOPPING_AGENT_API||location.origin);
   const r=await fetch(base+(agent?'/api/platform/'+encodeURIComponent(run):'/api/participant/events'),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+credential},signal:typeof AbortSignal!=='undefined'?AbortSignal.timeout(8000):undefined,keepalive:JSON.stringify(batch).length<12000,body:JSON.stringify({session_id:first.sessionId,events:batch.map(x=>x.record)})});
   const d=await r.json();if(!r.ok)throw Error(typeof d.detail==='string'?d.detail:'HTTP '+r.status);
   const ack=new Set(d.acknowledged);for(const x of batch)if(ack.has(x.record.event_uuid))localStorage.removeItem(prefix+x.record.event_uuid);
   window.rsSyncStatus?.(queued().some(x=>x.owner===id)?'正在保存浏览记录…':'已保存到服务器 · '+new Date().toLocaleTimeString());
  }catch(e){window.rsSyncStatus?.('待同步 '+queue.filter(x=>x.owner===id).length+' 条 · '+e.message);}
  finally{busy=false;}
 }
 window.rsDrainPlatformEvents=async()=>{const deadline=Date.now()+12000;while(queued().some(x=>x.owner===owner())&&Date.now()<deadline){if(!busy)await flush();await new Promise(resolve=>setTimeout(resolve,100));}return {pending:queued().filter(x=>x.owner===owner()).length};};
 setInterval(flush,1200);window.addEventListener('online',flush);window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});window.rsFlushPlatformEvents=flush;
})();
