/* Actual energy cash P&L: export receipts less all grid import, no refill assumptions. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
function dayResult(report){
 const balance=report?.gridBalance;
 if(!balance?.available||!Number.isFinite(balance.value))return null;
 return balance.value===0?0:-balance.value;
}
function monthSummary(reports,year,month){
 const days=new Date(Date.UTC(year,month+1,0)).getUTCDate();
 let net=0,imports=0,exports=0,count=0;
 for(let day=1;day<=days;day++){
  const key=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  const report=reports.get(key),value=dayResult(report);
  if(value===null)continue;
  net+=value;imports+=report.gridImport.cost;exports+=report.gridExport.cost;count++;
 }
 return {net:count?net:null,imports:count?imports:null,exports:count?exports:null,count,days,complete:count===days};
}
const api={dayResult,monthSummary};
if(node){module.exports=api;return;}
const reports=new Map();
const cash=n=>(n<0?'−£':'£')+Math.abs(n).toFixed(2);
const state=n=>n===null?'missing':n>0?'profit':n<0?'loss':'even';
function render(){
 const grid=document.getElementById('v4CalendarGrid'),summary=document.getElementById('foxCalendarMonthPnl');
 if(!grid||!summary||typeof v4CalendarMonth==='undefined')return;
 const year=v4CalendarMonth.getFullYear(),month=v4CalendarMonth.getMonth();
 const s=monthSummary(reports,year,month);
 summary.className='fox-month-pnl '+state(s.net);
 summary.replaceChildren();
 const title=document.createElement('strong');title.textContent=s.net===null?'Monthly P&L · awaiting readings':(s.complete?'Monthly P&L · ':'Recorded-day subtotal · ')+cash(s.net);summary.append(title);
 const detail=document.createElement('p');detail.textContent=s.count===0?'No complete recorded days yet.':s.count+' of '+s.days+' days recorded · Export '+cash(s.exports)+' − import '+cash(s.imports)+(s.complete?'':'. Incomplete month; missing days are excluded.');summary.append(detail);
 const offset=(new Date(year,month,1).getDay()+6)%7;
 for(let day=1;day<=s.days;day++){
  const cell=grid.children[7+offset+day-1];if(!cell)continue;
  const key=year+'-'+String(month+1).padStart(2,'0')+'-'+String(day).padStart(2,'0');
  const amount=cell.children[1];if(!amount)continue;
  const value=dayResult(reports.get(key));
  cell.dataset.pnl=state(value);amount.className='fox-day-pnl';
  amount.textContent=value===null?'—':cash(value);
  const label=value===null?'Recorded P&L unavailable':value>0?'Net earned '+cash(value):value<0?'Net cost '+cash(-value):'Break even £0.00';
  cell.title=key+' · '+label+' · Open Happy Hour / Octopus sessions';
  cell.setAttribute('aria-label',key+', '+label+'. Open Happy Hour and Octopus sessions');
 }
}
function setup(){
 const calendar=document.getElementById('v4Calendar');if(!calendar)return;
 calendar.querySelector('h3').textContent='Savings, earnings & Happy Hours';
 for(const p of Array.from(calendar.children).filter(x=>x.tagName==='P'))p.remove();
 const intro=document.createElement('p');intro.className='note';intro.textContent='Daily P&L = actual export earnings − all actual grid import costs (house, battery and EV). Green means net earned; red means net cost. Standing charges and avoided-import savings are separate. Each date represents the accounting day ending at 23:30. Happy Hour selections use their calendar date.';
 calendar.querySelector('h3').after(intro);
 const summary=document.createElement('div');summary.id='foxCalendarMonthPnl';summary.setAttribute('aria-live','polite');
 const grid=document.getElementById('v4CalendarGrid');grid.before(summary);
 const legend=document.createElement('p');legend.className='note';legend.textContent='Green: net earned · Red: net cost · —: readings unavailable. Tap a date to record Happy Hours or other Octopus sessions you have joined.';grid.after(legend);
 const actual=document.getElementById('foxActualCosts');if(actual&&actual.parentElement===calendar.parentElement)actual.before(calendar);
 const original=v4RenderCalendar;
 v4RenderCalendar=function(...args){original(...args);render();};
 render();
}
// For future authenticated adapters only; calculates from validated recorded streams.
root.FoxCalendarPnl={...api,recordDay(endDay,input,now=Date.now()){
 const report=root.FoxActualReport.build(endDay,input,now);
 reports.set(endDay,report);render();return report;
}};
if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',setup);else setup();
})(typeof window!=='undefined'?window:globalThis);
