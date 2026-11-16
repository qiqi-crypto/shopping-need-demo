/* Identical event envelope; identity and operator source are attached by the server. */
(() => {
 const h=new URLSearchParams(location.hash.slice(1));let run=h.get('agent_run'),token=h.get('write_token');
 if(run&&token){sessionStorage.setItem('rs_agent_observer',JSON.stringify({run,token}));history.replaceState({},'',location.pathname+location.search);}
 else{try{const saved=JSON.parse(sessionStorage.getItem('rs_agent_observer'));run=saved?.run;token=saved?.token;}catch{}}
 if(run&&token){
 document.documentElement.dataset.agentBrowser='true';
 const pointer=document.createElement('div');pointer.setAttribute('aria-hidden','true');pointer.id='rs-observer-pointer';pointer.style.cssText='display:none;position:fixed;z-index:2147483647;pointer-events:none;width:24px;height:30px;filter:drop-shadow(0 1px 2px #fff)';pointer.innerHTML='<svg width="24" height="30" viewBox="0 0 24 30"><path d="M2 1L2 24L8 18L13 28L18 25L13 15L22 14Z" fill="#ee5816" stroke="white" stroke-width="1.5"/></svg>';
 const mount=()=>{const host=document.querySelector('dialog[open]')||document.body;if(pointer.parentNode!==host)host.append(pointer);};
 document.addEventListener('pointermove',e=>{if(!e.isTrusted)return;window.rsLastPointer={x:e.clientX,y:e.clientY,at:new Date().toISOString(),kind:'actual_move'};mount();pointer.style.display='block';pointer.style.left=e.clientX+'px';pointer.style.top=e.clientY+'px';},true);
 document.addEventListener('pointerdown',e=>{if(!e.isTrusted)return;pointer.style.filter='drop-shadow(0 0 5px #f45b15)';},true);
 document.addEventListener('pointerup',()=>{pointer.style.filter='drop-shadow(0 1px 2px #fff)';},true);
 document.addEventListener('click',()=>setTimeout(mount,0),true);window.addEventListener('popstate',mount);
 }
 // Same trusted-input sampler for people and browser agents; no synthetic events.
 let motion=[],motionTimer;
 function flushMotion(){if(!motion.length)return;window.rsRecordBrowserInteraction?.('pointer_move',{points:motion});motion=[];}
 document.addEventListener('pointermove',e=>{if(!e.isTrusted)return;motion.push({x:Math.round(e.clientX),y:Math.round(e.clientY),at:new Date().toISOString()});if(motion.length>=16)flushMotion();clearTimeout(motionTimer);motionTimer=setTimeout(flushMotion,180);},{capture:true,passive:true});
 document.addEventListener('click',e=>{if(!e.isTrusted)return;flushMotion();window.rsRecordBrowserInteraction?.('pointer_click',{x:Math.round(e.clientX),y:Math.round(e.clientY),button:e.button});},{capture:true,passive:true});
 window.addEventListener('pagehide',flushMotion);
 const prefix='rs_event_outbox_v2:';let busy=false;
 function queued(){const q=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(prefix)){try{q.push(JSON.parse(localStorage.getItem(k)));}catch{}}}return q.sort((a,b)=>a.record.at.localeCompare(b.record.at)||a.record.event_id-b.record.event_id);}
 function owner(){return run?'run:'+run:window.rsIdentity?.get()?.participant_id;}
 window.rsSendPlatformEvent=(record,sessionId)=>{const id=owner();if(!id)return;try{localStorage.setItem(prefix+record.event_uuid,JSON.stringify({record,sessionId,owner:id}));}catch{window.rsSyncStatus?.('缓存已满，请导出本机记录并保持页面打开。');}if(['cart_add','cart_remove'].includes(record.type))queueMicrotask(flush);};
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
