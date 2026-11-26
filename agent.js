(async()=>{if(!await window.rsStudyReady)return;
'use strict';
const el=id=>document.getElementById(id),API=window.SHOPPING_AGENT_API||location.origin;
let latestState=null,feedbackPending=false,feedbackAccepted=false,pendingBaseCount=0;
let run=null,polling=false,lastMessageCount=0,latestBlob=null,lastScreenshotRevision=null;
let previewSocket=null,previewLive=false,previewRetryAt=0;
function connectPreview(){
 if(!run||previewSocket||Date.now()<previewRetryAt||['closed','error','stopping'].includes(latestState?.status))return;
 const url=new URL(API+'/api/sessions/'+run.id+'/preview');url.protocol=url.protocol==='https:'?'wss:':'ws:';
 const ws=new WebSocket(url);previewSocket=ws;
 ws.onopen=()=>ws.send(JSON.stringify({token:run.token}));
 ws.onmessage=e=>{let data;try{data=JSON.parse(e.data);}catch{return;}if(data.type!=='frame')return;
  previewLive=true;el('live-screen').src='data:image/jpeg;base64,'+data.jpeg;el('live-screen').hidden=false;el('screen-empty').hidden=true;
  document.querySelector('.pointer-note').hidden=false;document.querySelector('.pointer-note').textContent='实时浏览画面';
 };
 ws.onerror=()=>ws.close();
 ws.onclose=()=>{if(previewSocket===ws){previewSocket=null;previewLive=false;previewRetryAt=Date.now()+3000;}document.querySelector('.pointer-note').textContent='浏览画面';};
}
const linkParams=new URLSearchParams(location.hash.slice(1));
const resumeId=linkParams.get('run'),resumeToken=linkParams.get('token');
if(resumeId&&resumeToken){sessionStorage.setItem('shopping_agent_session',JSON.stringify({id:resumeId,token:resumeToken}));history.replaceState({},'',location.pathname+location.search);}
const inviteFromLink=linkParams.get('invite');
if(inviteFromLink)history.replaceState({},'',location.pathname+location.search);
try{run=JSON.parse(sessionStorage.getItem('shopping_agent_session')||'null');}catch{}

async function api(path,options={}){const r=await fetch(API+path,{...options,headers:{'Content-Type':'application/json',...(run?{Authorization:'Bearer '+run.token}:{}),...options.headers}});if(!r.ok){let d;try{d=await r.json();}catch{}throw Error(d?.detail||'暂时连接不上服务器（'+r.status+'）');}return r;}
const cartDetails=window.createAgentCartDetails({api,getRun:()=>run,getState:()=>latestState,choose:confirmFinal,base:API});
function sessionUI(){el('setup').hidden=true;el('send').textContent='发送反馈';el('message').placeholder='例如：这个太贵了，改成 100 元以内；不要塑料的。';for(const id of ['stop','export'])el(id).disabled=false;}
function error(e){el('feedback-status').textContent=e.message;}
el('chat-form').onsubmit=async e=>{e.preventDefault();const text=el('message').value.trim();if(!text)return;const isFeedback=!!run;if(isFeedback){feedbackPending=true;feedbackAccepted=false;pendingBaseCount=latestState?.messages?.length||0;renderActivity(latestState);}el('send').disabled=true;try{if(!run){const participant=await window.rsIdentity.ensure();run=await(await api('/api/sessions',{method:'POST',body:JSON.stringify({scene:el('scene').value,message:text,participant_token:participant.token})})).json();sessionStorage.setItem('shopping_agent_session',JSON.stringify(run));sessionUI();}else {await api('/api/sessions/'+run.id+'/message',{method:'POST',body:JSON.stringify({text})});feedbackAccepted=true;if(latestState?.status==='paused')await api('/api/sessions/'+run.id+'/control/resume',{method:'POST'});}el('message').value='';el('feedback-status').textContent='';await poll();}catch(e){feedbackPending=false;feedbackAccepted=false;renderActivity(latestState);error(e);}finally{el('send').disabled=false;}};
function renderActivity(s){
 const messages=s?.messages||[],last=messages[messages.length-1];
 if(feedbackPending&&feedbackAccepted&&messages.length>pendingBaseCount&&last?.role==='assistant'&&!s?.queued_feedback&&['waiting_for_feedback','waiting_for_user','paused','closed','error'].includes(s?.status)){feedbackPending=false;feedbackAccepted=false;}
 if(['closed','error'].includes(s?.status)){feedbackPending=false;feedbackAccepted=false;}
 const waiting=!!s?.queued_feedback||feedbackPending;
 const active=waiting||['queued','starting','running'].includes(s?.status);
 el('agent-activity').hidden=!active;
 if(!active)return;
 const count=(s?.cart||[]).length;
 el('agent-activity-text').textContent=s?.status==='queued'?'正在等待购物助手…':waiting&&s?.status!=='running'?'已收到，正在等待助手处理…':count?'已加入 '+count+' 件，助手还在挑选…':(waiting||(s?.feedback_version||0)>1)?'正在根据你的要求调整商品…':'正在搜索和挑选商品…';
}

const statuses={queued:'正在等待空闲助手…',stopping:'正在结束，当前动作可能需要几秒钟收尾',starting:'正在启动浏览器…',running:'正在查看页面并决定下一步',waiting_for_user:'正在等你回答，再继续找',waiting_for_feedback:'已挑好候选，可以继续提要求',paused:'请补充要求，我会接着找',closed:'这次浏览已结束',error:'助手遇到问题，请稍后再试'};
let finishRequested=false,lastCartSignature='',lastToolView='';
function renderToolView(s){
 if(s.engine!=='catalog-tools'){el('tool-view').hidden=true;document.querySelector('.pointer-note').hidden=!s.has_screenshot;return;}
 document.querySelector('.pointer-note').hidden=true;
 document.querySelector('.footnote').textContent='商品价格统一为人民币参考价。';
 el('live-screen').hidden=true;
 if(!s.tool_view)return;
 el('screen-empty').hidden=true;el('tool-view').hidden=false;
 const view=s.tool_view,signature=JSON.stringify(view);if(signature===lastToolView)return;lastToolView=signature;
 el('tool-view-title').textContent=view.kind==='search_products'?'正在找：'+(view.query||'本场景商品'):'正在查看这些商品';
 el('tool-products').replaceChildren(...view.products.map(p=>{
  const card=document.createElement('article');card.className='tool-product';
  const image=document.createElement('img');image.src=p.image;image.alt='';
  const title=document.createElement('h3');title.textContent=p.title;
  const price=document.createElement('b');price.textContent='¥'+Number(p.price).toFixed(2);
  const rating=document.createElement('small');rating.textContent=p.rating?'★ '+p.rating+' · '+(p.rating_count||0)+' 条评分':'';
  card.append(image,title,price,rating);
  if(p.attributes){const specs=document.createElement('p');specs.textContent=Object.entries(p.attributes).slice(0,4).map(([k,v])=>k+'：'+(Array.isArray(v)?v.join(' / '):v)).join('；');card.append(specs);}
  return card;
 }));
 if(!view.products.length){const text=document.createElement('p');text.textContent='当前条件没有合适商品，助手正在为你调整。';el('tool-products').append(text);}
}

function renderLiveCart(s){
 const cart=s.cart||[],signature=JSON.stringify(cart);
 el('preview-cart').disabled=!run||!!s.choice||['queued','starting','stopping'].includes(s.status);
 if(signature===lastCartSignature)return;lastCartSignature=signature;
 el('live-cart-count').textContent=cart.length;
 const rows=cart.map(p=>{const row=document.createElement('button');row.className='live-cart-item';row.title=p.title;row.onclick=()=>cartDetails.open(p.id);row.setAttribute('aria-label','查看详情：'+p.title);const im=document.createElement('img');im.src=new URL(p.image,API+'/').href;im.alt='';const info=document.createElement('span'),title=document.createElement('strong'),price=document.createElement('b');title.textContent=p.title;price.textContent='¥'+Number(p.price).toFixed(2);const hint=document.createElement('small');hint.textContent='查看详情 →';info.append(title,price,hint);row.append(im,info);return row;});
 if(!rows.length){const empty=document.createElement('p');empty.className='cart-empty';empty.textContent='助手挑好的商品会出现在这里';rows.push(empty);}
 el('live-cart-items').replaceChildren(...rows);el('live-cart-update').textContent='购物车已更新，'+cart.length+' 件商品';
 if(el('agent-cart').open)showCart();
}
el('preview-cart').onclick=()=>el('finish-shopping').click();
async function poll(){if(!run||polling)return;polling=true;try{const s=await(await api('/api/sessions/'+run.id)).json();latestState=s;renderActivity(s);cartDetails.observeState(s);cartDetails.update();renderLiveCart(s);renderToolView(s);el('finish-shopping').disabled=!!s.choice||['queued','stopping','starting'].includes(s.status);el('status').textContent=s.engine==='catalog-tools'&&['starting','running'].includes(s.status)?'正在搜索和挑选商品…':s.status==='queued'?'正在等待空闲助手'+(s.queue_position?'，排在第 '+s.queue_position+' 位':''):statuses[s.status]||s.status;el('step').textContent='第 '+s.step+' 步';if(s.messages.length!==lastMessageCount){el('messages').replaceChildren(...s.messages.map(m=>{const d=document.createElement('div');d.className='message '+m.role;d.textContent=m.text.replace(/\*\*/g,'');return d;}));lastMessageCount=s.messages.length;el('messages').scrollTop=el('messages').scrollHeight;}
 el('feedback-status').textContent='';
 if(s.engine!=='catalog-tools')connectPreview();
 if(!previewLive&&s.has_screenshot&&(s.screenshot_revision||String(s.step)+s.status)!==lastScreenshotRevision){const blob=await(await api('/api/sessions/'+run.id+'/screenshot')).blob();if(!previewLive){if(latestBlob)URL.revokeObjectURL(latestBlob);latestBlob=URL.createObjectURL(blob);el('live-screen').src=latestBlob;el('live-screen').hidden=false;el('screen-empty').hidden=true;lastScreenshotRevision=s.screenshot_revision||String(s.step)+s.status;}}
 if(['closed','error'].includes(s.status)){el('send').disabled=true;el('stop').textContent='已结束';el('stop').disabled=true;previewSocket?.close();}
 if(finishRequested&&['waiting_for_user','waiting_for_feedback','paused','closed','error'].includes(s.status)){finishRequested=false;showCart();}
 if(s.choice){el('feedback-status').textContent=window.rsStudyAssignment?.protocol==='shopping-sequential-v1'?'这件选择已保存。':'本轮选择已保存。需要开始新的购物，请返回首页填写需求。';el('message').disabled=true;el('send').disabled=true;el('agent-return').hidden=false;if(!el('agent-return').dataset.ready){el('agent-return').dataset.ready='true';window.showRoundNext?.(el('agent-return'),{run_id:run.id});}}
 }catch(e){error(e);}finally{polling=false;}}
for(const command of ['stop'])el(command).onclick=async()=>{if(command==='stop'&&el('stop').textContent==='开始新一轮'){sessionStorage.removeItem('shopping_agent_session');location.reload();return;}try{await api('/api/sessions/'+run.id+'/control/'+command,{method:'POST'});await poll();}catch(e){error(e);}};
el('export').onclick=async()=>{try{const data=await(await api('/api/sessions/'+run.id+'/export')).json();const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='shopping-agent-'+run.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){error(e);}};
const entryScene=new URLSearchParams(location.search).get('scene');if(entryScene)el('scene').value=entryScene;
if(window.rsStudyAssignment?.protocol==='shopping-sequential-v1')el('scene').disabled=true;
let need=null;try{need=JSON.parse(sessionStorage.getItem('rs_need_handoff_v1'));}catch{}
// The server's current study assignment is authoritative; a leftover draft in
// this tab must not replace the confirmed need for either shopping round.
if(window.rsStudyAssignment?.context?.confirmedNeed)need=window.rsStudyAssignment.context;
if(!run&&need?.confirmedNeed&&!el('message').value.trim()){
 const request=need.confirmedNeed.currentWords||{},note=need.confirmedNeed.finalNote||'';
 const text=[request.want,request.budget?'预算：'+request.budget:'',note?'补充要求：'+note:''].filter(x=>typeof x==='string'&&x.trim()).join('\n');
 if(text){el('message').value=text;el('messages').firstElementChild.textContent='已带入你填写的购买需求，可以直接发送，也可以修改。';}
}
el('finish-shopping').onclick=async()=>{try{if(!['waiting_for_user','waiting_for_feedback','paused','closed','error'].includes(latestState?.status)){finishRequested=true;await api('/api/sessions/'+run.id+'/control/pause',{method:'POST'});el('feedback-status').textContent='正在整理购物车，当前动作完成后自动打开。';return;}showCart();}catch(e){error(e);}};
function showCart(){
 if(!el('agent-cart').open)cartDetails.record('cart_open',{item_ids:(latestState?.cart||[]).map(p=>p.id),surface:'assistant_cart'});
 el('agent-cart-items').replaceChildren(...(latestState?.cart||[]).map(p=>{
  const row=document.createElement('div');row.className='cart-row';
  const photo=document.createElement('button');photo.className='cart-photo';photo.setAttribute('aria-label','查看详情：'+p.title);
  const im=document.createElement('img');im.src=new URL(p.image,API+'/').href;im.alt='';photo.append(im);photo.onclick=()=>cartDetails.open(p.id,true);
  const info=document.createElement('div');const title=document.createElement('button');title.className='cart-title';title.textContent=p.title;title.onclick=()=>cartDetails.open(p.id,true);
  const price=document.createElement('b');price.textContent='¥'+Number(p.price).toFixed(2);
  const actions=document.createElement('div');actions.className='cart-item-actions';
  const details=document.createElement('button');details.textContent='查看详情';details.onclick=()=>cartDetails.open(p.id,true);
  const choose=document.createElement('button');choose.textContent='最终选这件';choose.onclick=()=>confirmFinal(p.id,p.title);
  actions.append(details,choose);info.append(title,price,actions);row.append(photo,info);return row;
 }));
 if(!latestState?.cart?.length)el('agent-cart-items').textContent='购物车还是空的。可以让助手把合适的候选加入购物车。';
 if(!el('agent-cart').open)el('agent-cart').showModal();
}
let pendingFinal=null, savingFinal=false;
function confirmFinal(id,title){pendingFinal={id,title};el('cancel-final').textContent=cartDetails.isOpen()?'返回商品详情':'返回购物车';el('agent-choice-title').textContent=title||'这次没有合适的商品';el('agent-choice-prompt').textContent=id?'确定这是你最想要的一件？':'确定结束本轮，不选商品？';el('final-error').textContent='';el('agent-choice').showModal();}
el('cancel-final').onclick=()=>el('agent-choice').close();
el('confirm-final').onclick=async()=>{if(!pendingFinal||savingFinal)return;savingFinal=true;el('confirm-final').disabled=true;try{await cartDetails.flush();await api('/api/sessions/'+run.id+'/selection',{method:'POST',body:JSON.stringify({item_id:pendingFinal.id})});el('agent-choice').close();el('agent-cart').close();await cartDetails.finish().catch(()=>{});sessionStorage.removeItem('shopping_agent_session');el('feedback-status').textContent='最终选择已保存，谢谢参与。';await poll();}catch(e){el('final-error').textContent=e.message;}finally{savingFinal=false;el('confirm-final').disabled=false;}};
el('close-cart').onclick=()=>el('agent-cart').close();el('agent-cart').addEventListener('close',async()=>{if(!savingFinal&&latestState?.status==='paused'){try{await api('/api/sessions/'+run.id+'/control/resume',{method:'POST'});}catch(e){error(e);}}});el('final-none').onclick=()=>confirmFinal(null);
if(run){sessionUI();poll();}setInterval(poll,1000);

})();
