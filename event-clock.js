/* Common clocks for human and Agent browsers. No keys or typed text are captured. */
(()=>{
 'use strict';
 const page=crypto.randomUUID(),origin=performance.timeOrigin;
 window.rsEventClock={envelope:()=>({page_instance_id:page,client_monotonic_ms:Math.round(performance.now()),client_time_origin_ms:origin,visibility_state:document.visibilityState,focused:document.hasFocus()})};
 window.rsStartPresence=function(record,isOpen=()=>true,context=()=>({})){
  let last=performance.now(),visible=!document.hidden,focused=document.hasFocus(),lastInput=-Infinity,stopped=false;
  function tick(reason){
   const end=performance.now(),gap=end-last;
   if(!stopped&&isOpen()&&gap>0){
    // A long suspended interval is unknown, not assumed online or engaged.
    const observed=gap<=30000?gap:0;
    record('page_presence',{...context(),reason,interval_start_ms:Math.round(last),interval_end_ms:Math.round(end),
     page_open_ms:Math.round(observed),visible_ms:visible?Math.round(observed):0,
     focused_ms:visible&&focused?Math.round(observed):0,
     recent_input_ms:visible&&focused&&observed?Math.round(Math.max(0,Math.min(end,lastInput+30000)-last)):0,
     unobserved_ms:observed?0:Math.round(gap),activity_window_ms:30000,heartbeat_target_ms:10000});
   }
   last=end;
  }
  const visibility=()=>{tick('visibility_change');visible=!document.hidden;};
  const focus=()=>{tick('focus');focused=true;};const blur=()=>{tick('blur');focused=false;};
  const activity=e=>{if(!e.isTrusted)return;tick('input');lastInput=performance.now();};
  // Throttle presence accounting on input; movement coordinates are logged separately.
  let lastActivity=0;const input=e=>{if(performance.now()-lastActivity<1000)return;lastActivity=performance.now();activity(e);};
  const hide=()=>{tick('pagehide');};const show=()=>{last=performance.now();visible=!document.hidden;focused=document.hasFocus();};
  document.addEventListener('visibilitychange',visibility);window.addEventListener('focus',focus);window.addEventListener('blur',blur);
  for(const type of ['pointerdown','pointermove','keydown','scroll'])document.addEventListener(type,input,{capture:true,passive:true});
  window.addEventListener('pagehide',hide);window.addEventListener('pageshow',show);
  const timer=setInterval(()=>tick('heartbeat'),10000);
  return ()=>{if(stopped)return;tick('stop');stopped=true;clearInterval(timer);document.removeEventListener('visibilitychange',visibility);window.removeEventListener('focus',focus);window.removeEventListener('blur',blur);for(const type of ['pointerdown','pointermove','keydown','scroll'])document.removeEventListener(type,input,true);window.removeEventListener('pagehide',hide);window.removeEventListener('pageshow',show);};
 };
})();
