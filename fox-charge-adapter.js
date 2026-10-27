/* Simulation adapter. No live schedule or hardware control.
Partial EV intervals: exact supplied energy, conservative whole-slot hold
and charging headroom. Household/solar inputs remain half-hour estimates. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const policy=node?require('./fox-smart-charge-core.js'):root.FoxSmartChargeCore;
function apply(slot,c){
 const start=Date.parse(slot.utc),end=start+1800000;
 if(!Number.isFinite(start)||start%1800000||
    !Number.isFinite(slot.house)||slot.house<0)
  throw Error('Invalid charging adapter interval');
 const parts=policy.segments(start,end,{
  ...c,houseKW:slot.house*2
 });
 const cheap=parts.every(x=>x.cheap);
 const flexCharge=parts.some(x=>x.flexCharge);
 const hold=parts.some(x=>x.hold);
 return {
  ...slot,
  importP:cheap?c.cheapP:c.peakP,
  cheap,flexCharge,hold,
  ev:parts.reduce((sum,x)=>sum+x.evKWh,0),
  gridHeadroomKWh:Math.min(...parts.map(x=>x.gridHeadroomKW))*.5,
  gridConflict:parts.some(x=>x.gridConflict),
  allowExport:!!slot.allowExport&&!hold,
  chargingSimulated:true,
  partialEVApproximation:parts.length>1,
  chargingSegments:parts
 };
}
const api={apply};
if(node)module.exports=api;
else root.FoxChargeAdapter=api;
})(typeof window!=='undefined'?window:globalThis);
