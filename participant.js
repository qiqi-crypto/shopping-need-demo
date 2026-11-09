/* Shared identity for self-browsing and Agent. Personal recovery code never enters telemetry. */
(() => {
 const key='rs_participant_v2',API=window.SHOPPING_AGENT_API||location.origin;
 let identity=null;try{identity=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 const authHeaders=()=>({'Content-Type':'application/json',...(identity?{Authorization:'Bearer '+identity.token}:{})});
 async function request(path,body){const r=await fetch(API+path,{method:body?'POST':'GET',headers:authHeaders(),...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(typeof d.detail==='string'?d.detail:'服务器暂时不可用');return d;}
 function remember(d){if(identity&&identity.participant_id!==d.participant_id&&sessionStorage.getItem('shopping_agent_session'))throw Error('请先在 Agent 页结束本轮并点击开始新一轮，再切换参与者。');identity=d;localStorage.setItem(key,JSON.stringify(d));window.dispatchEvent(new CustomEvent('rs-identity-changed'));update();return d;}
 async function ensure(invite){if(identity){await request('/api/participant');return identity;}return remember(await request('/api/participants',{invite}));}
 window.rsIdentity={get:()=>identity,ensure,request};
 const agentBrowser=!!sessionStorage.getItem('rs_agent_observer')||new URLSearchParams(location.hash.slice(1)).has('agent_run');
 if(agentBrowser)return;
 const box=document.createElement('section');box.className='participant-bar';box.innerHTML=`<div><strong id="identity-label">浏览记录尚未连接服务器</strong> <span id="sync-label">连接后，自己逛和 Agent 代逛会归到同一个人。</span></div><div><button id="identity-connect" type="button">连接我的记录</button><a href="history.html">我的购物历史</a></div>`;
 document.body.insertBefore(box,document.body.firstChild);
 const modal=document.createElement('dialog');modal.className='participant-dialog';modal.innerHTML=`<form method="dialog"><button class="close-account" aria-label="关闭记录设置">×</button></form><h2>同一个人，多次逛</h2><p>连接后，搜索、查看、比较和选择会保存到实验服务器。这里不产生订单。</p><label>第一次使用：体验访问码<input id="account-invite" type="password" autocomplete="off" placeholder="邀请人提供的访问码"></label><button id="account-new" type="button">创建我的记录</button><hr><label>已有记录：个人记录码<input id="account-recovery" type="password" autocomplete="off" placeholder="粘贴以前保存的个人记录码"></label><button id="account-restore" type="button">恢复我的记录</button><button id="account-copy" type="button">复制我的个人记录码</button><p>换浏览器或设备时，用个人记录码继续。请勿分享；它可以读取你的记录。</p><button id="account-switch" type="button">切换参与者（保留历史）</button><p id="account-error" role="status"></p>`;document.body.append(modal);
 const q=id=>document.getElementById(id);
 function update(){q('identity-label').textContent=identity?'我的记录 · '+identity.participant_id.slice(-8):'浏览记录尚未连接服务器';q('identity-connect').textContent=identity?'记录设置':'连接我的记录';q('account-new').disabled=!!identity;}
 window.rsSyncStatus=text=>{q('sync-label').textContent=text;};
 q('identity-connect').onclick=()=>{q('account-invite').value=sessionStorage.getItem('shopping_agent_invite')||'';modal.showModal();};
 q('account-new').onclick=async()=>{try{const code=q('account-invite').value.trim();await ensure(code);sessionStorage.setItem('shopping_agent_invite',code);modal.close();}catch(e){q('account-error').textContent=e.message;}};
 q('account-restore').onclick=async()=>{try{const token=q('account-recovery').value.trim();const r=await fetch(API+'/api/participant',{headers:{Authorization:'Bearer '+token}});const d=await r.json();if(!r.ok)throw Error(d.detail||'记录码不正确');remember({participant_id:d.participant_id,token});modal.close();}catch(e){q('account-error').textContent=e.message;}};
 q('account-switch').onclick=()=>{if(sessionStorage.getItem('shopping_agent_session')){q('account-error').textContent='请先在 Agent 页结束本轮并点击开始新一轮，再切换。';return;}identity=null;localStorage.removeItem(key);q('account-recovery').value='';window.dispatchEvent(new CustomEvent('rs-identity-changed'));update();q('account-error').textContent='已退出，服务器历史保留。用原个人记录码可恢复；也可以创建下一位参与者的记录。';};
 q('account-copy').onclick=async()=>{if(!identity){q('account-error').textContent='请先连接记录。';return;}try{await navigator.clipboard.writeText(identity.token);q('account-error').textContent='已复制。请私下保存，不要发给其他参与者。';}catch{q('account-recovery').value=identity.token;q('account-error').textContent='请从个人记录码输入框手动复制。';}};
 update();
 if(identity)request('/api/participant').then(()=>window.rsSyncStatus('已连接；浏览时自动保存。')).catch(e=>window.rsSyncStatus('尚未连通：'+e.message+'。新记录会在本机等待同步。'));
})();
