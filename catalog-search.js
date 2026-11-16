/* Shared, local lexical retrieval: Chinese words, product synonyms and partial matches.
 * No LLM calls. Scores and retrieval mode are recorded with the visible candidates.
 */
(function(root){'use strict';
 const version='catalog-search-zh-v2';
 const concepts=[
  ['dryrack',['衣物晾晒架','衣物晾衣架','洗衣晾衣架','晾晒衣架','晾晒架','晾衣架','晒衣架','clothes drying rack','laundry drying rack']],
  ['litterbox',['猫砂盆','猫厕所','猫便盆','litter box']],
  ['yogamat',['瑜伽垫','瑜珈垫','yoga mat']],
  ['stroller',['婴儿推车','婴儿车','儿童推车','宝宝推车','stroller']],
  ['bottlebrush',['奶瓶清洁刷','奶瓶刷','bottle brush']],
  ['storagebox',['收纳箱','收纳盒','储物箱','储物盒','storage box','storage bin']],
  ['petbowl',['宠物食盆','宠物碗','猫食盆','猫碗','狗食盆','狗碗','pet bowl','cat bowl','dog bowl']],
  ['dumbbell',['哑铃','啞鈴','dumbbell']],
 ];
 const aliases=new Map();for(const [id,words] of concepts)for(const w of words)aliases.set(w,'zz'+id);
 for(const w of ['可折叠','可折迭','可摺疊','折迭','摺疊','折叠式','foldable','folding','collapsible'])aliases.set(w,'折叠');
 for(const w of ['防滑的','non-slip','nonslip'])aliases.set(w,'防滑');
 const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 const rx=new RegExp([...aliases.keys()].sort((a,b)=>b.length-a.length).map(escape).join('|'),'gi');
 const stop=new Set(['的','和','与','及','或','一','个','款','件','想','买','要','找','帮','我','一个','一件','一些','适合','用于','可','用','有','商品','产品']);
 const segmenter=typeof Intl.Segmenter==='function'?new Intl.Segmenter('zh',{granularity:'word'}):null;
 const norm=s=>String(s||'').normalize('NFKC').toLowerCase().replace(rx,m=>' '+aliases.get(m.toLowerCase())+' ');
 function words(s){
  const parts=segmenter?[...segmenter.segment(s)].filter(x=>x.isWordLike).map(x=>x.segment):s.match(/[a-z0-9]+|[\u3400-\u9fff]{1,2}/g)||[];
  return [...new Set(parts.filter(w=>!stop.has(w)&&!/^\d+$/.test(w)))];
 }
 const grams=s=>{const out=new Set();for(const part of s.match(/[\u3400-\u9fff]+/g)||[])for(let i=0;i<part.length-1;i++)out.add(part.slice(i,i+2));return out;};
 const cache=new WeakMap();
 function doc(p){
  if(cache.has(p))return cache.get(p);
  const title=norm([p.title,p.title_cn_navigation,p.brand].filter(Boolean).join(' '));
  const attributes=norm(JSON.stringify(p.attributes||{}));
  const category=norm([p.category,p.group].join(' '));
  const d={title,attributes,category,tokens:new Set(words(title)),grams:grams(String(p.title||''))};cache.set(p,d);return d;
 }
 function search(items,query){
  const q=norm(query).trim(),terms=words(q);const scores=new Map();
  if(!terms.length)return {items:items.slice(),scores,mode:'browse',matchedCount:items.length,version};
  const docs=items.map(p=>[p,doc(p)]),anchors=terms.filter(t=>t.startsWith('zz'));
  const weights=new Map(terms.map(t=>[t,1+Math.log(1+items.length/(1+docs.filter(([,d])=>d.title.includes(t)).length))]));
  const total=[...weights.values()].reduce((a,b)=>a+b,0);let complete=0;
  const matches=[];
  for(const [p,d] of docs){
   // A modifier such as "folding" must not outweigh the requested product type.
   const anchorFits=!anchors.length||anchors.some(t=>d.title.includes(t)||d.attributes.includes(t));
   let hit=0,strength=0,n=0;
   for(const t of terms){const field=d.title.includes(t)?1:d.attributes.includes(t)?.45:d.category.includes(t)?.2:0;if(field){hit+=weights.get(t);strength+=weights.get(t)*field;n++;}}
   const coverage=hit/total;
   if(!anchorFits||n===0||coverage<.35){
    // Keep weaker items in the catalog, but below every relevant match.
    if(n)scores.set(p.id,.9*strength/total);
    continue;
   }
   const full=n===terms.length;if(full)complete++;
   const score=(full?100:0)+40*coverage+20*strength/total+(d.title.includes(q)?5:0);
   scores.set(p.id,score);matches.push(p);
  }
  if(matches.length)return {items:items.slice(),scores,mode:complete?'word_matches':'related_matches',matchedCount:matches.length,completeCount:complete,version};
  // Typo/variant fallback. At least half of the query bigrams must overlap.
  const qg=grams(query);const close=[];
  if(qg.size>=2)for(const [p,d] of docs){const n=[...qg].filter(x=>d.grams.has(x)).length;const overlap=n/qg.size;if(n>=2&&overlap>=.5){scores.set(p.id,10+overlap);close.push(p);}}
  if(close.length)return {items:items.slice(),scores,mode:'near_text_matches',matchedCount:close.length,completeCount:0,version};
  // Clearly labelled scene suggestions, never described as matching the query.
  return {items:items.slice(),scores,mode:'scene_suggestions',matchedCount:0,completeCount:0,version};
 }
 // Prepare the same document cache in small idle chunks. No query, ranking or exposure event.
 const pending=new WeakSet();
 function prepare(items){
  const todo=items.filter(p=>!cache.has(p)&&!pending.has(p));todo.forEach(p=>pending.add(p));
  if(!todo.length)return Promise.resolve();
  let offset=0;
  return new Promise(resolve=>{
   function chunk(){const until=Math.min(offset+64,todo.length);for(;offset<until;offset++){doc(todo[offset]);pending.delete(todo[offset]);}
    if(offset<todo.length)schedule(chunk);else resolve();}
   function schedule(fn){if(typeof root.requestIdleCallback==='function')root.requestIdleCallback(fn,{timeout:500});else setTimeout(fn,0);}
   schedule(chunk);
  });
 }
 const api={search,prepare,version};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.catalogSearch=api;
})(typeof window==='undefined'?globalThis:window);
