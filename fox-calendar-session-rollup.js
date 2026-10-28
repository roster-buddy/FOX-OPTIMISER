/* v36: Monthly calendar session rollup, local selections only. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
function countMonth(getDay,year,month){
 if(typeof getDay!=='function'||!Number.isInteger(year)||!Number.isInteger(month)||month<0||month>11)return null;
 const days=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 const totals={happy:0,powerup:0,legacy:0},dates=new Set();
 for(let d=1;d<=days;d++){
  const key=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');
  const slots=getDay(key);
  if(!slots||typeof slots!=='object')continue;
  let found=false;
  for(const [slot,entry] of Object.entries(slots)){
   if(!/^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):(?:00|30)$/.test(slot)||!slot.startsWith(key+'T'))continue;
   if(entry&&Object.hasOwn(totals,entry.type)){totals[entry.type]++;found=true;}
  }
  if(found)dates.add(key);
 }
 return {days,daysWithSelections:dates.size,happyHours:totals.happy/2,
  powerupHours:totals.powerup/2,legacyHours:totals.legacy/2,
  confirmedWithOctopus:false,actualEnergyBenefitGbp:null};
}
function setup(){
 const calendar=document.getElementById('v4Calendar'),month=document.getElementById('foxCalendarMonthPnl');
 if(!calendar||!month||document.getElementById('foxSessionMonthRollup'))return;
 const p=document.createElement('p');p.id='foxSessionMonthRollup';p.className='note';p.setAttribute('aria-live','polite');
 month.after(p);
 function render(){
  if(typeof v4CalendarMonth==='undefined')return;
  const m=countMonth(day=>root.foxOctopusSessions?.getForDay?.(day)||{},v4CalendarMonth.getFullYear(),v4CalendarMonth.getMonth());
  p.textContent='Locally recorded Octopus sessions: '+m.daysWithSelections+' dates · Happy Hours '+m.happyHours.toFixed(1)+'h · Power Up '+m.powerupHours.toFixed(1)+'h · Earlier free electricity '+m.legacyHours.toFixed(1)+'h. These are manual calendar notes, not confirmed Octopus bookings or measured savings.';
 }
 const original=v4RenderCalendar;
 v4RenderCalendar=function(...args){original(...args);render();};
 document.addEventListener('fox:calendar-sessions-changed',render);
 document.addEventListener('fox:calendar-mode-changed',render);
 render();
}
const api={countMonth};
if(node)module.exports=api;else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})(typeof window!=='undefined'?window:globalThis);
