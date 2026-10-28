/* Read-only household benefit and verified forced grid export.
   Household savings are a counterfactual, NEVER an additional cash receipt. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const measured=node?require('./fox-recorded-data.js'):root.FoxRecordedData;
const unavailable=reason=>({available:false,value:null,reason});
function matched(a,b){
 return a.length===b.length&&a.every((row,i)=>row.start===b[i].start&&row.end===b[i].end);
}
function parts(input,window,now){
 const streams=input?.streams||{},tariffs=input?.tariffs||{};
 const required=['houseDemand','houseGrid','houseDirectSolar','houseBattery','gridImport'];
 const inspected=Object.fromEntries(required.map(key=>[key,measured.inspect(streams[key],window,now)]));
 const notReady=required.find(key=>!inspected[key].available);
 if(notReady)return unavailable(notReady+': '+inspected[notReady].reason);
 const master=inspected.houseDemand.intervals;
 for(const key of required.slice(1)){
  if(!matched(master,inspected[key].intervals))return unavailable('Household and meter readings need matching intervals');
 }
 // The house meter MUST exclude EV demand and verified solar/battery deliveries.
 for(const key of required.slice(0,4))
  if(inspected[key].intervals.some(r=>r.scope!=='house-only'||r.excludesEV!==true))
   return unavailable('Verified house-only measurements excluding EV are required');
 const tolerance=1e-6;
 for(let i=0;i<master.length;i++){
  const demand=master[i].value;
  const supplied=inspected.houseGrid.intervals[i].value+
   inspected.houseDirectSolar.intervals[i].value+inspected.houseBattery.intervals[i].value;
  if(Math.abs(supplied-demand)>tolerance)
   return unavailable('House demand and source contributions do not reconcile');
  if(inspected.houseGrid.intervals[i].value>inspected.gridImport.intervals[i].value+tolerance)
   return unavailable('House grid consumption exceeds measured meter import');
 }
 const baseline=measured.price(streams.houseDemand,tariffs.import,window,now);
 if(!baseline.available)return unavailable('Household comparison: '+baseline.reason);
 const grid=measured.price(streams.houseGrid,tariffs.import,window,now);
 if(!grid.available)return unavailable('Actual household grid cost: '+grid.reason);
 let batteryCost=0;
 const batteryKwh=inspected.houseBattery.total;
 if(batteryKwh>tolerance){
  const basis=tariffs.houseBatteryDeliveredCost;
  if(!Array.isArray(basis)||!basis.length||basis.some(r=>r?.basis!=='verified-storage-lot-ledger'))
   return unavailable('Verified carried-battery cost lots, including charging losses, required');
  const allocation=measured.price(streams.houseBattery,basis,window,now);
  if(!allocation.available)return unavailable('Battery supply cost: '+allocation.reason);
  batteryCost=allocation.cost;
 }
 const actualCost=grid.cost+batteryCost;
 const saved=baseline.cost-actualCost;
 if(![baseline.cost,grid.cost,batteryCost,actualCost,saved].every(Number.isFinite))
  return unavailable('Household cost is outside the valid range');
 return {available:true,value:saved,total:inspected.houseDemand.total,
  baselineCost:baseline.cost,actualCost,gridCost:grid.cost,batteryCost,
  houseKwh:inspected.houseDemand.total,solarKwh:inspected.houseDirectSolar.total,
  batteryKwh,gridKwh:inspected.houseGrid.total,
  reason:null,scope:'bill savings only; foregone solar export opportunity and battery wear excluded'};
}
function forced(input,window,now){
 const streams=input?.streams||{},tariffs=input?.tariffs||{};
 const force=measured.inspect(streams.forcedGridExport,window,now);
 if(!force.available)return unavailable('Verified forced grid export: '+force.reason);
 const grid=measured.inspect(streams.gridExport,window,now);
 if(!grid.available)return unavailable('Grid export meter: '+grid.reason);
 const battery=measured.inspect(streams.batteryExport,window,now);
 if(!battery.available)return unavailable('Battery-origin export: '+battery.reason);
 if(!matched(force.intervals,grid.intervals)||!matched(force.intervals,battery.intervals))
  return unavailable('Force-discharge, battery and export readings require matching intervals');
 if(force.intervals.some((r,i)=>r.source!=='fox'||r.attribution!=='verified-grid-export'||
     r.value>grid.intervals[i].value+1e-6||
     r.value>battery.intervals[i].value+1e-6))
  return unavailable('Forced export needs verified battery-to-grid attribution within meter totals');
 const priced=measured.price(streams.forcedGridExport,tariffs.export,window,now);
 if(!priced.available)return unavailable('Forced export earnings: '+priced.reason);
 if(!Number.isFinite(priced.cost))return unavailable('Invalid forced export earnings');
 return {available:true,value:priced.cost,total:priced.total,reason:null,
  scope:'Gross forced-export receipts already included in total grid export; not additional net profit'};
}
function build(window,input,now){
 const savings=parts(input,window,now);
 const forceExport=forced(input,window,now);
 return {savings,forceExport,
  forceNet:unavailable('Incremental force-discharge profit needs verified battery energy costs, degradation and a no-discharge counterfactual'),
  economicSavings:unavailable('Foregone solar export value and any dispatch trade-offs require a validated counterfactual')};
}
const api={build,parts,forced};
if(node)module.exports=api;
else root.FoxHouseholdBenefit=api;
})(typeof window!=='undefined'?window:globalThis);
