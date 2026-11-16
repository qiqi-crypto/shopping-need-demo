/* Durable per-event outbox. Separate page streams prevent cross-tab sequence collisions. */
window.rsCreateJournal=function({owner,sessionPrefix,transport,metadata={}}){
 const prefix='rs_durable_v3:'+owner+':',id=sessionPrefix+crypto.randomUUID();let seq=0,busy=null,ended=false;
 function pending(){const rows=[];for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k?.startsWith(prefix)){try{rows.push({key:k,...JSON.parse(localStorage.getItem(k))});}catch{}}}return rows.sort((a,b)=>a.record.at.localeCompare(b.record.at)||a.record.event_id-b.record.event_id);}
 async function flush(){
  if(busy)return busy;
  busy=(async()=>{for(let batches=0;batches<20;batches++){
   const rows=pending();if(!rows.length)return;const sessionId=rows[0].sessionId;
   const batch=rows.filter(x=>x.sessionId===sessionId).sort((a,b)=>a.record.event_id-b.record.event_id).slice(0,40);
   const reply=await transport(sessionId,batch.map(x=>x.record));const ack=new Set(reply.acknowledged||[]);
   if(!batch.every(x=>ack.has(x.record.event_uuid)))throw Error('部分记录尚未保存，请保持页面连接。');
   for(const row of batch)localStorage.removeItem(row.key);
  }})();try{await busy;}finally{busy=null;}
 }
 function record(type,data={}){
  if(ended)return;
  const e={...metadata,...data,type,schema_version:'rs-platform-event-v3',event_id:++seq,event_uuid:crypto.randomUUID(),at:new Date().toISOString(),...(window.rsEventClock?.envelope()||{}),viewport:{width:innerWidth,height:innerHeight}};
  try{localStorage.setItem(prefix+e.event_uuid,JSON.stringify({sessionId:id,record:e}));}catch{window.rsSyncStatus?.('浏览器缓存已满，记录尚未保存。');throw Error('浏览记录缓存已满');}
  if(['session_started','session_ended','cart_open','item_considered','page_exit'].includes(type))queueMicrotask(()=>flush().catch(()=>{}));
  return e;
 }
 record('session_started');const timer=setInterval(()=>flush().catch(()=>{}),1200);
 window.addEventListener('online',()=>flush().catch(()=>{}));window.addEventListener('pagehide',()=>flush().catch(()=>{}));
 return {id,record,flush,pending:()=>pending().length,finish:async(status)=>{if(!ended){record('session_ended',{status});ended=true;}await flush();clearInterval(timer);}};
};
