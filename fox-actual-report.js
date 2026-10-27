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
 const cashBalance=[gridExport,batteryCharge,evCharge].every(x=>x.available)?
  {available:true,value:gridExport.cost-batteryCharge.cost-evCharge.cost,reason:null}:
  unavailable('Complete export earnings, battery charging and EV charging costs required');
 const gridBalance=gridImport.available&&gridExport.available?
  {available:true,value:gridImport.cost-gridExport.cost,reason:null}:
  unavailable('Complete grid import and export pricing required');
 return {window,gridImport,gridExport,batteryCharge,evCharge,houseGrid,solarExport,batteryExport,cashBalance,gridBalance,
  savings:unavailable('Recorded source flows and carried battery energy costs required'),
  standingCharge:unavailable('Historical standing charge not connected')};
}
const api={build};if(node)module.exports=api;else root.FoxActualReport=api;
})(typeof window!=='undefined'?window:globalThis);
