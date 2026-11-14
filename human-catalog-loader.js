/* Staged loader, not yet connected to the published storefront.
 * Load only a human participant's selected scene. Existing Agent browsers keep
 * their own catalog and must never call this module. No personal data is sent.
 */
(function(root){'use strict';
function createHumanCatalogLoader({baseUrl,items,itemMap,fetchImpl=fetch}){
 const scenes=new Set(['baby','pets','moving','sports']);let manifest=null;
 const loaded=new Set(),pending=new Map();
 async function initialize(){
  const r=await fetchImpl(baseUrl+'/api/human-catalog/manifest');if(!r.ok)throw Error('完整商品库暂不可用');
  const m=await r.json();if(m.scope!=='human_storefront_only'||!/^[a-f0-9]{64}$/.test(m.revision||''))throw Error('商品库版本无效');
  for(const scene of scenes)if(!Number.isSafeInteger(m.counts?.[scene])||m.counts[scene]<1)throw Error('商品数量信息无效');
  manifest=m;return m;
 }
 async function load(scene){
  if(!manifest)throw Error('请先连接商品库');if(!scenes.has(scene))throw Error('未知场景');
  if(loaded.has(scene))return;if(pending.has(scene))return pending.get(scene);
  const work=(async()=>{
   const r=await fetchImpl(baseUrl+'/api/human-catalog/scene/'+encodeURIComponent(scene)+'?revision='+manifest.revision);
   if(!r.ok)throw Error('商品暂时加载失败，请重试');const rows=await r.json();
   if(!Array.isArray(rows))throw Error('商品数据格式有误');const ids=new Set();
   if(items.filter(p=>p.scene===scene).length+rows.length!==manifest.counts[scene])throw Error('商品数量与版本记录不一致');
   for(const p of rows){
    if(!p||p.scene!==scene||typeof p.id!=='string'||ids.has(p.id)||itemMap.has(p.id)||
       !Number.isFinite(p.price)||p.price<=0||!Number.isFinite(p.display_price)||p.display_currency!=='CNY'||
       typeof p.images?.[0]?.src!=='string'||!p.images[0].src.startsWith('https://'))throw Error('商品数据校验失败');ids.add(p.id);
   }
   for(const p of rows){items.push(p);itemMap.set(p.id,p);}loaded.add(scene);
  })();pending.set(scene,work);
  try{await work;}finally{pending.delete(scene);}
 }
 return {initialize,load,isLoaded:scene=>loaded.has(scene)};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createHumanCatalogLoader};
else root.createHumanCatalogLoader=createHumanCatalogLoader;
})(typeof window==='undefined'?globalThis:window);
