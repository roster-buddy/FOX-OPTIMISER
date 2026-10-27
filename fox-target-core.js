
/* Read-only target research. No measured-history approval or device control. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const scheduler=node?require('./fox-schedule-core.js'):root.FoxScheduleCore;
const overnight=node?require('./fox-overnight-core.js'):root.FoxOvernightCore;

function decide(now,night,previous){
 if(!Number.isFinite(now)||!Number.isFinite(night.start)||
    !Number.isFinite(night.end)||night.end<=night.start)
  throw Error('Invalid decision window');
 if(previous&&previous.start===night.start&&previous.end===night.end&&
    previous.target===100&&Number.isFinite(previous.decidedAt)&&
    previous.decidedAt>=night.start&&previous.decidedAt<=now)
  return previous;
 const pending=now<night.start;
 return {
  start:night.start,end:night.end,target:100,
  decidedAt:pending?null:now,
  pending,
  late:!pending&&now-night.start>60000,
  note:'100% fallback: measured household/solar history is not validated.'
 };
}

function compare(c,slots,nightCfg,now){
 if(!slots.length||slots.some(s=>s.cheap&&!s.flexCharge))
  throw Error('Complete daytime inputs required');
 const night=overnight.windowFor(now);
 if(Date.parse(slots[0].utc)!==night.end)
  throw Error('Daytime comparison must start at 05:30');
 if(Date.parse(slots.at(-1).utc)+1800000!==
    overnight.eventAt(night.end,'23:30'))
  throw Error('Daytime comparison must cover through 23:30');
 const candidates=[];
 for(let target=20;target<=100;target+=5){
  const charge=overnight.simulate({...nightCfg,target},now);
  if(charge.batteryShort>.000001||charge.householdExceedsCap||charge.gridExceeded)continue;
  const config={...c,initial:c.capacity*charge.predictedSoc/100};
  const result=scheduler.solve(config,slots);
  if(!result.ok||!result.valid||!result.reached19)continue;
  // Replay selected actions through the same accounting engine.
  const checked=scheduler.replay(
   config,slots,result.steps.map(x=>x.forced),
   result.steps.map(x=>x.chargeGrid)
  );
  if(!checked.valid)continue;
  const overnightCost=charge.batDelivered*c.refillP/100;
  candidates.push({
   target,socAt0530:charge.predictedSoc,
   cost:overnightCost+checked.financial.cost,
   overnightCost,overnightKWh:charge.batDelivered,
   at19:checked.at19/c.capacity*100,
   forced:checked.forced,result:checked,
   evShort:charge.evShort
  });
 }
 if(!candidates.length)return {ok:false,reason:'No feasible target meets the modelled requirements'};
 candidates.sort((a,b)=>a.cost-b.cost||a.overnightKWh-b.overnightKWh||a.target-b.target);
 return {
  ok:true,best:candidates[0],
  full:candidates.find(x=>x.target===100)||null,
  candidates,
  activeTarget:100,
  researchOnly:true
 };
}
const api={decide,compare};
if(node)module.exports=api;
else root.FoxTargetCore=api;
})(typeof window!=='undefined'?window:globalThis);
