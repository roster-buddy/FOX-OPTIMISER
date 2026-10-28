/* Pure recorded-data report assembler. No fetches or forecast fallback. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const dates=node?require('./fox-actual-costs.js'):root.FoxActualCosts;
const recorded=node?require('./fox-recorded-data.js'):root.FoxRecordedData;
const benefit=node?require('./fox-household-benefit.js'):root.FoxHouseholdBenefit;
const discharge=node?require('./fox-discharge-flow.js'):root.FoxDischargeFlow;
const solarLedger=node?require('./fox-solar-storage-ledger.js'):root.FoxSolarStorageLedger;
function build(endDay,input,now){
 const window=dates.windowFor(endDay);
 const streams=input?.streams||{},tariffs=input?.tariffs||{};
 const metric=(key,rate)=>recorded.price(streams[key],tariffs[rate],window,now);
 const gridImport=metric('gridImport','import');
 const gridExport=metric('gridExport','export');
 const batteryCharge=metric('batteryGridCharge','import');
 const evCharge=metric('evGridCharge','import');
 const energy=key=>recorded.inspect(streams[key],window,now);
 // Household grid use must be separately measured, not a guessed residual.
 const houseGrid=metric('houseGrid','import');
 const solarExport=energy('solarExport'),batteryExport=energy('batteryExport');
 const unavailable=reason=>({available:false,value:null,reason});
 const importCheck=reconcile(streams,['gridImport','batteryGridCharge','evGridCharge','houseGrid'],window,now,false);
 const exportCheck=reconcile(streams,['gridExport','solarExport','batteryExport'],window,now,true);
 const cashBalance=importCheck.available&&[gridExport,batteryCharge,evCharge].every(x=>x.available)?
  {available:true,value:gridExport.cost-batteryCharge.cost-evCharge.cost,reason:null}:
  unavailable(importCheck.reason||'Complete export earnings, battery charging and EV charging costs required');
 const household=benefit.build(window,input,now);
 const dischargeFlow=discharge.calculate(input,window,now);
 // All battery source history (including the opening inventory) must be
 // supplied by a verified adapter before solar-origin gains can be claimed.
 const ledger=input?.solarStorageHistory?
  solarLedger.trace(input.solarStorageHistory,{verified:true,initial:input.solarOpeningLots}):
  {available:false,reason:'Verified solar/grid battery source history not connected'};
 const attributed=ledger.available?ledger.days.find(x=>x.day===endDay):null;
 const solarStorage=attributed?
  {available:true,value:attributed.solarExportGainGbp,
   day:endDay,...attributed,method:ledger.method}:
  {available:false,reason:ledger.available?
   'No source-attributed solar/battery history for selected day':ledger.reason};
 const gridBalance=gridImport.available&&gridExport.available?
  {available:true,value:gridImport.cost-gridExport.cost,reason:null}:
  unavailable('Complete grid import and export pricing required');
 return {importCheck,exportCheck,window,gridImport,gridExport,batteryCharge,evCharge,houseGrid,solarExport,batteryExport,cashBalance,gridBalance,
  savings:household.savings,forceExport:household.forceExport,forceNet:household.forceNet,economicSavings:household.economicSavings,dischargeFlow,solarStorage,
  standingCharge:unavailable('Historical standing charge not connected')};
}
// Compare matching measured intervals; never spread energy uniformly to force a match.
function reconcile(streams,keys,window,now,exact){
 const checks=keys.map(key=>recorded.inspect(streams[key],window,now));
 const missing=checks.findIndex(x=>!x.available);
 if(missing>=0)return {available:false,reason:'Reconciliation waiting for '+keys[missing]+' readings'};
 const main=checks[0].intervals;
 for(const check of checks.slice(1)){
  if(check.intervals.length!==main.length||check.intervals.some((r,i)=>r.start!==main[i].start||r.end!==main[i].end))
   return {available:false,reason:'Readings need matching intervals for reconciliation'};
 }
 for(let i=0;i<main.length;i++){
  const sum=checks.slice(1).reduce((n,x)=>n+x.intervals[i].value,0);
  if(exact?Math.abs(sum-main[i].value)>1e-6:sum-main[i].value>1e-6)
   return {available:false,reason:exact?'Solar and battery export split conflicts with meter':'Device grid energy exceeds metered import'};
 }
 return {available:true,reason:null};
}
function csv(report){
 const keys=['gridImport','gridExport','batteryCharge','evCharge','houseGrid','solarExport','batteryExport','cashBalance','gridBalance','standingCharge','savings','forceExport','forceNet','economicSavings'];
 if(!report?.window||(!keys.some(key=>Number.isFinite(report[key]?.total))&&report.dischargeFlow?.available!==true))return null;
 const cell=value=>{
  let text=String(value??'');
  if(/^[=+@\t\r]/.test(text))text="'"+text;
  return '"'+text.replace(/"/g,'""')+'"';
 };
 const lines=[['Period start UTC','Period end UTC','Time zone','Item','Recorded kWh','Cost or earnings GBP','Status']];
 for(const key of keys){
  const m=report[key];
  const value=m?.available?(Number.isFinite(m.cost)?m.cost:Number.isFinite(m.value)?m.value:''):'';
  lines.push([new Date(report.window.start).toISOString(),new Date(report.window.end).toISOString(),'Europe/London',key,
   Number.isFinite(m?.total)?m.total:'',value,m?.reason||(m?.available?'Complete recorded data':'Data unavailable')]);
 }
 const flow=report.dischargeFlow;
 for(const [key,amount] of [
  ['batteryDischargeDC',flow?.available?flow.dcKwh:null],
  ['batteryDeliveredAC',flow?.available?flow.acKwh:null],
  ['batteryDCtoACDifference',flow?.available?flow.lossKwh:null]
 ]){
  lines.push([new Date(report.window.start).toISOString(),new Date(report.window.end).toISOString(),
   'Europe/London',key,Number.isFinite(amount)?amount:'','',
   flow?.reason||(flow?.available?'Verified DC/AC comparison, not grid export':'Data unavailable')]);
 }
 return lines.map(row=>row.map(cell).join(',')).join('\r\n')+'\r\n';
}
const api={build,csv};if(node)module.exports=api;else root.FoxActualReport=api;
})(typeof window!=='undefined'?window:globalThis);
