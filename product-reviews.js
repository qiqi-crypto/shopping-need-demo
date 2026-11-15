/* Only source-matched, validated review translations are delivered here. */
window.showProductReviews=async function(container,itemId,onLoaded){
 const id=String(itemId).replace(/^amz23:/,'');
 if(!/^[A-Z0-9]{10}$/.test(id))return;
 container.textContent='正在加载评价…';
 try{
  const r=await fetch(window.SHOPPING_AGENT_API+'/data/reviews/'+id+'.json',{cache:'no-cache'});
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
   const text=document.createElement('p');text.textContent=review.text;card.append(meta,text);container.append(card);
  }
  onLoaded?.({review_ids:data.reviews.map(r=>r.review_id),review_revision:data.revision});
 }catch{if(container.isConnected)container.textContent='评价暂时加载失败，请稍后再打开。';}
};
