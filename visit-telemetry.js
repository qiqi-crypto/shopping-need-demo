/* Entry-page presence, not raw questionnaire input or order screenshots. */
(()=>{
 const API=window.SHOPPING_AGENT_API||location.origin,key='rs_visit_v1';let current,linking=null;
 const page=location.pathname.split('/').pop()||'index.html';
 function fresh(){return {local_id:crypto.randomUUID(),token:crypto.randomUUID()+crypto.randomUUID()};}
 function start(credential){
  const headers={'Content-Type':'application/json',Authorization:'Bearer '+credential.token};let ready=null;
  const save=()=>localStorage.setItem(key,JSON.stringify(credential));save();
  async function connect(){
   if(!ready)ready=(async()=>{const r=await fetch(API+'/api/visits',{method:'POST',headers,body:JSON.stringify({token:credential.token})});if(!r.ok)throw Error('访客记录连接失败');credential.visitor_id=(await r.json()).visitor_id;save();})();
   try{await ready;}catch(e){ready=null;throw e;}
  }
  const journal=window.rsCreateJournal({owner:'visit:'+credential.local_id,sessionPrefix:'visit-',metadata:{page},transport:async(sessionId,events)=>{
   await connect();const r=await fetch(API+'/api/visits/events',{method:'POST',headers,keepalive:JSON.stringify(events).length<12000,body:JSON.stringify({session_id:sessionId,events})});if(!r.ok)throw Error('访客记录待同步');return r.json();
  }});
  const stop=window.rsStartPresence(journal.record,()=>true,()=>({page}));
  window.rsVisitCredential=credential;return {credential,connect,journal,stop,save};
 }
 let credential;try{credential=JSON.parse(localStorage.getItem(key));}catch{}
 const identity=window.rsIdentity?.get();
 if(credential?.linked_participant_id&&identity&&credential.linked_participant_id!==identity.participant_id)credential=null;
 current=start(credential||fresh());
 window.rsVisitEvent=(type,data)=>current.journal.record(type,data);
 document.addEventListener('click',e=>{if(!e.isTrusted)return;const button=e.target.closest('button,a');if(button?.id)current.journal.record('ui_click',{control_id:button.id});},true);
 window.addEventListener('pagehide',()=>current.journal.record('page_exit'));
 async function link(){
  const identity=window.rsIdentity?.get();if(!identity)return;
  for(let attempt=0;attempt<2;attempt++){
   const visit=current;await visit.connect();
   const r=await fetch(API+'/api/participant/visit-link',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+identity.token},body:JSON.stringify({token:visit.credential.token})});
   if(r.ok){visit.credential.linked_participant_id=identity.participant_id;visit.save();return;}
   if(r.status===409&&attempt===0){
    // Shared browsers may change participant. Never relabel the previous person's visits.
    visit.stop();await visit.journal.finish('identity_changed');current=start(fresh());continue;
   }
   throw Error('入口记录暂未关联，请稍后重试。');
  }
 }
 window.rsLinkVisit=()=>{if(!linking)linking=link().finally(()=>{linking=null;});return linking;};
 window.addEventListener('rs-identity-changed',()=>window.rsLinkVisit().catch(()=>{}));
 window.rsLinkVisit().catch(()=>{});
})();
