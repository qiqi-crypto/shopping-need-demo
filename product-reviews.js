/* Only source-matched, validated review translations are delivered here. */
window.mountDetailNavigation=function(container,onView){
 window.rsDetailObserverCleanup?.();
 const dialog=container.closest('dialog'),nav=document.createElement('nav');
 nav.setAttribute('aria-label','商品详情导航');nav.style.cssText='display:flex;gap:8px;flex-wrap:wrap;padding:10px 0 18px';
 for(const section of container.querySelectorAll('.detail-section')){
  const label=section.querySelector('h3')?.textContent?.trim();if(!label)continue;
  const button=document.createElement('button');button.type='button';button.textContent=label;
  button.onclick=()=>section.scrollIntoView({behavior:'smooth',block:'start'});nav.append(button);
 }
 container.prepend(nav);
 const observed=new WeakSet(),seen=new WeakSet();
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){
  if(!entry.isIntersecting||entry.intersectionRatio<.25||!dialog.open||seen.has(entry.target))continue;
  seen.add(entry.target);onView({section:entry.target.closest('.detail-section')?.querySelector('h3')?.textContent,
   content_kind:entry.target.matches('.buyer-review')?'review_text':'section_heading',
   visible_text:entry.target.innerText.slice(0,1200),visibility:'viewport_observed',intersection_ratio:entry.intersectionRatio});
 }},{root:dialog,threshold:[.25]});
 const watch=()=>{for(const node of container.querySelectorAll('.detail-section h3,.buyer-review'))if(!observed.has(node)){observed.add(node);observer.observe(node);}};
 const mutations=new MutationObserver(watch);mutations.observe(container,{childList:true,subtree:true});watch();
 window.rsDetailObserverCleanup=()=>{observer.disconnect();mutations.disconnect();};
};
window.cleanReviewText=function(value){
 return String(value).replace(/\[\[VIDEOID:[^\]]+\]\]/gi,'').replace(/&lt;\s*br\s*\/?\s*&gt;/gi,'\n').replace(/\\?<\s*br\s*\/?\s*>/gi,'\n').replace(/<\/p\s*>/gi,'\n\n').replace(/<[^>]+>/g,'').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/\n{3,}/g,'\n\n').trim();
};
window.showProductReviews=async function(container,itemId,onLoaded){
 const id=String(itemId).replace(/^amz23:/,'');
 if(!/^[A-Z0-9]{10}$/.test(id))return;
 container.textContent='正在加载评价…';
 try{
  const r=await fetch((document.documentElement.dataset.agentBrowser==='true'?location.origin:window.SHOPPING_AGENT_API)+'/data/reviews/'+id+'.json',{cache:'no-cache'});
  if(r.status===404){container.textContent='暂未收录文字评价。';return;}
  if(!r.ok)throw Error('unavailable');
  const data=await r.json();if(data.item_id!==itemId||data.language!=='zh-CN'||!Array.isArray(data.reviews))throw Error('invalid');
  if(!container.isConnected)return;
  container.replaceChildren();
  const note=document.createElement('p');note.className='review-note';note.textContent='部分买家评价 · 中文译文';container.append(note);
  for(const review of data.reviews){
   if(typeof review.text!=='string'||!Number.isFinite(review.rating)||review.rating<1||review.rating>5)continue;
   const card=document.createElement('article');card.className='buyer-review';
   const meta=document.createElement('p');meta.className='review-meta';
   const date=Number.isFinite(review.timestamp)?new Date(review.timestamp).toISOString().slice(0,10):'';
   meta.textContent='★ '+review.rating+' / 5'+(date?' · '+date:'');
   const text=document.createElement('p');text.textContent=window.cleanReviewText(review.text);card.append(meta,text);container.append(card);
  }
  onLoaded?.({review_ids:data.reviews.map(r=>r.review_id),review_revision:data.revision});
 }catch{if(container.isConnected)container.textContent='评价暂时加载失败，请稍后再打开。';}
};
