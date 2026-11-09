'use strict';
// Platform observations and private questionnaire answers are stored separately.
// This preview never infers or fabricates a Human/Agent ground-truth label.
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
// Hard publication gate: both a sourced positive price and a validated local image.
const allItems = window.M5_CATALOG.items.filter(p => Number.isFinite(p.price) && p.price > 0 && p.price_status === 'source_crawl_price' && p.images?.[0]?.src);
const priceLabel = p => new Intl.NumberFormat('zh-CN',{style:'currency',currency:p.currency||'USD',currencyDisplay:'code'}).format(p.price);
const fxReference = window.M5_CATALOG.fx_reference;
const cnyReference = p => p.currency==='USD' && fxReference ? '≈ ¥'+(p.price*fxReference.rate).toFixed(2)+' 人民币参考（换算）' : '';
const ratingLabel = p => Number.isFinite(p.rating) && p.rating > 0 ? `★ ${p.rating.toFixed(1)}${p.rating_count ? ' · '+p.rating_count+' 个评分' : ''}` : '';
const attributesOf = p => Object.fromEntries(Object.entries(p.attributes||{}).filter(([k,v])=>k && Array.isArray(v) && v.some(x=>String(x).trim())));
const itemMap = new Map(allItems.map(p => [p.id, p]));
const SCENES = {baby:'母婴用品',pets:'宠物生活',moving:'搬家家居',sports:'运动户外'};
const SCENE_COPY = {baby:['母婴好物','从喂养到出行，给成长中的每一天多一点准备。'],pets:['宠物生活','吃饭、玩耍、出门，照顾它的日常小事。'],moving:['住进喜欢的生活','收纳、清洁与家居用品，让新家一点点有模样。'],sports:['准备好，动起来','从日常锻炼到户外出行，找到顺手的运动装备。']};
const STORE_KEY = 'rs_m5_store_v1';
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));
let storageOkay = true;
function load(key, fallback) {try {return JSON.parse(localStorage.getItem(key)) || fallback;} catch {storageOkay=false;return fallback;}}
let db = load(STORE_KEY, {version:1,user_id:'local-'+uid(),sessions:[]});
let researchContext = null;
try {researchContext=JSON.parse(sessionStorage.getItem('rs_need_handoff_v1') || 'null');} catch {}
const initialScene = new URLSearchParams(location.search).get('scene');
let scene = SCENES[initialScene] ? initialScene : 'baby';
let group = '', query = '', sort = 'default', page = 1, shown = [], visible = new Set(), compared = new Set();
let detailOpenedAt = null;
let currentItem = null, pendingChoice = null, variants = {}, pageViewId = '', availableSnapshot = null;
let session, observer;
function save() {try {localStorage.setItem(STORE_KEY,JSON.stringify(db));} catch {storageOkay=false;}}
function startSession() {
 const previous=db.sessions.at(-1), now=new Date().toISOString();
 session={session_id:'session-'+uid(),user_id:db.user_id,started_at:now,
  session_gap_seconds:previous ? (Date.parse(now)-Date.parse(previous.started_at))/1000 : null,
  recording_owner:document.documentElement.dataset.agentBrowser ? 'agent:'+JSON.parse(sessionStorage.getItem('rs_agent_observer')).run : window.rsIdentity?.get()?.participant_id??null,
  catalog_version:window.M5_CATALOG.version,interface_version:'storefront-20261109-v2',events:[],consideration_steps:[],final_selection:null,
  purchase:{status:'not_observed',item_id:null},status:'open',anchor_source:null,
  research_only:{questionnaire:researchContext,operator_verification:'unverified',agent_connected:false}};
 db.sessions.push(session);sessionStorage.setItem('rs_active_catalog_session',session.session_id);save();event('session_started',{catalog_version:session.catalog_version,interface_version:session.interface_version});
}
function event(type,payload={}) {const record={schema_version:'rs-platform-event-v2',event_uuid:uid(),event_id:session.events.length+1,at:new Date().toISOString(),type,...payload};session.events.push(record);save();window.rsSendPlatformEvent?.(record,session.session_id);return record;}
function toast(text){$('toast').textContent=text;$('toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('toast').style.display='none',3500);}
function activeSession(){if(session.status==='open')return true;toast('这次选择已记录。请点“开始下一次浏览”继续。');return false;}
function displayState(){return {page_view_id:pageViewId,scene,group,query,sort,page,
 available_item_ids:shown.map(p=>p.id),viewport_item_ids:[...visible],
 positions:shown.map((p,i)=>({item_id:p.id,page_position:i+1,result_position:(page-1)*18+i+1}))};}
function consider(id,reason,snapshot=displayState(),comparisonGroup=null) {
 if(!activeSession())return;
 const avail=[...new Set([...snapshot.available_item_ids,id])];
 const position=snapshot.positions.find(p=>p.item_id===id);
 const record=event('item_considered',{item_id:id,reason,comparison_group_id:comparisonGroup,exposure_context:snapshot,
  controls:{display_position:position?.result_position??null,repeated_consideration:session.consideration_steps.some(s=>s.item_id===id),promotion:false,sponsored:false}});
 session.consideration_steps.push({k:session.consideration_steps.length+1,item_id:id,at:record.at,event_id:record.event_id,
  available_item_ids:avail,viewport_item_ids:snapshot.viewport_item_ids,
  availability_definition:'rendered_current_page_or_explicit_comparison_set',controls:record.controls});save();
}
function renderSceneTabs() {
 $('scene-heading').textContent=SCENE_COPY[scene][0];$('scene-description').textContent=SCENE_COPY[scene][1];
 $('scene-tabs').innerHTML=Object.entries(SCENES).map(([id,label])=>`<button data-scene="${id}" aria-pressed="${scene===id}">${label} <small>· ${allItems.filter(p=>p.scene===id).length}</small></button>`).join('');
 $('scene-tabs').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(!activeSession())return;scene=b.dataset.scene;group='';query='';$('query').value='';page=1;event('scene_filter',{scene});render();});
}
function renderGroups(){const counts={};allItems.filter(p=>p.scene===scene).forEach(p=>counts[p.group]=(counts[p.group]||0)+1);
 $('group-list').innerHTML=[['','全部品类'],...Object.entries(counts).map(([g,n])=>[g,g+' · '+n])].map(([g,label])=>`<button data-group="${esc(g)}" aria-pressed="${g===group}">${esc(label)}</button>`).join('');
 $('group-list').querySelectorAll('button').forEach(b=>b.onclick=()=>{if(!activeSession())return;group=b.dataset.group;page=1;event('category_filter',{group});render();});}
function highlights(p){return Object.entries(attributesOf(p)).filter(([k,v])=>/材质|品牌|容量|尺寸|规格|适用对象/.test(k)&&v.length<=3).slice(0,2).map(([k,v])=>k+'：'+v.join(' / '));}
function render(){renderSceneTabs();renderGroups();renderProducts();}
function renderProducts(){
 observer?.disconnect();visible.clear();
 let results=allItems.filter(p=>p.scene===scene&&(!group||p.group===group));
 const terms=query.toLowerCase().split(/\s+/).filter(Boolean);
 if(terms.length)results=results.filter(p=>{const hay=[p.title,p.title_cn_navigation,p.category,p.group,p.brand,JSON.stringify(p.attributes)].join(' ').toLowerCase();return terms.every(t=>hay.includes(t));});
 if(sort==='attributes')results.sort((a,b)=>Object.keys(b.attributes).length-Object.keys(a.attributes).length);
 if(sort==='price-asc')results.sort((a,b)=>a.price-b.price);
 if(sort==='price-desc')results.sort((a,b)=>b.price-a.price);
 if(sort==='title')results.sort((a,b)=>a.title.localeCompare(b.title,'zh-CN'));
 const pages=Math.max(1,Math.ceil(results.length/18));page=Math.min(page,pages);shown=results.slice((page-1)*18,page*18);pageViewId='view-'+uid();
 $('result-count').textContent=`${results.length} 件商品 · ${group||'全部品类'}${query?' · 搜索“'+query+'”':''}`;
 $('empty').hidden=results.length>0;
 $('product-grid').innerHTML=shown.map(p=>`<article class="product-card" data-item="${esc(p.id)}"><button class="image-button" data-open="${esc(p.id)}" aria-label="查看 ${esc(p.title)}"><img src="${esc(p.images[0].src)}" alt="${esc(p.title)}" loading="lazy"></button><div class="card-copy"><span class="category-tag">${esc(p.category)}</span><button class="title-button" data-open="${esc(p.id)}">${esc(p.title)}</button><div class="spec-chips">${highlights(p).map(t=>`<span title="${esc(t)}">${esc(t)}</span>`).join('')}</div><div class="price">${esc(priceLabel(p))}<small class="price-caption">美元标价（采集时）</small><span class="cny-reference">${esc(cnyReference(p))}</span></div><div class="card-bottom"><small>${esc(ratingLabel(p))}</small><button data-compare="${esc(p.id)}" aria-pressed="${compared.has(p.id)}">${compared.has(p.id)?'已加入比较':'＋ 比较'}</button></div></div></article>`).join('');
 $('product-grid').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openItem(b.dataset.open));
 $('product-grid').querySelectorAll('[data-compare]').forEach(b=>b.onclick=()=>toggleCompare(b.dataset.compare));
 $('pagination').innerHTML=`<button id="prev-page" ${page===1?'disabled':''}>上一页</button><span>${page} / ${pages}</span><button id="next-page" ${page===pages?'disabled':''}>下一页</button>`;
 $('prev-page').onclick=()=>changePage(-1);$('next-page').onclick=()=>changePage(1);
 event('results_rendered',{...displayState(),result_count:results.length,item_snapshots:shown.map((p,i)=>({item_id:p.id,position:i+1,title:p.title,price:p.price,price_status:p.price_status,review_status:p.review_status,cny_reference:fxReference?Number((p.price*fxReference.rate).toFixed(2)):null,fx_reference:fxReference,attributes_shown:highlights(p),image_src:p.images[0].src}))});
 observer=new IntersectionObserver(entries=>{const added=[];for(const entry of entries){const id=entry.target.dataset.item;if(entry.isIntersecting){if(!visible.has(id))added.push(id);visible.add(id);}else visible.delete(id);}if(added.length)event('viewport_exposure',{page_view_id:pageViewId,item_ids:added,visible_item_ids:[...visible],threshold:0.5});},{threshold:0.5});
 $('product-grid').querySelectorAll('.product-card').forEach(el=>observer.observe(el));
 updateCompare();
}
function changePage(delta){if(!activeSession())return;page+=delta;event('page_navigation',{page,direction:delta>0?'next':'previous'});renderProducts();$('search-form').scrollIntoView({behavior:'smooth'});}
function toggleCompare(id){if(!activeSession())return;if(compared.has(id)){compared.delete(id);event('compare_remove',{item_id:id});}else{if(compared.size>=3){toast('每次最多比较 3 件商品。');return;}compared.add(id);event('compare_add',{item_id:id});}updateCompare();}
function updateCompare(){document.querySelectorAll('[data-compare]').forEach(b=>{const on=compared.has(b.dataset.compare);b.setAttribute('aria-pressed',String(on));b.textContent=on?'已加入比较':'＋ 比较';});$('compare-open').disabled=compared.size<2;$('compare-open').textContent=`比较商品（${compared.size}）`;$('compare-count').textContent=compared.size?`已选 ${compared.size} 件，最多比较 3 件`:'选几件，放在一起看看';}
function openItem(id,context=displayState()){if(!activeSession())return;const p=itemMap.get(id);currentItem=id;detailOpenedAt=performance.now();variants={};availableSnapshot=context;consider(id,'detail_open',availableSnapshot);
 const optionHTML=Object.entries(p.variant_options).map(([key,values])=>`<label class="variant-select">${esc(key)}<select data-variant="${esc(key)}"><option value="">请选择 / 暂不确定</option>${values.map(v=>`<option value="${esc(v)}">${esc(v)}</option>`).join('')}</select></label>`).join('');
 const attributes=attributesOf(p);
 $('detail-body').innerHTML=`<div class="detail-layout"><div class="detail-picture"><img src="${esc(p.images[0].src)}" alt="${esc(p.title)}"></div><div class="detail-info"><span class="category-tag">${esc(p.group)}</span><h2>${esc(p.title)}</h2><div class="detail-price"><strong>${esc(priceLabel(p))}</strong><p class="cny-reference">${esc(cnyReference(p))}</p><p>原价为采集时的美元标价；人民币为换算参考，不是国内售价。</p></div>${ratingLabel(p)?`<p class="rating">${esc(ratingLabel(p))}</p>`:''}${optionHTML}<div class="detail-actions"><button data-compare="${esc(p.id)}">＋ 比较</button><button class="primary" id="choose-item">我倾向这件</button></div></div></div>
 ${p.original_text?`<details class="detail-section"><summary>机器翻译 · 查看英文原文</summary><div class="original-source"><h4>${esc(p.original_text.title)}</h4>${p.original_text.features?.length?'<ul>'+p.original_text.features.map(t=>'<li>'+esc(t)+'</li>').join('')+'</ul>':''}${p.original_text.description?'<p>'+esc(p.original_text.description)+'</p>':''}<table class="spec-table"><tbody>${Object.entries(p.original_text.attributes||{}).map(([k,v])=>'<tr><td>'+esc(k)+'</td><td>'+v.map(esc).join(' / ')+'</td></tr>').join('')}</tbody></table></div></details>`:''}
 ${p.features?.length?`<section class="detail-section"><h3>商品特点</h3><ul>${p.features.filter(Boolean).map(x=>`<li>${esc(x)}</li>`).join('')}</ul></section>`:''}
 ${p.description?`<section class="detail-section"><h3>商品描述</h3><p style="white-space:pre-line">${esc(p.description)}</p></section>`:''}
 ${Object.keys(attributes).length?`<section class="detail-section"><h3>规格与属性</h3><table class="spec-table"><tbody>${Object.entries(attributes).map(([k,v])=>`<tr><td>${esc(k)}</td><td>${v.map(esc).join(' / ')}</td></tr>`).join('')}</tbody></table></section>`:''}
 ${p.reviews?.length?`<section class="detail-section"><h3>买家评论</h3>${p.reviews.map(r=>`<p>${esc(r.text)}</p>`).join('')}</section>`:''}
 <details class="detail-section"><summary>商品与价格来源</summary><p>${esc(p.source)} · ${esc(p.source_item_id)}</p><p>价格直接取自原始 price 字段（USD），原始美元数值不变；人民币另按标明的参考汇率换算。单品采集日期和当前库存未核实。</p><p>商品文字由服务器上的 Qwen 模型机器翻译；品牌、型号与原文保留供核对。</p></details>`;
 $('detail-body').querySelector('[data-compare]').onclick=()=>toggleCompare(id);$('choose-item').onclick=()=>choose(id);
 $('detail-body').querySelectorAll('[data-variant]').forEach(el=>el.onchange=()=>{variants[el.dataset.variant]=el.value;event('variant_change',{item_id:id,attribute:el.dataset.variant,value:el.value,combination_verified:false});});
 if(!history.state?.detail)history.pushState({detail:id},'',location.pathname+location.search+'#item='+encodeURIComponent(id));
 $('detail-dialog').showModal();updateCompare();
 $('detail-body').querySelectorAll('details').forEach(d=>d.addEventListener('toggle',()=>event('detail_section_toggle',{item_id:id,section:d.querySelector('summary')?.textContent,open:d.open}))); 
}
function closeDialog(id){if(id==='detail-dialog'&&history.state?.detail){history.back();return;}$(id).close();event('back_or_close',{from:id,item_id:id==='detail-dialog'?currentItem:null});}
window.addEventListener('popstate',()=>{if($('detail-dialog').open){$('detail-dialog').close();event('back_or_close',{from:'detail-dialog',item_id:currentItem,via:'browser_history',elapsed_open_ms:detailOpenedAt===null?null:Math.round(performance.now()-detailOpenedAt)});currentItem=null;}});
document.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>closeDialog(b.dataset.close));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('cancel',e=>{if(d.id==='detail-dialog'&&history.state?.detail){e.preventDefault();history.back();}else event('back_or_close',{from:d.id,via:'escape'});}));
$('compare-open').onclick=()=>{if(!activeSession())return;const products=[...compared].map(id=>itemMap.get(id));
 const context={...displayState(),available_item_ids:products.map(p=>p.id),viewport_item_ids:[],positions:products.map((p,i)=>({item_id:p.id,result_position:i+1,page_position:i+1}))};
 event('comparison_open',{item_ids:products.map(p=>p.id),position_order:products.map(p=>p.id)});
 // Explicit comparison is a materially considered set; retain the UI column order.
 const comparisonGroup='comparison-'+uid();products.forEach(p=>consider(p.id,'explicit_comparison',context,comparisonGroup));
 const fields=[...new Set(products.flatMap(p=>Object.keys(attributesOf(p))))];
 $('compare-body').innerHTML='<div class="comparison-wrap"><table class="comparison"><tbody><tr><th>商品</th>'+products.map(p=>`<td><img src="${esc(p.images[0].src)}" alt="${esc(p.title)}"><p>${esc(p.title)}</p><button data-detail="${esc(p.id)}">查看详情与选择</button><button class="quiet" data-remove="${esc(p.id)}">移出比较</button></td>`).join('')+'</tr><tr><th>价格</th>'+products.map(p=>'<td>'+esc(priceLabel(p))+'<small class="price-caption">美元标价（采集时）</small><span class="cny-reference">'+esc(cnyReference(p))+'</span></td>').join('')+'</tr>'+(products.some(p=>ratingLabel(p))?'<tr><th>评分</th>'+products.map(p=>'<td>'+esc(ratingLabel(p))+'</td>').join('')+'</tr>':'')+fields.map(k=>'<tr><th>'+esc(k)+'</th>'+products.map(p=>'<td>'+esc(p.attributes[k]?.join(' / ')||'')+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
 $('compare-body').querySelectorAll('[data-detail]').forEach(b=>b.onclick=()=>{$('compare-dialog').close();openItem(b.dataset.detail,context);});
 $('compare-body').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{toggleCompare(b.dataset.remove);$('compare-dialog').close();});$('compare-dialog').showModal();
};
function choose(id){if(!activeSession())return;pendingChoice={item_id:id,variant_options:{...variants},displayed_price:itemMap.get(id).price,currency:itemMap.get(id).currency,cny_reference:fxReference?Number((itemMap.get(id).price*fxReference.rate).toFixed(2)):null,fx_reference:fxReference,price_status:itemMap.get(id).price_status};$('choice-title').textContent=itemMap.get(id).title;$('choice-dialog').showModal();event('selection_proposed',pendingChoice);}
$('confirm-choice').onclick=()=>{if(!activeSession())return;const choice={...pendingChoice,at:new Date().toISOString(),kind:'preview_preference_selection',price_accepted:false};session.final_selection=choice;event('selection_confirmed',choice);finish('selected');};
$('no-selection').onclick=()=>{if(!activeSession())return;session.final_selection={item_id:null,at:new Date().toISOString(),kind:'explicit_no_selection'};event('no_selection');finish('no_selection');};
function finish(status){history.replaceState({},'',location.pathname+location.search);event('session_ended',{status});session.status=status;session.ended_at=new Date().toISOString();save();document.querySelectorAll('dialog[open]').forEach(d=>d.close());observer?.disconnect();$('outcome').hidden=false;$('outcome').innerHTML='<strong>'+ (status==='selected'?'已记录你的选择':'已记录：这次先不选')+'</strong><p>'+ (status==='selected'?esc(itemMap.get(session.final_selection.item_id).title):'没有合适的商品，也是一种有效结果。')+'</p><p>本次没有产生订单。可以导出记录，或开始下一次浏览。</p>';$('outcome').scrollIntoView({behavior:'smooth'});}
$('new-session').onclick=()=>{if(session.status==='open'){event('session_ended',{status:'abandoned'});session.status='abandoned';session.ended_at=new Date().toISOString();save();}compared.clear();group='';query='';$('query').value='';page=1;startSession();$('outcome').hidden=true;render();toast('新会话已开始，用户身份保持不变，连接后会自动存到服务器。');};
$('search-form').onsubmit=e=>{e.preventDefault();if(!activeSession())return;query=$('query').value.trim();page=1;event('search',{query,scene,group});renderProducts();};
$('sort').onchange=()=>{if(!activeSession())return;sort=$('sort').value;page=1;event('sort_change',{sort});renderProducts();};
$('clear-filters').onclick=()=>{if(!activeSession())return;group='';query='';page=1;sort='default';$('query').value='';$('sort').value=sort;event('filters_cleared');render();};
function platformSession(s){return {user_id:s.user_id,session_id:s.session_id,started_at:s.started_at,ended_at:s.ended_at??null,
 session_gap_seconds:s.session_gap_seconds,catalog_version:s.catalog_version,O_us:s.events,
 C_us_ordered:s.consideration_steps.map(k=>k.item_id),C_us_unique:[...new Set(s.consideration_steps.map(k=>k.item_id))],
 consideration_steps:s.consideration_steps,observed_selection:s.final_selection,purchase:s.purchase,
 y_us:null,y_us_status:'正式模型的购买结果尚未观测；不能把预览选择直接当实际购买',status:s.status};}
function exportData(){return {schema_version:'rs-agent-preview-v1',model_reference:'RS_Agent.pdf equations 3-5, 9, 18-27, 29, 40-44',
 warning:'Prototype data only: no real purchases, no verified source anchors, no trained model.',
 fx_reference:fxReference,platform_observations:{user_id:db.user_id,sessions:db.sessions.map(platformSession),items:allItems},
 study_only:db.sessions.map(s=>({session_id:s.session_id,anchor_source:s.anchor_source,...s.research_only})),
 candidate_extraction_rule:'detail_open and explicit_comparison count; list rendering alone does not; repeats retained in ordered C, deduplicated in final-choice set',
 missing_for_training:['verified purchase or agreed final-choice target','verified human anchor sessions','repeats and simultaneous-comparison model rule','price/variant verification']};}
$('open-records').onclick=()=>{$('record-summary').textContent=`本机标识 ${db.user_id.slice(0,16)}… · ${db.sessions.length} 次会话 · ${session.events.length} 条本次事件${storageOkay?'':' · 浏览器存储不可用，请及时导出'}`;$('record-json').textContent=JSON.stringify(platformSession(session),null,2);$('records-dialog').showModal();};
$('export-records').onclick=()=>{const blob=new Blob([JSON.stringify(exportData(),null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='rs-agent-shopping-preview.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('erase-records').onclick=()=>{if(!confirm('清除这个浏览器中的购物记录？服务器记录和待同步记录不会删除，个人身份保持不变。'))return;db={version:1,user_id:'local-'+uid(),sessions:[]};researchContext=null;try{sessionStorage.removeItem('rs_need_handoff_v1');}catch{}startSession();$('records-dialog').close();compared.clear();$('outcome').hidden=true;render();toast('本机购物记录已清除。');};
document.addEventListener('visibilitychange',()=>{if(session.status==='open')event('visibility_change',{state:document.visibilityState});});
let scrollTimer;window.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>{if(session.status==='open')event('scroll',{y:Math.round(scrollY),page_view_id:pageViewId,visible_item_ids:[...visible]});},500);},{passive:true});
if(researchContext?.confirmedNeed?.currentWords?.want){$('need-context').hidden=false;$('need-text').textContent=researchContext.confirmedNeed.currentWords.want;}
const currentOwner=()=>document.documentElement.dataset.agentBrowser ? 'agent:'+JSON.parse(sessionStorage.getItem('rs_agent_observer')).run : window.rsIdentity?.get()?.participant_id??null;
const activeId=sessionStorage.getItem('rs_active_catalog_session');
const last=db.sessions.find(s=>s.session_id===activeId);
if(last?.status==='open' && last.recording_owner===currentOwner() && last.catalog_version===window.M5_CATALOG.version && (last.research_only?.questionnaire?.confirmedNeed?.confirmedAt??null)===(researchContext?.confirmedNeed?.confirmedAt??null)){
 session=last;event('session_resumed',{catalog_version:window.M5_CATALOG.version});
}else{startSession();}
window.addEventListener('rs-identity-changed',()=>{
 // Never upload earlier local browsing or another participant's history under a new identity.
 if(session.recording_owner===currentOwner())return;
 session.status='identity_changed';session.ended_at=new Date().toISOString();save();
 document.querySelectorAll('dialog[open]').forEach(d=>d.close());compared.clear();startSession();render();
});
window.addEventListener('pagehide',()=>{if(session.status==='open')event('page_exit',{page_view_id:pageViewId});});
render();

if(fxReference){$('exchange-note').innerHTML='人民币换算参考：1 USD = '+esc(fxReference.rate)+' CNY，汇率日期 '+esc(fxReference.rate_date)+'。不含税费、运费，不是国内实际售价。 <a href="'+esc(fxReference.source_url)+'" target="_blank" rel="noopener">汇率来源</a>';}

// Read-only observer used by the server recorder; never an Agent action tool.
window.rsPlatformSnapshot=()=>({...displayState(),current_item:$('detail-dialog').open?currentItem:null,compared:[...compared],visible_text:document.body.innerText.slice(0,24000),last_event_id:session.events.length,session_id:session.session_id,scroll_y:scrollY});
