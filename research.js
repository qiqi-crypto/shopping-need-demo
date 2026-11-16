(()=>{
 'use strict';const $=id=>document.getElementById(id),API=window.SHOPPING_AGENT_API||location.origin;
 let key=sessionStorage.getItem('rs_research_admin_v1')||'',before=null,selected=null,after=0,busy=false,eventsBusy=false;
 const fmt=value=>value==null?'未记录':(value/1000).toFixed(1)+' 秒';
 const names={session_started:'进入页面',session_resumed:'恢复页面',session_ended:'结束',page_presence:'在线心跳',results_rendered:'列表展示',viewport_exposure:'商品进入视口',search:'搜索',item_considered:'考虑/查看商品',pointer_move:'鼠标移动',pointer_click:'点击',cart_add:'加购',cart_remove:'移出购物车',cart_open:'打开购物车',back_or_close:'返回/关闭',scroll:'滚动',detail_section_view:'查看详情区块',detail_section_toggle:'详情内容加载/展开',selection_proposed:'提出最终选择',selection_confirmed:'确认最终选择',no_selection:'明确不选',page_exit:'离开页面',sort_change:'排序',scene_filter:'场景筛选',category_filter:'品类筛选',page_navigation:'翻页',variant_change:'更换规格'};
 function node(tag,text){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;}
 async function call(path){const r=await fetch(API+path,{headers:{Authorization:'Bearer '+key},cache:'no-store'});if(!r.ok){let d;try{d=await r.json();}catch{}throw Error(d?.detail||'连接失败：'+r.status);}return r;}
 const params=()=>new URLSearchParams({include_tests:String($('include-tests').checked),...($('user-filter').value.trim()?{user_id:$('user-filter').value.trim()}:{})});
 function renderRows(rows,append=false){if(!append)$('sessions').replaceChildren();for(const s of rows){
  const tr=node('tr'),who=node('td');who.append(node('code',s.user_id),node('small',s.round_index?'第 '+s.round_index+' 轮 · '+s.round_source:'未关联实验轮次'));if(s.is_engineering_test)who.append(node('small','工程测试'));
  const source=node('td'),badge=node('span',s.operator_source==='agent'?'Agent':s.operator_role==='self_browser'?'真人（分配）':'用户查看/确认');badge.className='tag '+(s.operator_source==='agent'?'agent':s.operator_role==='self_browser'?'':'review');source.append(badge,node('small',s.operator_role));
  const time=node('td',s.last_received_at);if(s.recently_reporting){const online=node('small','最近 30 秒有记录');online.className='online';time.append(online);}
  const action=node('td'),button=node('button','查看轨迹');button.onclick=()=>inspect(s.session_id);action.append(button);
  tr.append(who,source,node('td',s.event_count),node('td',s.C_us_unique.length+' 件'),node('td',fmt(s.timing.union_ms.page_open_ms)),node('td',fmt(s.timing.union_ms.visible_ms)+' / '+fmt(s.timing.recent_input_ms)),time,action);$('sessions').append(tr);
 }if(!$('sessions').children.length){const tr=node('tr'),td=node('td','暂时没有符合条件的记录。可以勾选“包含工程测试”查看验证数据。');td.colSpan=8;tr.append(td);$('sessions').append(tr);}}
 async function refresh(append=false){if(busy)return;busy=true;try{
  const query=params();if(append&&before)query.set('before',before);
  const [overview,data]=await Promise.all([(await call('/api/research/overview?include_tests='+$('include-tests').checked)).json(),(await call('/api/research/sessions?'+query)).json()]);
  $('summary').replaceChildren(...[['用户',overview.users],['购物记录',overview.sessions],['操作事件',overview.events],['已完成轮次',overview.completed_rounds],['入口访客（含未入组）',overview.visitors]].map(([label,value])=>{const card=node('div');card.className='stat';card.append(node('b',Number(value).toLocaleString()),node('span',label));return card;}));
  const user=$('user-filter').value.trim();$('user-time').hidden=!user;if(user){const time=await(await call('/api/research/users/'+encodeURIComponent(user)+'/time')).json();$('user-time').textContent='该用户页面在线时间（去除重叠标签页）：'+fmt(time.observed_time_union_ms.page_open_ms)+'；前台可见：'+fmt(time.observed_time_union_ms.visible_ms)+'。不含 Agent 自行运行时间。';}
  renderRows(data.sessions,append);before=data.next_before;$('older').hidden=!before;$('status').textContent='已更新 · '+overview.server_at;
 }catch(e){$('status').textContent=e.message;}finally{busy=false;}}
 async function inspect(sid){selected=sid;after=0;$('events').replaceChildren();try{const s=await(await call('/api/research/sessions/'+encodeURIComponent(sid))).json();if(selected!==sid)return;
  $('inspection').hidden=false;$('inspection-title').textContent='记录 · '+sid;$('inspection-summary').textContent='用户 '+s.user_id+' · '+s.started_at+' · '+s.event_count+' 条事件';
  $('sets').replaceChildren(node('p','考虑集合（去重）：'+(s.C_us_unique.join('、')||'暂无详情查看')),node('p','购物车：'+(s.cart_item_ids.join('、')||'空')),node('p','最终选择：'+(s.observed_selection?.item_id||(s.observed_selection?'明确不选':'尚未确认'))));
  $('model-data').textContent=JSON.stringify(s,null,2);await loadEvents();$('inspection').scrollIntoView({behavior:'smooth',block:'start'});
 }catch(e){$('status').textContent=e.message;}}
 async function loadEvents(){if(!selected||eventsBusy)return;eventsBusy=true;const sid=selected;try{const data=await(await call('/api/research/sessions/'+encodeURIComponent(sid)+'/events?after='+after)).json();if(selected!==sid)return;
  for(const r of data.events){const tr=node('tr'),e=r.event,raw=node('td'),details=node('details');details.append(node('summary','展开 JSON'),node('pre',JSON.stringify(r,null,2)));raw.append(details);tr.append(node('td',r.event_index),node('td',r.client_at),node('td',names[r.event_type]||r.event_type),node('td',[e.item_id,e.query,e.section,e.reason].filter(Boolean).join(' · ')),node('td',fmt(r.gap_previous_event_ms)),raw);$('events').append(tr);}
  after=data.next_after;$('more-events').hidden=!data.has_more;
 }catch(e){$('status').textContent=e.message;}finally{eventsBusy=false;}}
 $('login').onsubmit=async e=>{e.preventDefault();key=$('admin-key').value.trim();try{await call('/api/research/overview');sessionStorage.setItem('rs_research_admin_v1',key);$('admin-key').value='';$('login').hidden=true;$('workspace').hidden=false;await refresh();}catch(e){$('status').textContent=e.message;}};
 $('refresh').onclick=()=>refresh();$('include-tests').onchange=()=>refresh();$('user-filter').onchange=()=>refresh();$('older').onclick=()=>refresh(true);$('more-events').onclick=loadEvents;$('close-inspection').onclick=()=>{selected=null;$('inspection').hidden=true;};
 $('logout').onclick=()=>{sessionStorage.removeItem('rs_research_admin_v1');key='';location.reload();};
 $('export').onclick=async()=>{$('export').disabled=true;$('status').textContent='正在生成一致性快照，购物记录仍会继续保存…';try{const response=await call('/api/research/export?include_tests='+$('include-tests').checked),blob=await response.blob(),url=URL.createObjectURL(blob),a=node('a');a.href=url;a.download='rs-agent-dataset-'+new Date().toISOString().slice(0,10)+'.zip';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000);$('status').textContent='数据集已下载。来源标签和问卷历史在 study_only 文件夹中。';}catch(e){$('status').textContent=e.message;}finally{$('export').disabled=false;}};
 if(key){$('login').hidden=true;$('workspace').hidden=false;refresh();}
 setInterval(async()=>{if(key&&!document.hidden){await refresh();if(selected)await loadEvents();}},5000);
})();
