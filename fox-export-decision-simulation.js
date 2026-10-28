/* Read-only scenario evaluator. Never connects to or controls an inverter. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const finite=n=>typeof n==='number'&&Number.isFinite(n);
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const unavailable=reason=>({eligible:false,reason,simulatedKw:0,dispatchApproved:false,accountingApproved:false,status:'SIMULATION_ONLY'});
function evaluate(s){
 if(!s||!finite(s.now)||s.now<0)return unavailable('Invalid simulation clock');
 const p=Object.fromEntries(clock.formatToParts(new Date(s.now)).map(x=>[x.type,x.value]));
 const minutes=Number(p.hour)*60+Number(p.minute);
 if(minutes<330||minutes>1110)return unavailable('Outside 05:30–19:00 UK local time');
 if(s.readOnlySimulation!==true)return unavailable('Simulation mode not confirmed');
 const fields=['socPct','capacityKwh','demandUntil19Kwh','exportPence','peakImportPence',
 'cheapImportPence','wearPence','efficiency','solarOpportunityPence','exportHeadroomKw',
 'batteryPowerKw'];
 if(fields.some(key=>!finite(s[key])))return unavailable('Incomplete numerical assumptions');
 if(s.socPct<0||s.socPct>100||s.capacityKwh<=0||s.capacityKwh>100||
 s.demandUntil19Kwh<0||s.exportPence< -100||s.exportPence>500||
 s.peakImportPence<0||s.cheapImportPence<0||s.wearPence<0||
 s.solarOpportunityPence<0||s.efficiency<=0||s.efficiency>1||
 s.exportHeadroomKw<0||s.exportHeadroomKw>3.5||
 s.batteryPowerKw<=0||s.batteryPowerKw>20)
 return unavailable('Out-of-range assumptions');
 for(const key of ['solarOriginVerified','demandForecastVerified',
 'tariffApplicableVerified','instantaneousHeadroomVerified']){
  if(s[key]!==true)return unavailable('Missing prerequisite: '+key);
 }
 const threshold=Math.max(s.peakImportPence,
 s.cheapImportPence/s.efficiency,s.solarOpportunityPence)+s.wearPence;
 if(s.exportPence<=threshold)return unavailable('Export price below opportunity cost');
 const reserveKwh=s.capacityKwh*.20;
 const availableKwh=Math.max(0,s.capacityKwh*s.socPct/100-reserveKwh-s.demandUntil19Kwh);
 if(availableKwh<=0)return unavailable('Reserve plus household demand consumes available energy');
 const kw=Math.min(availableKwh/.5,s.exportHeadroomKw,s.batteryPowerKw);
 if(kw<=0)return unavailable('No export headroom');
 return {eligible:true,reason:'Scenario passes conservative price and reserve checks',
 simulatedKw:kw,simulatedKwh:kw*.5,availableKwh,reserveKwh,thresholdPence:threshold,
 solarCreditKwh:0,status:'SIMULATION_ONLY',dispatchApproved:false,accountingApproved:false,
 instantaneousEnforcementActive:false};
}
const api={evaluate};
if(node)module.exports=api;else root.FoxExportDecisionSimulation=api;
})(typeof window!=='undefined'?window:globalThis);
