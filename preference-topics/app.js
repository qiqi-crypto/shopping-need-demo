'use strict';
(()=>{
const $=x=>document.getElementById(x),K='preference_topics_v1';let state;try{state=JSON.parse(sessionStorage.getItem(K))}catch{};
if(!state||state.version!==1)state={version:1,study:'information_search',participant_id:crypto.randomUUID(),phase:'setup',round:0,order:crypto.getRandomValues(new Uint8Array(1))[0]%2?['human','ai']:['ai','human'],answers:{},comparison:null};
if(state.phase!=='setup' && state.phase!=='done' && state.mode!=='qovia'){state.phase='setup';state.round=0;}
const testParams=new URLSearchParams(location.search);if(testParams.get('engineering_test')==='1'&&state.phase==='setup'&&testParams.get('test_order')==='human_first')state.order=['human','ai'];
const save=()=>sessionStorage.setItem(K,JSON.stringify(state));const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));const base=window.PREFERENCE_API_BASE,qoviaBase=window.QOVIA_API_BASE||base;let busy=false;
function msg(s){$('message').textContent=s||''}function fmt(t){if(!t)return '';try{return new Date(t).toLocaleString('zh-CN',{timeZone:'Asia/Shanghai'})}catch{return ''}}
async function req(path,options={}){if(!base)throw Error('信息搜索服务尚未配置，请稍后再试。');let r;const target=path.startsWith('/api/topics/qovia/')?(state.phase==='setup'?qoviaBase:(state.qovia_endpoint||base)):base;try{r=await fetch(target+path,{...options,headers:{'Content-Type':'application/json',...options.headers},signal:AbortSignal.timeout((path==='/api/topics/summary'||path==='/api/topics/qovia/summary')?240000:path.startsWith('/api/topics/search')?80000:45000)})}catch{throw Error('暂时连接不上信息搜索服务，请稍后重试。')}let d;try{d=await r.json()}catch{throw Error('服务返回的数据无法读取。')}if(!r.ok){const e=Error(typeof d.detail==='string'?d.detail:'搜索服务暂时不可用，请稍后重试。');e.status=r.status;throw e}return d}
function post(path,data){return req(path,{method:'POST',body:JSON.stringify(data)})}
function buttons(id,handler){$(id).addEventListener('click',handler)}
function sourceLink(url){try{let u=new URL(url);if(u.protocol==='https:'&&['weibo.com','www.weibo.com','m.weibo.cn','weibo.cn'].includes(u.hostname))return u.href}catch{}return ''}
function sourceCard(x){let u=sourceLink(x.url);return `<article class="source"><h3>${esc(x.author||'公开帖子')} ${x.published_at?' · '+esc(fmt(x.published_at)):''}</h3><p>${esc(x.text)}</p>${x.truncated||x.text_completeness==='unknown'?'<span class="pill">正文可能不完整</span> ':''}${u?`<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">查看原文 ↗</a>`:''}</article>`}
function sourceDescription(){return state.snapshot_digest?`资料采集于 ${fmt(state.snapshot_at)}（北京时间），${state.page_count?state.page_count+' 次拉取，':''}去重后 ${state.items.length} 条`:`本批资料共 ${state.items.length} 条`}
const scales=[['fit','这种方式多大程度上帮助你了解想知道的内容？','完全没有','非常有帮助'],['ease','你觉得这种方式使用起来有多省力？','非常费力','非常省力'],['satisfaction','你对这次查找体验满意吗？','非常不满意','非常满意']];
function evaluation(){let arm=state.order[state.round];$('phase-label').textContent='本轮体验';$('app').innerHTML=`<h1>这一轮体验怎么样？</h1><p>请根据刚才${arm==='human'?'自己查找':'使用 AI'}的体验作答。</p><form id="eval">${scales.map(([id,q,l,r])=>`<fieldset><legend>${q}</legend><div class="scale">${[1,2,3,4,5].map(v=>`<label><input type="radio" name="${id}" value="${v}" required>${v}</label>`).join('')}</div><div class="help">1：${l}　　5：${r}</div></fieldset>`).join('')}<div class="actions"><button type="submit" class="primary">${state.round===0?'进入下一轮':'比较两种方式'}</button></div></form>`;$('eval').onsubmit=e=>{e.preventDefault();let f=new FormData(e.target);state.answers[arm]=Object.fromEntries(scales.map(([id])=>[id,Number(f.get(id))]));if(state.round===0){state.round=1;state.phase='round'}else state.phase='comparison';save();render()}}
function comparison(){ $('phase-label').textContent='比较两种方式';$('progress').textContent='4 / 4';$('app').innerHTML=`<h1>你更喜欢哪一种？</h1><p>两轮都围绕“${esc(state.question)}”。</p><form id="compare">${[['preferred','总体来说，你更喜欢哪一种？'],['fit','哪一种更符合你的需求？'],['ease','哪一种让你觉得更省力？']].map(([n,q])=>`<fieldset><legend>${q}</legend><div class="scale">${[['human','自己查找'],['ai','AI 帮助'],['same','差不多']].map(([v,t])=>`<label><input type="radio" name="${n}" value="${v}" required>${t}</label>`).join('')}</div></fieldset>`).join('')}<label for="reason">还有什么想说的？（可选）</label><textarea id="reason" maxlength="500"></textarea><div class="actions"><button class="primary" type="submit">提交</button></div></form>`;$('compare').onsubmit=async e=>{e.preventDefault();if(busy)return;let f=new FormData(e.target);state.comparison={preferred:f.get('preferred'),fit:f.get('fit'),ease:f.get('ease'),reason:$('reason').value.trim()};save();busy=true;let btn=e.target.querySelector('button');btn.disabled=true;msg('正在保存…');try{await post('/api/preference/results',{schema:'preference-study-v1',study:state.study,engineering_test:new URLSearchParams(location.search).get('engineering_test')==='1',participant_id:state.participant_id,topic:state.topic,question:state.question,snapshot_id:state.snapshot_id,snapshot_at:state.snapshot_at,snapshot_digest:state.snapshot_digest||null,source_pages:state.page_count||null,order:state.order,round_answers:state.answers,comparison:state.comparison,completed_at:new Date().toISOString()});state.phase='done';save();msg('');render()}catch(err){msg('未提交成功：'+err.message+' 你的回答仍保存在当前浏览器，可重试。')}finally{busy=false;btn.disabled=false}}}
// The following experiment-only adapter is enabled only in this isolated copy.
let qoviaPage=1,qoviaQuery='',qoviaBusy=false;
function setup(){
 $('phase-label').textContent='确定话题';$('progress').textContent='1 / 4';
 $('app').innerHTML=`<h1>你想了解什么？</h1><p>两轮使用同一批已保存的历史资料。</p><div class="banner"><strong>黄仁勋辞职（小样本预览）</strong><br>并非完整舆情；视频或外链内容可能未收录。</div><input id="topic" type="hidden" value="黄仁勋辞职"><label for="question">你具体想知道什么？</label><textarea id="question" maxlength="300" placeholder="例如：这件事发生了什么？有哪些不同的说法？">${esc(state.question||'')}</textarea><div class="actions"><button id="begin" class="primary">开始查找</button></div>`;
 buttons('begin',begin);
}

async function begin(){
 if(busy)return;
 const question=$('question').value.trim();
 if(!question){msg('请填写想了解的问题。');return}
 busy=true;$('begin').disabled=true;msg('正在准备资料，请稍候…');
 try{
  const d=await req('/api/topics/qovia/manifest');
  if(!/^[a-f0-9]{64}$/.test(d.revision)||!Number.isInteger(d.total)||d.total<1)throw Error('历史资料暂不可用。');
  Object.assign(state,{mode:'qovia',qovia_endpoint:qoviaBase,topic:'黄仁勋辞职',question,snapshot_id:'qovia:'+d.revision,snapshot_digest:d.revision,snapshot_at:null,page_count:null,corpus_total:d.total,items:[],ai:null,ai_job:null,phase:'round',round:0});
  save();msg('');render();
 }catch(e){msg(e.message)}finally{busy=false;if($('begin'))$('begin').disabled=false}
}
function qoviaCard(x){return sourceCard({...x,author:'',truncated:x.completeness==='provider_truncated',text_completeness:x.completeness==='provider_truncated'?'partial':x.completeness})}
async function qoviaSearch(){
 if(qoviaBusy)return;qoviaBusy=true;msg('');$('sources').innerHTML='<p>正在搜索…</p>';
 try{
  const d=await req('/api/topics/qovia/posts?'+new URLSearchParams({revision:state.snapshot_digest,query:qoviaQuery,page:String(qoviaPage),page_size:'10'}));
  if(d.revision!==state.snapshot_digest||!Array.isArray(d.items))throw Error('历史资料版本不一致。');
  if(!$('sources'))return;
  $('sources').innerHTML=d.items.length?d.items.map(qoviaCard).join(''):'<p>没有找到相关内容，请尝试其他关键词。</p>';
  $('qovia-page-info').textContent=`第 ${d.page} 页 · 共 ${d.total} 条`;
  $('qovia-prev').disabled=d.page<=1;$('qovia-next').disabled=d.page*d.page_size>=d.total;
 }catch(e){if($('sources'))$('sources').innerHTML='';msg(e.message)}finally{qoviaBusy=false}
}
function round(){
 const arm=state.order[state.round];$('phase-label').textContent=`第 ${state.round+1} 轮`;$('progress').textContent=`${state.round+2} / 4`;
 $('app').innerHTML=`<h1>${arm==='human'?'自己查找信息':'AI 帮你整理'}</h1><p>两轮使用同一个历史资料库；视频或外链内容可能未收录。</p><div class="banner"><strong>${esc(state.topic)}</strong><br>${esc(state.question)}</div>${arm==='human'?`<div class="bar"><input type="text" id="filter" placeholder="在历史帖子中搜索"><button id="filter-button">搜索</button></div><p class="help">共 ${state.corpus_total} 条资料，仅展示微博配文；可输入关键词筛选，也可以浏览。</p><div id="sources"></div><div class="actions"><button id="qovia-prev">上一页</button><span id="qovia-page-info"></span><button id="qovia-next">下一页</button></div>`:`<p class="help">AI 会从资料库中挑选微博并整理，请查看引用。</p><button id="get-ai" class="primary">${state.ai?'重新生成摘要':'生成摘要'}</button><p id="ai-status" class="ai-status" role="status" aria-live="polite"></p><div id="ai-result"></div>`}<div class="actions"><button id="to-eval" class="primary" ${arm==='ai'&&!state.ai?'disabled':''}>完成本轮，填写体验</button></div>`;
 if(arm==='human'){
  qoviaPage=1;qoviaQuery='';$('filter-button').onclick=()=>{qoviaPage=1;qoviaQuery=$('filter').value.trim();qoviaSearch()};
  $('filter').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();$('filter-button').click()}});
  $('qovia-prev').onclick=()=>{if(!qoviaBusy&&qoviaPage>1){qoviaPage--;qoviaSearch()}};$('qovia-next').onclick=()=>{if(!qoviaBusy){qoviaPage++;qoviaSearch()}};qoviaSearch();
 }else{$('get-ai').onclick=generate;if(state.ai)showAI();if(state.ai_job)generate()}
 $('to-eval').onclick=()=>{state.phase='evaluation';save();render()};
}
async function generate(){
 if(busy)return;busy=true;$('get-ai').disabled=true;$('to-eval').disabled=true;msg('');$('ai-status').textContent='正在准备整理资料…';
 try{
  // Sessions started before the parallel service keep using the original
  // synchronous endpoint and original corpus. New sessions pin the new origin.
  if(!state.qovia_endpoint){
   const d=await post('/api/topics/qovia/summary',{revision:state.snapshot_digest,query:state.question});
   if(d.revision!==state.snapshot_digest||typeof d.answer!=='string'||!d.answer.trim()||!Array.isArray(d.citations)||!d.citations.length)throw Error('AI 没有返回可核对的资料引用。');
   state.ai={answer:d.answer,citations:d.citations,retrieved_count:d.retrieved_count,matched_total:d.matched_total,corpus_total:Number.isInteger(d.corpus_total)?d.corpus_total:null,selection_method:d.selection_method||null};save();$('ai-status').textContent='';showAI();$('to-eval').disabled=false;return;
  }
  // Create the identifier before the request. A dropped connection or reload
  // retries this same job instead of starting another billable workflow.
  const fresh=!state.ai_job;
  if(fresh){state.ai_job={id:crypto.randomUUID(),revision:state.snapshot_digest,question:state.question};save()}
  const job=state.ai_job;
  if(job.revision!==state.snapshot_digest||job.question!==state.question)throw Error('需求已变化，请重新开始。');
  // On recovery query the existing task first. Never create a second model
  // workflow automatically after a lost response or a server restart.
  let d=fresh?await post('/api/topics/qovia/summary/jobs',{job_id:job.id,revision:job.revision,query:job.question}):await req('/api/topics/qovia/summary/jobs/'+encodeURIComponent(job.id));
  while(d.status==='running'){
   if(!$('ai-status'))return;
   $('ai-status').textContent=d.waiting?'正在排队，请稍候…':Number.isInteger(d.total_batches)?`正在整理资料（${d.completed_batches} / ${d.total_batches} 批），请稍候…`:'正在准备整理资料，请稍候…';
   await new Promise(resolve=>setTimeout(resolve,8000));
   d=await req('/api/topics/qovia/summary/jobs/'+encodeURIComponent(job.id));
  }
  if(d.status==='failed'){state.ai_job=null;save();throw Error(d.detail||'摘要暂时无法完成，请稍后重试。')}
  if(d.status!=='complete'||!d.result)throw Error('摘要状态暂不可用，请重试。');
  d=d.result;
  if(d.revision!==state.snapshot_digest||typeof d.answer!=='string'||!d.answer.trim()||!Array.isArray(d.citations)||!d.citations.length)throw Error('AI 没有返回可核对的资料引用。');
  state.ai={answer:d.answer,citations:d.citations,retrieved_count:d.retrieved_count,matched_total:d.matched_total,corpus_total:Number.isInteger(d.corpus_total)?d.corpus_total:null,selection_method:d.selection_method||null};state.ai_job=null;save();$('ai-status').textContent='';showAI();$('to-eval').disabled=false;
 }catch(e){if(e.status===404){state.ai_job=null;save()}if($('ai-status'))$('ai-status').textContent='摘要暂时无法生成：'+e.message+' 请点击按钮重试。'}finally{busy=false;if($('to-eval'))$('to-eval').disabled=!state.ai;if($('get-ai')){$('get-ai').disabled=false;$('get-ai').textContent=state.ai?'重新生成摘要':'重新尝试生成摘要'}}
}
function showAI(){
 const method=state.ai.selection_method==='topic_overview_time_diverse'?'按时间分布挑选':state.ai.selection_method==='query_lexical_ranked'?'按问题关键词挑选':null;
 const count=state.ai.corpus_total!==null&&state.ai.corpus_total!==undefined?`AI 本次从 ${esc(state.ai.corpus_total)} 条资料中参考了 ${esc(state.ai.retrieved_count)} 条`:`AI 本次参考了 ${esc(state.ai.retrieved_count)} 条资料`;
 $('ai-result').innerHTML=`<h2>整理结果</h2><p class="answer">${esc(state.ai.answer)}</p><p class="help">${count}${method?'，'+method:''}。</p><h2>参考资料</h2>${state.ai.citations.map(qoviaCard).join('')}`;
}
function render(){msg('');if(state.phase==='setup')setup();else if(state.phase==='round')round();else if(state.phase==='evaluation')evaluation();else if(state.phase==='comparison')comparison();else if(state.phase==='done'){$('phase-label').textContent='已完成';$('progress').textContent='完成';$('app').innerHTML='<h1>已完成，谢谢参与！</h1><p>你的体验反馈已提交。</p><div class="actions"><button id="restart">再次体验</button></div>';$('restart').onclick=()=>{sessionStorage.removeItem(K);location.reload()}}else{state.phase='setup';save();setup()}}
render();
})();
