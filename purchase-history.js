/* Keep screenshot drafts across pages, then upload only with the participant's credential. */
window.purchaseHistory={
 async db(){return new Promise((resolve,reject)=>{const r=indexedDB.open('rs_purchase_history_v1',1);r.onupgradeneeded=()=>r.result.createObjectStore('draft');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(Error('截图暂存失败，请改用手动填写'));});},
 async save(files){const db=await this.db();return new Promise((resolve,reject)=>{const t=db.transaction('draft','readwrite');t.objectStore('draft').put(files,'images');t.oncomplete=()=>{db.close();resolve();};t.onerror=()=>{db.close();reject(Error('截图暂存失败，请改用手动填写'));};});},
 async load(){const db=await this.db();return new Promise((resolve,reject)=>{const r=db.transaction('draft').objectStore('draft').get('images');r.onsuccess=()=>{db.close();resolve(r.result||[]);};r.onerror=()=>{db.close();reject(Error('请返回补充订单截图'));};});},
 async submit(context){
  if(context.reportedHistorySource?.method!=='screenshot')return context;
  if(context.reportedHistorySource.uploads?.length)return context;
  const files=await this.load();if(!files.length)throw Error('请返回补充订单截图');
  const uploads=[];
  for(const file of files){
   const r=await fetch(window.SHOPPING_AGENT_API+'/api/participant/purchase-history/images',{method:'POST',headers:{Authorization:'Bearer '+window.rsIdentity.get().token,'Content-Type':file.type},body:file});
   const d=await r.json();if(!r.ok)throw Error(d.detail||'截图保存失败，请重试');uploads.push(d.upload_id);
  }
  context.reportedHistorySource={...context.reportedHistorySource,uploads,transcriptionStatus:'pending'};
  sessionStorage.setItem('rs_need_handoff_v1',JSON.stringify(context));await this.save([]);return context;
 }
};
