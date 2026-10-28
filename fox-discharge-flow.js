/* Optional measured battery DC-to-AC reconciliation, distinct from net grid export.
   Meter readings and inverter output must NEVER be interchanged. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const measured=node?require('./fox-recorded-data.js'):root.FoxRecordedData;
const unavailable=reason=>({available:false,reason,total:null,dcKwh:null,acKwh:null,lossKwh:null,efficiencyPct:null});
function calculate(input,window,now){
 const streams=input?.streams||{};
 const dc=measured.inspect(streams.batteryDischargeDC,window,now);
 if(!dc.available)return unavailable('Battery DC discharge: '+dc.reason);
 const ac=measured.inspect(streams.batteryDeliveredAC,window,now);
 if(!ac.available)return unavailable('Battery-attributed inverter AC: '+ac.reason);
 if(dc.intervals.length!==ac.intervals.length||
  dc.intervals.some((r,i)=>r.start!==ac.intervals[i].start||r.end!==ac.intervals[i].end))
  return unavailable('Battery DC and attributable AC must use matching measured intervals');
 let loss=0;
 for(let i=0;i<dc.intervals.length;i++){
  const d=dc.intervals[i],a=ac.intervals[i];
  if(d.source!=='fox'||d.measurementPoint!=='battery-dc-output'||d.verified!==true)
   return unavailable('Verified Fox ESS battery DC-output measurements required');
  if(a.source!=='fox'||a.measurementPoint!=='battery-inverter-ac-output'||
   a.attribution!=='battery-only'||a.verified!==true)
   return unavailable('Verified battery-only AC output required; shared solar inverter AC is not sufficient');
  const delta=d.value-a.value;
  if(delta< -1e-6)return unavailable('Battery AC output exceeds DC input: incompatible measurement boundaries or attribution');
  loss+=Math.max(0,delta);
 }
 if(!Number.isFinite(loss))return unavailable('Discharge reconciliation out of range');
 const efficiencyPct=dc.total>0?100*ac.total/dc.total:null;
 return {available:true,reason:null,total:dc.total,dcKwh:dc.total,acKwh:ac.total,
  lossKwh:loss,efficiencyPct,
  scope:'DC-to-AC measurement difference only; includes conversion or auxiliary loads between measurement points. Does not determine billable grid export or force-discharge profit.'};
}
const api={calculate};
if(node)module.exports=api;else root.FoxDischargeFlow=api;
})(typeof window!=='undefined'?window:globalThis);
