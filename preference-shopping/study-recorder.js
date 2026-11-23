/* Study actions are sent in idempotent batches; the server stores them append-only. */
(function(){
'use strict';
window.createStudyRecorder=function(config){
 const pendingKey='study-event-outbox-v1:'+config.experiment+':'+config.participantId;
 const startKey='study-event-start-v1:'+config.experiment+':'+config.participantId;
 let started=Date.now(), queue=[], flight=null, storageOK=true;
 try{const old=Number(sessionStorage.getItem(startKey));if(old>0)started=old;else sessionStorage.setItem(startKey,String(started));}catch{}
 try{const saved=JSON.parse(localStorage.getItem(pendingKey)||'[]');if(Array.isArray(saved))queue=saved;}catch{storageOK=false}
 function persist(){try{localStorage.setItem(pendingKey,JSON.stringify(queue));storageOK=true;}catch{storageOK=false;}}
 function context(){try{return config.getContext()||{}}catch{return {}}}
 function add(kind,detail={}){
  if(config.engineeringTest)detail.engineering_test=true;
  const c=context(),round=Number.isInteger(c.round)?Math.max(0,Math.min(2,c.round)):null;
  if(c.mode==='human'||c.mode==='ai')detail.mode=c.mode;
  queue.push({id:crypto.randomUUID(),kind,at:new Date().toISOString(),elapsed_ms:Math.max(0,Date.now()-started),phase:String(c.phase||'').slice(0,60),round,detail});
  persist();if(!storageOK||queue.length>=35)void flush().catch(()=>{});
 }
 function nextBatch(items){
  const batch=[];let size=512;
  for(const item of items){const n=new TextEncoder().encode(JSON.stringify(item)).length+1;if(batch.length&&(batch.length>=40||size+n>50000))break;batch.push(item);size+=n;}
  return batch;
 }
 async function send(batch){
  const response=await fetch(config.apiBase+'/api/preference/results',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({record_type:'events',experiment:config.experiment,participant_id:config.participantId,events:batch}),signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw Error('操作记录暂时无法保存，请检查网络后重试。');
  const data=await response.json();
  const expected=new Set(batch.map(x=>x.id));
  if(!Array.isArray(data.accepted)||data.accepted.length!==expected.size||data.accepted.some(id=>!expected.has(id)))throw Error('操作记录暂时无法确认，请重试。');
  queue=queue.filter(x=>!expected.has(x.id));persist();
 }
 function flush(){
  if(flight)return flight;
  flight=(async()=>{while(queue.length)await send(nextBatch(queue));})().finally(()=>{flight=null});
  return flight;
 }
 async function recoverOlderOutboxes(){
  // A tab can be closed before delivery. Retry its saved batches on a later
  // visit to this same study, preserving the original participant ID.
  const prefix='study-event-outbox-v1:'+config.experiment+':';
  try{
   const keys=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith(prefix)&&k!==pendingKey)keys.push(k)}
   for(const key of keys){
    const participant=key.slice(prefix.length);if(!/^[A-Za-z0-9_-]{10,100}$/.test(participant))continue;
    let old=JSON.parse(localStorage.getItem(key)||'[]');
    while(Array.isArray(old)&&old.length){
     const batch=nextBatch(old),response=await fetch(config.apiBase+'/api/preference/results',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({record_type:'events',experiment:config.experiment,participant_id:participant,events:batch}),signal:AbortSignal.timeout(20000)});
     if(!response.ok)break;const data=await response.json(),ids=new Set(batch.map(x=>x.id));
     if(!Array.isArray(data.accepted)||data.accepted.length!==ids.size||data.accepted.some(id=>!ids.has(id)))break;
     const current=JSON.parse(localStorage.getItem(key)||'[]');old=current.filter(x=>!ids.has(x.id));localStorage.setItem(key,JSON.stringify(old));
    }
   }
  }catch{} // Retain the outbox and retry on the next visit.
 }
 function sendOnLeave(){
  if(!queue.length||!navigator.sendBeacon)return;
  try{navigator.sendBeacon(config.apiBase+'/api/preference/results',new Blob([JSON.stringify({record_type:'events',experiment:config.experiment,participant_id:config.participantId,events:nextBatch(queue)})],{type:'text/plain'}));}catch{}
 }
 document.addEventListener('click',event=>{
  if(!event.isTrusted||!event.target.closest('main,dialog'))return;
  const node=event.target.closest('button,a,input,select,textarea,[role="button"]')||event.target;
  const product=node.closest('[data-record-product]'),post=node.closest('[data-record-post]');
  const detail={tag:node.tagName.toLowerCase(),id:String(node.id||'').slice(0,80),x:Math.round(event.clientX),y:Math.round(event.clientY)};
  if(node.matches('button,a,[role="button"]'))detail.label=String(node.innerText||node.getAttribute('aria-label')||'').trim().slice(0,120);
  for(const key of ['value','choice','select','view','group','q','comparison'])if(node.dataset&&node.dataset[key]!=null)detail[key]=String(node.dataset[key]).slice(0,120);
  if(product)detail.product_id=String(product.dataset.recordProduct||'').slice(0,120);
  if(post)detail.post_id=String(post.dataset.recordPost||'').slice(0,120);
  add('click',detail);
 },true);
 document.addEventListener('change',event=>{
  if(!event.isTrusted||!event.target.closest('main,dialog'))return;
  const node=event.target;if(!node.matches('input,select,textarea')||['password','file','hidden'].includes(node.type))return;
  const detail={tag:node.tagName.toLowerCase(),id:String(node.id||'').slice(0,80),name:String(node.name||'').slice(0,80),type:String(node.type||'').slice(0,40)};
  if(node.type!=='checkbox'&&node.type!=='radio'||node.checked)detail.value=String(node.value||'').slice(0,600);
  if(node.type==='checkbox'||node.type==='radio')detail.checked=!!node.checked;
  add('change',detail);
 },true);
 document.addEventListener('visibilitychange',()=>{add('visibility',{state:document.visibilityState});if(document.hidden){sendOnLeave();void flush().catch(()=>{});}});
 window.addEventListener('pagehide',()=>{add('page_leave',{});sendOnLeave();});
 window.addEventListener('online',()=>{void flush().catch(()=>{});void recoverOlderOutboxes();});
 setInterval(()=>void flush().catch(()=>{}),5000);
 add('page_open',{storage_available:storageOK});void flush().catch(()=>{});void recoverOlderOutboxes();
 return {flush,checkpoint:(detail)=>add('checkpoint',detail||{}),pendingCount:()=>queue.length};
};
})();
