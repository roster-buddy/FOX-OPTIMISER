/* Read-only future connection recovery state machine.
   Diagnostic simulation only: never schedules, dispatches or confirms a stop.
   Recovery requires a NEW plan and a fresh explicit operator acknowledgement. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const health=node?require('./fox-connection-readiness.js'):root.FoxConnectionReadiness;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
function create(){
 let lastClock=null,active=null,latch='INITIAL_REARM_REQUIRED',reason='Not commissioned';
 const usedIds=new Set();
 const output=()=>({
  state:latch,reason,simulationEligible:latch==='SIMULATION_ARMED',
  planId:latch==='SIMULATION_ARMED'?active?.id:null,
  dispatchApproved:false,accountingApproved:false,recommendedExportKw:0,
  physicalStopConfirmed:false
 });
 const stop=(why)=>{
  if(active)usedIds.add(active.id);
  active=null;latch='REARM_REQUIRED';reason=why;
  return output();
 };
 const clock=now=>{
  if(!finite(now)||now<0)return stop('Invalid clock');
  if(lastClock!==null&&now<lastClock)return stop('Clock moved backwards');
  lastClock=now;return null;
 };
 const planOk=(plan,now,allowActive=false)=>{
  if(!plan||typeof plan.id!=='string'||!plan.id.trim()||
    plan.id.length>128||(usedIds.has(plan.id)&&!(allowActive&&active?.id===plan.id)))
   return 'New, unused plan ID required';
  if(!finite(plan.createdAt)||!finite(plan.expiresAt)||
    plan.createdAt>now||plan.expiresAt<=now||
    plan.expiresAt<=plan.createdAt||plan.expiresAt-plan.createdAt>3600000)
   return 'Plan timing invalid or expired';
  if(!finite(plan.kw)||plan.kw<=0||plan.kw>3.5)
   return 'Invalid simulated export power';
  return null;
 };
 return {
  tick(now,connectionState,plan){
   const badClock=clock(now);if(badClock)return badClock;
   const check=health.inspect(connectionState,now);
   if(!check.ready)return stop('Connection or safety check failed: '+check.failures[0]);
   if(!active){
    reason='Healthy diagnostic; new plan and explicit acknowledgement required';
    return output();
   }
   if(!plan||plan.id!==active.id||plan.createdAt!==active.createdAt||
      plan.expiresAt!==active.expiresAt||plan.kw!==active.kw)
    return stop('Active plan changed or missing');
   if(planOk(plan,now,true))return stop('Active plan expired or invalid');
   reason='Diagnostic simulation armed; no inverter control';
   return output();
  },
  acknowledgeNewPlan(now,connectionState,plan,operatorAcknowledged){
   const badClock=clock(now);if(badClock)return badClock;
   const check=health.inspect(connectionState,now);
   if(!check.ready)return stop('Connection or safety check failed: '+check.failures[0]);
   if(active)return stop('Existing simulation must be stopped before rearming');
   if(operatorAcknowledged!==true){
    reason='Explicit operator acknowledgement required';return output();
   }
   const invalid=planOk(plan,now);
   if(invalid){reason=invalid;return output();}
   active=Object.freeze({id:plan.id,createdAt:plan.createdAt,
    expiresAt:plan.expiresAt,kw:plan.kw});
   usedIds.add(plan.id);
   latch='SIMULATION_ARMED';
   reason='Diagnostic simulation armed; no inverter control';
   return output();
  },
  interrupt(why){
   return stop(typeof why==='string'&&why.trim()?
    'Interrupted: '+why.slice(0,160):'Interrupted; new plan required');
  },
  snapshot:output
 };
}
const api={create};
if(node)module.exports=api;else root.FoxRecoveryLatch=api;
})(typeof window!=='undefined'?window:globalThis);
