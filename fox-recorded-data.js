/* Adapter boundary for recorded interval data. No network, credentials or forecasts. */
(function(root){
'use strict';
const known=new Set(['octopus','fox','ohme','charger-meter']);
function inspect(rows,window,now){
 const fail=reason=>({available:false,reason,total:null});
 if(!window||!Number.isFinite(window.start)||!Number.isFinite(window.end)||window.end<=window.start||!Number.isFinite(now))return fail('Invalid accounting window');
 if(window.end>now)return fail('Accounting period not complete');
 if(!Array.isArray(rows)||!rows.length)return fail('No recorded readings');
 // Do not silently discard malformed or overlapping records at a boundary.
 for(const r of rows)if(!r||!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.end<=r.start)return fail('Invalid interval timestamps');
 const selected=rows.filter(r=>r.end>window.start&&r.start<window.end).sort((a,b)=>a.start-b.start);
 if(!selected.length)return fail('No readings for this period');
 let cursor=window.start,total=0;
 for(const r of selected){
  if(r.start<window.start||r.end>window.end)return fail('Interval crosses accounting boundary');
  if(r.start<cursor)return fail('Duplicate or overlapping readings');
  if(r.start>cursor)return fail('Missing readings');
  if(r.measured!==true||!known.has(r.source))return fail('Measured source required');
  if(!Number.isFinite(r.value)||r.value<0)return fail('Invalid recorded energy');
  cursor=r.end;total+=r.value;
  if(!Number.isFinite(total))return fail('Recorded energy total is out of range');
 }
 if(cursor!==window.end)return fail('Missing readings');
 return {available:true,reason:null,total,intervals:selected};
}
// Rates are historical applicable rates (p/kWh, VAT included), never planner defaults.
function price(rows,rates,window,now){
 const energy=inspect(rows,window,now);
 if(!energy.available)return {...energy,cost:null};
 const fail=reason=>({available:false,reason,total:energy.total,cost:null});
 if(!Array.isArray(rates))return fail('Historical tariff missing');
 for(const r of rates)if(!r||!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.end<=r.start||!Number.isFinite(r.pence)||r.confirmed!==true)return fail('Unconfirmed or invalid historical tariff');
 let cost=0;
 for(const row of energy.intervals){
  const applicable=rates.filter(r=>r.end>row.start&&r.start<row.end);
  // A tariff transition inside a measurement cannot be apportioned without finer readings.
  if(applicable.length!==1||applicable[0].start>row.start||applicable[0].end<row.end)return fail('Tariff gap, overlap or unresolved rate change');
  cost+=row.value*applicable[0].pence/100;
  if(!Number.isFinite(cost))return fail('Recorded cost is out of range');
 }
 return {available:true,reason:null,total:energy.total,cost};
}
const api={inspect,price};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.FoxRecordedData=api;
})(typeof window!=='undefined'?window:globalThis);

