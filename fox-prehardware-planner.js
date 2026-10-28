/* v28-v33: pre-hardware integrated day plan, no real-time control.
   Read-only and deliberately conservative: forecast solar NEVER tops up SOC.
   Half-hour power limits are planning assumptions, not instantaneous enforcement. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const decision=node?require('./fox-export-decision-simulation.js'):root.FoxExportDecisionSimulation;
const recovery=node?require('./fox-recovery-latch.js'):root.FoxRecoveryLatch;
const overnight=node?require('./fox-overnight-core.js'):root.FoxOvernightCore;
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const finite=x=>typeof x==='number'&&Number.isFinite(x);
const fail=reason=>({ok:false,reason,rows:[],dispatchApproved:false,accountingApproved:false,status:'SIMULATION_ONLY'});
function planDay(input){
 if(!input||!Array.isArray(input.slots)||input.slots.length!==27)
  return fail('Require 27 consecutive daytime half-hour slots (05:30 to 19:00)');
 if(!finite(input.capacityKwh)||input.capacityKwh<=0||input.capacityKwh>100||
  !finite(input.socPct)||input.socPct<0||input.socPct>100||
  !finite(input.dischargeEfficiency)||input.dischargeEfficiency<=0||input.dischargeEfficiency>1)
  return fail('Invalid capacity, SOC or efficiency');
 const slots=input.slots;
 let expected=slots[0]?.start;
 for(let i=0;i<slots.length;i++){
  const s=slots[i];
  if(!s||!finite(s.start)||!finite(s.end)||s.start!==expected||
    s.end-s.start!==1800000||!finite(s.houseKwh)||s.houseKwh<0||
    !finite(s.exportPence)||!finite(s.headroomKw)||s.headroomKw<0||s.headroomKw>3.5)
   return fail('Missing, overlapping or invalid forecast slot '+(i+1));
  expected=s.end;
  const label=clock.format(new Date(s.start));
  if(i===0&&label!=='05:30')return fail('Day must begin at 05:30 UK time');
 }
 if(clock.format(new Date(expected))!=='19:00')
  return fail('Day must finish at 19:00 UK time');
 if(input.forecastQuality!=='SCENARIO_VALIDATED')
  return fail('Household demand forecast not validated for simulation');
 const demand=slots.reduce((sum,s)=>sum+s.houseKwh,0);
 const reserve=input.capacityKwh*.20;
 const initial=input.capacityKwh*input.socPct/100;
 const budget=Math.max(0,initial-reserve-demand);
 const candidates=[];
 for(let i=0;i<slots.length;i++){
  const s=slots[i];
  const result=decision.evaluate({
   now:s.start,readOnlySimulation:true,socPct:input.socPct,
   capacityKwh:input.capacityKwh,demandUntil19Kwh:demand,
   exportPence:s.exportPence,peakImportPence:input.peakImportPence,
   cheapImportPence:input.cheapImportPence,wearPence:input.wearPence,
   efficiency:input.dischargeEfficiency,solarOpportunityPence:input.solarOpportunityPence,
   exportHeadroomKw:s.headroomKw,batteryPowerKw:input.batteryPowerKw,
   solarOriginVerified:input.solarOriginVerified,
   demandForecastVerified:true,tariffApplicableVerified:input.tariffApplicableVerified,
   instantaneousHeadroomVerified:input.instantaneousHeadroomVerified
  });
  if(result.eligible)candidates.push({index:i,price:s.exportPence,limitKwh:result.simulatedKwh});
 }
 // Choose highest-value slots, preserving enough battery for ALL forecast
 // household consumption and 20% SOC at 19:00. No speculative PV refill.
 candidates.sort((a,b)=>b.price-a.price||a.index-b.index);
 const allocations=new Array(slots.length).fill(0);
 let remaining=budget;
 for(const c of candidates){
  const ac=Math.min(c.limitKwh,remaining*input.dischargeEfficiency);
  if(ac>0){allocations[c.index]=ac;remaining-=ac/input.dischargeEfficiency;}
 }
 let soc=initial,earnings=0;
 const rows=[];
 for(let i=0;i<slots.length;i++){
  const s=slots[i],exportKwh=allocations[i];
  soc-=s.houseKwh+exportKwh/input.dischargeEfficiency;
  if(soc<reserve-1e-7)return fail('Battery reserve violated in simulation');
  const revenue=exportKwh*s.exportPence/100;
  earnings+=revenue;
  rows.push({start:s.start,end:s.end,houseKwh:s.houseKwh,
   exportPence:s.exportPence,simulatedExportKwh:exportKwh,
   simulatedExportKw:exportKwh*2,remainingBatteryKwh:soc,
   simulatedRevenueGbp:revenue,solarCreditKwh:0});
 }
 return {ok:true,status:'SIMULATION_ONLY',rows,
  exportKwh:rows.reduce((a,r)=>a+r.simulatedExportKwh,0),
  exportRevenueGbp:earnings,at19Kwh:soc,requiredReserveKwh:reserve,
  predictedHouseKwh:demand,unusedExportBudgetDcKwh:remaining,
  dispatchApproved:false,accountingApproved:false,
  instantaneousEnforcementActive:false,
  assumptions:'Forecast household demand deducted conservatively; solar generation not credited; physical grid headroom and reserve not enforced'};
}
function forecastQuality(input){
 if(!input||!Array.isArray(input.slots))return {quality:'MISSING',reason:'No forecast'};
 if(input.slots.some(s=>!finite(s?.houseKwh)||s.houseKwh<0))
  return {quality:'MISSING',reason:'Missing household interval forecast'};
 if(input.source==='synthetic')return {quality:'SCENARIO_VALIDATED',reason:'Synthetic demand only; not measured or live'};
 return {quality:'UNVERIFIED',reason:'Real forecast needs independent validation before use'};
}
function fullSimulation(config){
 const day=planDay(config?.day);
 const diagnostics=[];
 if(!day.ok)return {ok:false,day,diagnostics,dispatchApproved:false};
 let overnightResult=null;
 if(config?.overnight){
  try{overnightResult=overnight.simulate(config.overnight.settings,config.overnight.now);}
  catch(e){return {ok:false,day,diagnostics:[String(e.message)],dispatchApproved:false};}
  if(overnightResult.gridExceeded||overnightResult.householdExceedsCap||
    overnightResult.batteryShort>1e-6||overnightResult.evShort>1e-6)
   diagnostics.push('Overnight charge scenario incomplete or exceeds grid cap');
 }
 const latch=recovery.create();
 const sample=config?.recovery;
 if(sample){
  const plan=sample.plan;
  const initial=latch.acknowledgeNewPlan(sample.now,sample.connections,plan,sample.acknowledged);
  const next=latch.tick(sample.now+1,sample.connections,plan);
  diagnostics.push('Recovery simulation: '+initial.state+' / '+next.state);
  if(next.simulationEligible!==true)diagnostics.push('Recovery gate blocked simulated plan');
 }
 return {ok:diagnostics.every(s=>!s.includes('incomplete')&&!s.includes('blocked')),
  day,overnight:overnightResult,diagnostics,dispatchApproved:false,
  accountingApproved:false,status:'SIMULATION_ONLY'};
}
const api={planDay,forecastQuality,fullSimulation};
if(node)module.exports=api;else root.FoxPrehardwarePlanner=api;
})(typeof window!=='undefined'?window:globalThis);
