/* Credentials stay in existing participant storage; Algolia keys stay on the server. */
(()=>{'use strict';
const $=id=>document.getElementById(id),API=window.ALGOLIA_PILOT_API||window.SHOPPING_AGENT_API||location.origin;
let ready=false,run=null,timer=null,busy=false;
const saved=()=>JSON.parse(sessionStorage.getItem('rs_algolia_pilot')||'null');
const text=(tag,value,cls)=>{const el=document.createElement(tag);el.textContent=value;if(cls)el.className=cls;return el;};
async function request(path,body){const token=window.rsIdentity.get()?.token;if(!token)throw Error('请先连接我的记录。');const r=await fetch(API+'/api/algolia'+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok)throw Error(typeof d.detail==='string'?d.detail:'请求失败');return d;}
function error(e){$('status').textContent=e.message||String(e);}
async function check(){try{if(window.ALGOLIA_PILOT_EXPIRES_AT&&Date.now()>=Date.parse(window.ALGOLIA_PILOT_EXPIRES_AT))throw Error('本次临时测试入口已到期关闭，等待重新开启。');const r=await fetch(API+'/api/algolia/status');if(!r.ok)throw Error('Algolia 测试接口暂时无法连接。');const d=await r.json();ready=d.ready;$('connection').textContent=ready?d.message:'测试接口已连通；Agent 仍是草稿，尚未绑定模型服务。搜索对话暂未开放，不会调用付费模型。';$('send').disabled=!ready;}catch(e){ready=false;$('send').disabled=true;$('connection').textContent=e.message;}}
function card(p){const box=document.createElement('article');box.className='product';const img=document.createElement('img');const source=p.images?.[0]?.src;if(source){const u=new URL(source,location.href);if(['https:','http:'].includes(u.protocol))img.src=u.href;}img.alt=p.title||'';box.append(img,text('p',p.title),text('div','¥'+Number(p.display_price).toFixed(2),'price'));return box;}
function render(s){$('new-run').disabled=s.status==='running';$('messages').replaceChildren(...s.dialogue.map(m=>text('div',m.text,'message '+m.role)));$('messages').scrollTop=$('messages').scrollHeight;
const products=s.products||{};$('products').replaceChildren(...s.candidates.filter(i=>products[i]).map(i=>card(products[i])));if(!s.candidates.length)$('products').append(text('p','还没有返回可展示的商品。'));
$('cart-count').textContent=s.cart.length;$('cart-items').replaceChildren(...s.cart.filter(i=>products[i]).map(i=>text('div',products[i].title+' · ¥'+Number(products[i].display_price).toFixed(2),'cart-item')));if(!s.cart.length)$('cart-items').textContent='购物车为空';
$('detail').hidden=!s.detail;if(s.detail&&products[s.detail]){const p=products[s.detail];$('detail').replaceChildren(text('h2','助手正在查看：'+p.title),text('p',p.description||''),text('p',(p.features||[]).join('\n')));}
const labels={running:'助手正在查找；可以继续补充要求。',waiting_for_feedback:'可以评价候选商品，或请助手加入购物车。',error:'本轮失败已保存：'+(s.error||''),interrupted:'服务中断，记录已保留，请另开一轮。',limit:'本轮达到调用上限，记录已保留。',idle:'请输入本次购物需求。'};$('status').textContent=labels[s.status]||s.status;$('send').textContent='发送补充要求';$('download').disabled=false;
clearTimeout(timer);if(s.status==='running')timer=setTimeout(poll,1500);}
async function poll(){if(!run)return;try{render(await request('/runs/'+run));}catch(e){clearTimeout(timer);error(e);}}
$('chat-form').onsubmit=async e=>{e.preventDefault();if(!ready||busy)return;busy=true;$('send').disabled=true;try{const identity=window.rsIdentity.get();if(!identity)throw Error('请先点击“连接我的记录”，使用体验访问码连接。');if(!run){const s=await request('/runs',{});run=s.id;sessionStorage.setItem('rs_algolia_pilot',JSON.stringify({id:run,participant:identity.participant_id}));}await request('/runs/'+run+'/message',{text:$('message').value});$('message').value='';await poll();}catch(e){error(e);}finally{busy=false;$('send').disabled=!ready;}};
$('new-run').onclick=()=>{clearTimeout(timer);run=null;sessionStorage.removeItem('rs_algolia_pilot');$('messages').replaceChildren();$('products').replaceChildren(text('p','新一轮开始后显示候选商品。'));$('detail').hidden=true;$('cart-count').textContent='0';$('cart-items').textContent='购物车为空';$('send').textContent='开始帮我找';$('status').textContent='此前记录仍在服务器保留。';$('download').disabled=true;};
$('refresh-cart').onclick=poll;$('retry').onclick=check;
$('download').onclick=async()=>{try{if(!run)return;const d=await request('/runs/'+run+'/export');const u=URL.createObjectURL(new Blob([JSON.stringify(d,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download='algolia-engineering-'+run+'.json';a.click();URL.revokeObjectURL(u);}catch(e){error(e);}};
window.addEventListener('rs-identity-changed',()=>{clearTimeout(timer);run=null;const s=saved();if(s?.participant===window.rsIdentity.get()?.participant_id){run=s.id;poll();}});
try{const s=saved();if(s?.participant===window.rsIdentity.get()?.participant_id)run=s.id;}catch{sessionStorage.removeItem('rs_algolia_pilot');}
check().then(()=>{if(run)poll();});
})();
