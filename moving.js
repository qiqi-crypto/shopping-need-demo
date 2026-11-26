(()=>{
 const $=id=>document.getElementById(id),status=$('status');
 let state=null,mode=null,initial=null,requestId=null;
 try{initial=JSON.parse(sessionStorage.getItem('rs_need_handoff_v1')||'null');}catch{}
 const money=n=>new Intl.NumberFormat('zh-CN',{style:'currency',currency:'CNY'}).format(n);
 function setBusy(button,busy){button.disabled=busy;}
 function error(e){status.textContent=e?.message||'暂时无法连接，请重试。';}
 function modeButton(value){mode=value;for(const [id,v] of [['self','self_browser'],['agent','agent_browser']])$(id).setAttribute('aria-pressed',String(v===mode));}
 $('self').onclick=()=>modeButton('self_browser');$('agent').onclick=()=>modeButton('agent_browser');
 $('restore').onclick=()=>$('identity-connect').click();
 function updateIdentity(){const connected=!!window.rsIdentity.get();$('restore').hidden=false;$('restore').textContent=connected?'切换或恢复个人记录':'已有个人记录码？恢复记录';}
 window.addEventListener('rs-identity-changed',()=>{updateIdentity();$('resume-old').hidden=true;status.textContent='';restore();});updateIdentity();
 function goActive(a){
  if(a.context)sessionStorage.setItem('rs_need_handoff_v1',JSON.stringify(a.context));
  sessionStorage.setItem('rs_study_entry',JSON.stringify(a));
  location.replace((a.arm==='agent_browser'?'agent.html':'catalog.html')+'?v=20261126-balanced1&scene=moving');
 }
 function render(a){
  state=a;if(a.completed){location.replace('completed.html?v=20261126-balanced1');return;}
  if(a.arm){goActive(a);return;}
  $('setup').hidden=true;$('dashboard').hidden=false;
  $('budget-total').textContent=money(a.budget);$('budget-spent').textContent=money(a.spent||0);
  $('budget-remaining').textContent=a.remaining===null?'部分价格待确认':money(a.remaining);
  $('task-count').textContent='（'+a.task_count+' / 8）';
  const taskNodes=(a.tasks||[]).map(t=>{const box=document.createElement('div');box.className='task';const title=document.createElement('strong');title.textContent='第 '+t.round_index+' 件 · '+t.need;const info=document.createElement('p');info.textContent=(t.arm==='agent_browser'?'购物助手':'自己搜索')+' · '+(!t.completed_at?'进行中':t.selection_status==='no_selection'?'这次没有选择商品':t.displayed_price==null?'已选择商品':'已选择商品 · '+money(t.displayed_price));box.append(title,info);return box;});
  $('tasks').replaceChildren(...taskNodes);if(!taskNodes.length)$('tasks').textContent='还没有完成购物需求。';
  const balanced=a.allocation_rule==='balanced8_v1',counts=a.mode_counts||{},self=counts.self_browser||0,agent=counts.agent_browser||0;
  $('mode-hint').textContent=balanced?'本件开始后，完成当前需求才能为下一件重新选择方式。某种方式使用 5 次后，请使用另一种方式完成余下需求。':'本件开始后，完成当前需求才能为下一件重新选择方式。';
  $('mode-counts').textContent=balanced?'自己搜索 '+self+' 次 · 购物助手 '+agent+' 次；两种方式各至少 3 次。':'你之前开始的体验仍按原规则进行：完成 5 至 8 个需求。';
  $('self').disabled=balanced&&self>=5;$('agent').disabled=balanced&&agent>=5;
  if((mode==='self_browser'&&$('self').disabled)||(mode==='agent_browser'&&$('agent').disabled))modeButton(null);
  $('task-form').hidden=a.task_count>=8;$('finish').disabled=balanced?(a.task_count!==8||self<3||agent<3):a.task_count<5;
  if(balanced){
   if(a.task_count>=8)$('finish-hint').textContent='已完成 8 个需求，请结束体验并领取参与码。';
   else $('finish-hint').textContent='还需完成 '+(8-a.task_count)+' 个不同需求；自己搜索还需至少 '+Math.max(0,3-self)+' 次，购物助手还需至少 '+Math.max(0,3-agent)+' 次。'+(self>=5?' 自己搜索已用满 5 次，接下来请选择购物助手。':agent>=5?' 购物助手已用满 5 次，接下来请选择自己搜索。':'');
  }else if(a.task_count>=8)$('finish-hint').textContent='已完成 8 个需求，请结束体验并领取参与码。';
  else if(a.task_count>=5)$('finish-hint').textContent='你可以结束体验，也可以继续添加需求，最多 8 个。';
  else $('finish-hint').textContent='还需完成 '+(5-a.task_count)+' 个需求，之后可以结束体验；最多可完成 8 个。';
  if(!a.task_count&&initial?.confirmedNeed?.currentWords){$('need').value=initial.confirmedNeed.currentWords.want||'';$('item-budget').value=initial.confirmedNeed.currentWords.budget||'';}
 }
 async function restore(){
  if(!window.rsIdentity.get())return;
  try{const a=await window.rsIdentity.request('/api/participant/study');if(a.protocol==='shopping-sequential-v1'){if(a.completed&&sessionStorage.getItem('rs_restart_completed_study')===a.assigned_at&&initial?.confirmedNeed)return;render(a);return;}if(!a.completed){status.textContent='你有尚未完成的原购物体验，请先完成；原有记录不会被覆盖。';$('resume-old').hidden=false;$('resume-old').onclick=()=>{if(a.context)sessionStorage.setItem('rs_need_handoff_v1',JSON.stringify(a.context));const scene=a.context?.confirmedNeed?.lifeContext?.id||'baby';location.href=(a.arm==='agent_browser'?'agent.html':'catalog.html')+'?v=20261126-balanced1&scene='+encodeURIComponent(scene);};}}
  catch(e){if(e.status!==404)status.textContent='暂时无法恢复购物进度，请检查连接或切换个人记录。';}
 }
 $('start-plan').onclick=async()=>{
  status.textContent='';const budget=Number($('total-budget').value);
  if(!Number.isFinite(budget)||budget<=0||budget>10000000){status.textContent='请输入有效的搬家购物总预算。';return;}
  if(!initial?.confirmedNeed||initial.confirmedNeed.lifeContext?.id!=='moving'){status.textContent='请先从首页选择搬家场景并填写需求。';return;}
  setBusy($('start-plan'),true);
  try{
   await window.rsIdentity.ensure();await window.rsLinkVisit?.();
   initial=await window.purchaseHistory.submit(initial);
   const a=await window.rsIdentity.request('/api/participant/sequential/start',{context:initial,budget});sessionStorage.removeItem('rs_restart_completed_study');render(a);
  }catch(e){error(e);}finally{setBusy($('start-plan'),false);}
 };
 $('task-form').onsubmit=async e=>{
  e.preventDefault();status.textContent='';const need=$('need').value.trim(),budget=$('item-budget').value.trim();
  if(!need){status.textContent='请先填写这次想买什么。';return;}if(!mode){status.textContent='请选择自己搜索或让购物助手帮忙。';return;}
  requestId=requestId||crypto.randomUUID();setBusy($('start-task'),true);
  try{const a=await window.rsIdentity.request('/api/participant/sequential/task',{request_id:requestId,need,item_budget:budget,arm:mode});requestId=null;if(a.arm)goActive(a);else render(a);}catch(e){error(e);}finally{setBusy($('start-task'),false);}
 };
 $('finish').onclick=async()=>{status.textContent='';setBusy($('finish'),true);try{const a=await window.rsIdentity.request('/api/participant/sequential/finish',{});if(a.completed)location.href='completed.html?v=20261126-balanced1';}catch(e){error(e);setBusy($('finish'),false);}};
 restore();
})();
