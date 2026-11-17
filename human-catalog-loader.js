/* Identical version-pinned, paged catalog reads for humans and browser agents. */
(function(root){'use strict';
function createHumanCatalogLoader({baseUrl,items,itemMap,revision='',fetchImpl=fetch}){
 const scenes=new Set(['baby','pets','moving','sports']);let manifest=null;const details=new Map();
 async function get(path,params={},signal){
  const q=new URLSearchParams(params),controller=new AbortController();
  const stop=()=>controller.abort();if(signal?.aborted)stop();signal?.addEventListener('abort',stop,{once:true});
  const timer=setTimeout(stop,20000);
  try{const r=await fetchImpl(baseUrl+path+'?'+q,{signal:controller.signal});
   if(!r.ok)throw Error(r.status===409?'本轮商品库暂不可用，请刷新重试':'商品暂时加载失败，请重试');return await r.json();
  }catch(e){if(controller.signal.aborted&&!signal?.aborted)throw Error('连接超时，请重新搜索或刷新');throw e;}
  finally{clearTimeout(timer);signal?.removeEventListener('abort',stop);}
 }
 function remember(p){
  if(!p||typeof p.id!=='string'||!scenes.has(p.scene)||!Number.isFinite(p.price)||p.price<=0||!Number.isFinite(p.display_price)||p.display_price<=0||p.display_currency!=='CNY'||!p.images?.[0]?.src)throw Error('商品数据校验失败');
  p.images=p.images.map(x=>({...x,src:new URL(x.src,baseUrl+'/').href}));
  const old=itemMap.get(p.id);if(old){if(p._detail_loaded||!old._detail_loaded)Object.assign(old,p);return old;}
  itemMap.set(p.id,p);items.push(p);return p;
 }
 function check(data){if(!manifest||data.revision!==manifest.revision)throw Error('商品库版本不一致');return data;}
 async function initialize(){
  const m=await get('/api/catalog/manifest',revision?{revision}:{});
  if(m.scope!=='shared_storefront'||m.delivery!=='paged-v1'||!/^[a-f0-9]{64}$/.test(m.revision||''))throw Error('商品库版本无效');
  for(const s of scenes)if(!Number.isSafeInteger(m.counts?.[s])||m.counts[s]<1)throw Error('商品数量信息无效');
  manifest=m;return m;
 }
 async function load(scene){if(!manifest||!scenes.has(scene))throw Error('未知场景');} // no whole-scene download
 async function search(params,signal){
  const data=check(await get('/api/catalog/search',{...params,revision:manifest.revision},signal));
  if(!Array.isArray(data.items)||data.items.length>18||data.page_size!==18)throw Error('商品分页格式有误');
  return {...data,items:data.items.map(remember)};
 }
 async function detail(id){
  if(itemMap.get(id)?._detail_loaded)return itemMap.get(id);if(details.has(id))return details.get(id);
  const work=(async()=>remember(check(await get('/api/catalog/items/'+encodeURIComponent(id),{revision:manifest.revision})).item))();
  details.set(id,work);try{return await work;}finally{details.delete(id);}
 }
 async function restore(ids){
  const missing=[...new Set(ids)].filter(id=>!itemMap.has(id));
  for(let n=0;n<missing.length;n+=20){const data=check(await get('/api/catalog/items',{revision:manifest.revision,ids:missing.slice(n,n+20).join(',')}));data.items.forEach(remember);}
 }
 return {initialize,load,search,detail,restore,isLoaded:scene=>!!manifest&&scenes.has(scene)};
}
if(typeof module!=='undefined'&&module.exports)module.exports={createHumanCatalogLoader};else root.createHumanCatalogLoader=createHumanCatalogLoader;
})(typeof window==='undefined'?globalThis:window);
