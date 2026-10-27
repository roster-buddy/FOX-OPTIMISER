
/* Supplied EV schedule validation. No Ohme connection or commands.
Intervals use UTC instants; power is assumed constant within each interval. */
(function(root){
'use strict';
function instant(x){
 if(typeof x==='number'&&Number.isFinite(x))return x;
 if(typeof x==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(x)){
  const t=Date.parse(x);
  if(Number.isFinite(t))return t;
 }
 throw Error('EV schedule timestamps require an explicit timezone');
}
function validate(items,maxKW){
 if(!Array.isArray(items)||!Number.isFinite(maxKW)||maxKW<0)
  throw Error('Invalid EV schedule');
 const slots=items.map(x=>{
  if(!x||typeof x!=='object')throw Error('Invalid EV interval');
  const start=instant(x.start),end=instant(x.end);
  if(end<=start||typeof x.kw!=='number'||!Number.isFinite(x.kw)||
     x.kw<0||x.kw>maxKW)
   throw Error('Invalid EV interval duration or power');
  return {start,end,kw:x.kw};
 }).sort((a,b)=>a.start-b.start);
 for(let i=1;i<slots.length;i++)
  if(slots[i].start<slots[i-1].end)
   throw Error('Overlapping EV schedule intervals');
 return slots;
}
function powerAt(slots,at){
 return slots.find(x=>at>=x.start&&at<x.end)?.kw||0;
}
const api={validate,powerAt};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.FoxEVScheduleCore=api;
})(typeof window!=='undefined'?window:globalThis);
