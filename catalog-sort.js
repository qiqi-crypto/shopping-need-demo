/* Sort the complete filtered result set before pagination; never change source data. */
(function(root){'use strict';
 const rating=p=>Number.isFinite(p.rating)&&p.rating>=1&&p.rating<=5?p.rating:null;
 const count=p=>Number.isFinite(p.rating_count)&&p.rating_count>0?p.rating_count:0;
 function compareRating(a,b,direction){
  const x=rating(a),y=rating(b);
  if(x===null||y===null)return x===y?count(b)-count(a):x===null?1:-1;
  return direction*(x-y)||count(b)-count(a);
 }
 // Transparent pilot rule, not Amazon's proprietary ranking. A 4-star prior
 // with weight 20 prevents one 5-star rating from dominating established items.
 const quality=p=>{const r=rating(p),n=count(p);return r===null?0:(n*r+20*4)/(n+20);};
 function relevance(p,query){
  const q=query.trim().toLowerCase();if(!q)return 0;
  const title=String(p.title||'').toLowerCase(),brand=String(p.brand||'').toLowerCase();
  return (title.includes(q)?4:0)+(brand.includes(q)?2:0)+q.split(/\s+/).filter(t=>title.includes(t)).length;
 }
 function sortProducts(items,mode,query='',searchScores=null){
  const result=items.slice();
  const compare={
   default:(a,b)=>(searchScores?(searchScores.get(b.id)||0)-(searchScores.get(a.id)||0):relevance(b,query)-relevance(a,query))||quality(b)-quality(a)||count(b)-count(a)||String(a.id).localeCompare(String(b.id)),
   'rating-desc':(a,b)=>compareRating(a,b,-1),
   'rating-asc':(a,b)=>compareRating(a,b,1),
   'rating-count-desc':(a,b)=>count(b)-count(a)||(rating(b)??0)-(rating(a)??0),
   'price-asc':(a,b)=>a.display_price-b.display_price,
   'price-desc':(a,b)=>b.display_price-a.display_price,
   attributes:(a,b)=>Object.keys(b.attributes||{}).length-Object.keys(a.attributes||{}).length,
   title:(a,b)=>a.title.localeCompare(b.title,'zh-CN')
  }[mode];
  // Equal keys retain catalog order; missing ratings always come last.
  return compare?result.sort(compare):result;
 }
 const api={sortProducts,version:'catalog-featured-v3',quality,relevance};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.catalogSorting=api;
})(typeof window==='undefined'?globalThis:window);
