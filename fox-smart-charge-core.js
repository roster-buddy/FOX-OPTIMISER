/* Supplied charging policy for simulation only.
No Ohme connection, inverter commands or background control. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const evCore=node?require('./fox-ev-schedule-core.js'):root.FoxEVScheduleCore;
const half=1800000;
const clock=new Intl.DateTimeFormat('en-GB',{
 timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',
 hourCycle:'h23'
});
function regular(at){
 const [h,m]=clock.format(new Date(at)).split(':').map(Number);
 const minute=h*60+m;
 return minute>=1410||minute<330;
}
function instant(value){
 if(typeof value==='number'&&Number.isFinite(value))return value;
 if(typeof value==='string'&&/(Z|[+-]\d{2}:\d{2})$/.test(value)){
  const result=Date.parse(value);
  if(Number.isFinite(result))return result;
 }
 throw Error('Charging timestamps require an explicit timezone');
}
function validate(c){
 if(!c||!['smart','max','unknown'].includes(c.mode))
  throw Error('Charging mode must be smart, max or unknown');
 for(const key of ['cheapP','peakP','gridKW','houseKW','evMaxKW']){
  if(typeof c[key]!=='number'||!Number.isFinite(c[key])||
     (key.endsWith('KW')&&c[key]<0))
   throw Error('Invalid charging assumption: '+key);
 }
 if(c.gridKW<=0)throw Error('Grid ceiling must be positive');
 const ev=evCore.validate(c.evSchedule||[],c.evMaxKW);
 const windows=(c.smartWindows||[]).map(x=>{
  const start=instant(x.start),end=instant(x.end);
  if(end<=start||start%half||end%half)
   throw Error('Smart windows require aligned half-hour boundaries');
  return {start,end};
 }).sort((a,b)=>a.start-b.start);
 for(let i=1;i<windows.length;i++)
  if(windows[i].start<windows[i-1].end)
   throw Error('Overlapping Smart windows');
 if(windows.length&&(c.mode!=='smart'||c.confirmed!==true))
  throw Error('Extra cheap windows require confirmed Smart Charge eligibility');
 return {ev,windows};
}
function segments(start,end,c){
 if(!Number.isFinite(start)||!Number.isFinite(end)||end<=start)
  throw Error('Invalid policy horizon');
 const {ev,windows}=validate(c);
 const cuts=new Set([start,end]);
 const add=t=>{if(t>start&&t<end)cuts.add(t)};
 for(let t=Math.floor(start/half)*half;t<end;t+=half)add(t);
 for(const x of [...ev,...windows]){add(x.start);add(x.end)}
 const points=[...cuts].sort((a,b)=>a-b);
 return points.slice(0,-1).map((at,i)=>{
  const finish=points[i+1],hours=(finish-at)/3600000;
  const regularCheap=regular(at);
  const extraSmart=c.mode==='smart'&&c.confirmed===true&&
   windows.some(x=>at>=x.start&&at<x.end);
  const evKW=evCore.powerAt(ev,at);
  const cheap=regularCheap||extraSmart;
  const protect=cheap||evKW>0;
  return {
   start:at,end:finish,hours,evKW,evKWh:evKW*hours,
   regularCheap,extraSmart,cheap,
   importP:cheap?c.cheapP:c.peakP,
   hold:protect,allowExport:!protect,
   flexCharge:extraSmart&&!regularCheap,
   gridHeadroomKW:Math.max(0,c.gridKW-c.houseKW-evKW),
   gridConflict:c.houseKW+evKW>c.gridKW+1e-7,
   requiredMode:protect?'charge/hold':'self-use',
   simulated:true
  };
 });
}
const api={regular,segments};
if(node)module.exports=api;
else root.FoxSmartChargeCore=api;
})(typeof window!=='undefined'?window:globalThis);
