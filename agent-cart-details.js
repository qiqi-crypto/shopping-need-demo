/* A participant reads the Agent's candidates in a separate, read-only window.
   Events are linked to the same run/user, but never attributed to the Agent. */
'use strict';
window.createAgentCartDetails = function({api, getRun, getState, choose, base}) {
 const $=id=>document.getElementById(id), dialog=$('cart-product-detail');
 let request=0,active=null,scrollTimer=null,journal=null,stopPresence=null,lastObservedCart='';
 const idle=new Set(['waiting_for_user','waiting_for_feedback','paused','closed','error']);
 function ensureJournal(){
  if(journal||!getRun())return;
  journal=window.rsCreateJournal({owner:'review:'+getRun().id,sessionPrefix:'cart-review-',metadata:{interface_version:'participant-observer-v2'},
   transport:async(sessionId,events)=>(await api('/api/sessions/'+getRun().id+'/review-events',{method:'POST',keepalive:JSON.stringify(events).length<12000,body:JSON.stringify({session_id:sessionId,events})})).json()});
  stopPresence=window.rsStartPresence?.(record,()=>!!getRun()&&!getState()?.choice,()=>({surface:dialog.open?'product_detail':'assistant_observer',item_id:active?.rendered?active.id:null}));
 }
 function record(type,data={}){ensureJournal();return journal?.record(type,data);}
 async function flush(){if(journal)await journal.flush();}
 function observeState(state){
  if(state.choice){stopPresence?.();return;}ensureJournal();
  const cart=state.cart||[],signature=JSON.stringify(cart);
  if(signature!==lastObservedCart){lastObservedCart=signature;record('results_rendered',{surface:'assistant_cart',available_item_ids:cart.map(p=>p.id),viewport_item_ids:[],positions:cart.map((p,i)=>({item_id:p.id,result_position:i+1})),item_snapshots:cart.map(p=>({item_id:p.id,title:p.title,displayed_price:p.price,displayed_currency:'CNY'}))});}
 }
 function node(tag,text,cls){const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n;}
 function asset(src){try{const url=new URL(src,base+'/');return ['https:','http:'].includes(url.protocol)?url.href:'';}catch{return '';}}
 function section(label,child){const s=node('section',undefined,'detail-section');s.append(node('h3',label),child);return s;}
 function logScroll(){clearTimeout(scrollTimer);scrollTimer=null;if(active?.rendered)record('scroll',{item_id:active.id,surface:'product_detail',scroll_y:Math.round(dialog.scrollTop),viewport_height:dialog.clientHeight});}
 function endView(){
  clearTimeout(scrollTimer);scrollTimer=null;
  if(active?.rendered)record('back_or_close',{item_id:active.id,surface:'product_detail'});
  window.rsDetailObserverCleanup?.();active=null;request++;
 }
 dialog.addEventListener('scroll',()=>{clearTimeout(scrollTimer);scrollTimer=setTimeout(logScroll,180);},{passive:true});
 dialog.addEventListener('close',endView);
 $('close-cart-product').onclick=()=>dialog.close();
 function update(){
  if(!active)return;
  const state=getState(),present=(state?.cart||[]).some(p=>p.id===active.id);
  const canChoose=active.rendered&&present&&!state?.choice&&!state?.queued_feedback&&idle.has(state?.status);
  $('choose-cart-product').disabled=!canChoose;
  $('cart-product-status').textContent=state?.choice?'本轮选择已完成。':!present?'这件商品已移出购物车，请返回查看最新候选。':!idle.has(state?.status)||state?.queued_feedback?'助手正在调整候选，你可以先看详情，调整完成后再选。':'';
 }
 async function open(itemId,fromCart=false){
  if(active)endView();const version=++request;
  active={id:itemId,rendered:false};
  $('close-cart-product').textContent=fromCart?'返回购物车':'返回助手';
  $('choose-cart-product').disabled=true;$('cart-product-status').textContent='';
  const body=$('cart-product-body');body.textContent='正在加载商品详情…';
  if(!dialog.open)dialog.showModal();dialog.scrollTop=0;
  const cart=[...(getState()?.cart||[])];
  try{
   const {product:p,catalog_revision}=await(await api('/api/sessions/'+getRun().id+'/cart/items/'+encodeURIComponent(itemId))).json();
   if(version!==request||!dialog.open)return;
   if(p.id!==itemId)throw Error('商品信息加载失败，请返回后重试。');
   const top=node('div',undefined,'cart-detail-top'),gallery=node('div',undefined,'cart-detail-gallery');
   const photos=(p.images||[]).filter(x=>x.src);
   const hero=node('img');hero.src=asset(photos[0]?.src||'');hero.alt=p.title;gallery.append(hero);
   if(photos.length>1){const thumbs=node('div',undefined,'cart-detail-thumbs');photos.forEach((photo,index)=>{
    const button=node('button');button.type='button';button.setAttribute('aria-label','查看商品图片 '+(index+1));
    const image=node('img');image.src=asset(photo.src);image.alt='';image.loading='lazy';button.append(image);
    button.onclick=()=>{hero.src=asset(photo.src);record('detail_section_view',{item_id:itemId,section:'商品图片',image_index:index,visibility:'explicit_image_selection'});};thumbs.append(button);
   });gallery.append(thumbs);}
   const summary=node('div');summary.append(node('h2',p.title),node('strong','¥'+Number(p.display_price).toFixed(2),'cart-detail-price'));
   if(p.rating)summary.append(node('p','★ '+p.rating+(p.rating_count?' · '+p.rating_count+' 个评分':''),'cart-detail-rating'));
   top.append(gallery,summary);body.replaceChildren(top);
   if(p.features?.length){const list=node('ul');p.features.filter(Boolean).forEach(x=>list.append(node('li',window.cleanReviewText(x))));body.append(section('商品特点',list));}
   if(p.description)body.append(section('商品描述',node('p',window.cleanReviewText(p.description),'cart-detail-text')));
   const attrs=Object.entries(p.attributes||{}).map(([k,v])=>[k,Array.isArray(v)?v.filter(Boolean).join(' / '):String(v??'')]).filter(([k,v])=>k&&v.trim());
   if(attrs.length){const table=node('table');const tbody=node('tbody');for(const [key,value] of attrs){const row=node('tr');row.append(node('th',key),node('td',value));tbody.append(row);}table.append(tbody);body.append(section('规格与属性',table));}
   const variants=Object.entries(p.variant_options||{});
   if(variants.length){const list=node('ul');for(const [key,value] of variants)list.append(node('li',key+'：'+(Array.isArray(value)?value.join(' / '):String(value))));body.append(section('商品选项',list));}
   const reviews=node('div');body.append(section('买家评价',reviews));active.rendered=true;
   const ctx={available_item_ids:cart.map(x=>x.id),viewport_item_ids:[],positions:cart.map((x,i)=>({item_id:x.id,result_position:i+1}))};
   record('results_rendered',{...ctx,catalog_revision,surface:'cart',item_snapshots:cart.map(x=>({item_id:x.id,title:x.title,displayed_price:x.price,displayed_currency:'CNY'}))});
   record('item_considered',{item_id:itemId,reason:'detail_open',exposure_context:ctx});
   window.mountDetailNavigation(body,view=>{if(version===request&&dialog.open)record('detail_section_view',{item_id:itemId,...view});});
   window.showProductReviews(reviews,itemId);update();
  }catch(e){if(version===request&&dialog.open){body.textContent=e.message;$('choose-cart-product').disabled=true;}}
 }
 $('choose-cart-product').onclick=()=>{update();if(!$('choose-cart-product').disabled){logScroll();const p=getState().cart.find(x=>x.id===active.id);choose(p.id,p.title);}};
 // Record observer interactions as participant actions, never Agent actions.
 let points=[],motionTimer;
 function motion(){if(!points.length)return;record('pointer_move',{surface:dialog.open?'product_detail':'assistant_observer',points});points=[];}
 document.addEventListener('pointermove',e=>{if(!e.isTrusted||!getRun()||getState()?.choice)return;points.push({x:Math.round(e.clientX),y:Math.round(e.clientY),at:new Date().toISOString()});if(points.length>=16)motion();clearTimeout(motionTimer);motionTimer=setTimeout(motion,180);},{capture:true,passive:true});
 document.addEventListener('click',e=>{if(!e.isTrusted||!getRun()||getState()?.choice)return;motion();record('pointer_click',{x:Math.round(e.clientX),y:Math.round(e.clientY),button:e.button,surface:dialog.open?'product_detail':'assistant_observer',item_id:active?.rendered?active.id:null});},{capture:true,passive:true});
 window.addEventListener('pagehide',()=>{motion();if(journal&&!getState()?.choice)record('page_exit',{item_id:active?.id||null,surface:'assistant_observer'});});
 return {open,update,observeState,record,flush,isOpen:()=>dialog.open,finish:async()=>{stopPresence?.();motion();if(dialog.open){endView();dialog.close();}if(journal)await journal.finish('selection_completed');}};
};
