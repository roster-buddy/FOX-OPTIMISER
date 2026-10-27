/* Pure recorded-data report assembler. No fetches or forecast fallback. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const dates=node?require('./fox-actual-costs.js'):root.FoxActualCosts;
const recorded=node?require('./fox-recorded-data.js'):root.FoxRecordedData;
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
 const gridBalance=gridImport.available&&gridExport.available?
  {available:true,value:gridImport.cost-gridExport.cost,reason:null}:
  unavailable('Complete grid import and export pricing required');
 return {importCheck,exportCheck,window,gridImport,gridExport,batteryCharge,evCharge,houseGrid,solarExport,batteryExport,cashBalance,gridBalance,
  savings:unavailable('Recorded source flows and carried battery energy costs required'),
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
const api={build};if(node)module.exports=api;else root.FoxActualReport=api;
})(typeof window!=='undefined'?window:globalThis);
