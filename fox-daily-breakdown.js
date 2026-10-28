/* Selected calendar day: measured cost breakdown + locally saved Octopus bookings.
   Never substitute a forecast or sample price for actual metered accounting. */
(function(root){
'use strict';
const labels={happy:'Weekend Happy Hour',powerup:'Power Up reward',legacy:'Earlier Free Electricity'};
const cash=n=>(n<0?'−£':'£')+Math.abs(n).toFixed(2);
const validDay=day=>typeof day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(day)&&
 !Number.isNaN(Date.parse(day+'T12:00:00Z'))&&new Date(day+'T12:00:00Z').toISOString().slice(0,10)===day;
function summary(report,bookings={}){
 const imported=report?.gridImport?.available&&Number.isFinite(report.gridImport.cost)?report.gridImport.cost:null;
 const exported=report?.gridExport?.available&&Number.isFinite(report.gridExport.cost)?report.gridExport.cost:null;
 const net=report?.gridBalance?.available&&Number.isFinite(report.gridBalance.value)?-report.gridBalance.value:null;
 const house=report?.savings,force=report?.forceExport,solar=report?.solarStorage;
 const missing=[];
 if(imported===null)missing.push('Import: '+(report?.gridImport?.reason||'Meter readings and historical tariff unavailable'));
 if(exported===null)missing.push('Export: '+(report?.gridExport?.reason||'Meter readings and historical tariff unavailable'));
 const counts={happy:0,powerup:0,legacy:0};
 for(const entry of Object.values(bookings||{}))if(entry&&Object.hasOwn(counts,entry.type))counts[entry.type]++;
 const sessions=Object.entries(counts).filter(([,n])=>n>0)
  .map(([kind,n])=>labels[kind]+' · '+(n/2).toFixed(1)+'h');
 return {imported:imported===null?'—':cash(imported),exported:exported===null?'—':cash(exported),
  net:net===null?'—':cash(net),houseSaved:house?.available&&Number.isFinite(house.value)?cash(house.value):'—',
  forceEarned:force?.available&&Number.isFinite(force.value)?cash(force.value):'—',
  solarGain:solar?.available&&Number.isFinite(solar.value)?cash(solar.value):'—',
  benefitNote:'Household: '+(house?.available?'Verified house-only comparison':house?.reason||'No measured house data')+
   ' · Force export: '+(force?.available?'Gross receipts, already in export P&L':force?.reason||'No verified export attribution'),
  state:net===null?'missing':net>0?'profit':net<0?'loss':'even',
  missing:missing.length?missing.join(' · '):'Complete recorded grid import and export costs for this accounting day.',
  sessions:sessions.length?sessions.join(' · '):'No Happy Hour or other Octopus sessions saved for this date.'};
}
const api={summary,validDay};
if(typeof module!=='undefined'&&module.exports){module.exports=api;return;}
const doc=root.document;
if(!doc)return;
let selected=null,refs=null;
function reportFor(day){
 try{return root.FoxCalendarPnl?.getReport?.(day)||
  root.FoxActualReport?.build(day,{},Date.now())||null;}
 catch{return null;}
}
function render(){
 if(!refs||!selected)return;
 const report=reportFor(selected);
 const bookings=root.foxOctopusSessions?.getForDay?.(selected)||{};
 const data=summary(report,bookings);
 refs.title.textContent='Daily breakdown · '+selected;
 refs.card.dataset.pnl=data.state;
 refs.imported.textContent=data.imported;
 refs.exported.textContent=data.exported;
 refs.net.textContent=data.net;
 refs.houseSaved.textContent=data.houseSaved;
 refs.forceEarned.textContent=data.forceEarned;
 refs.solarGain.textContent=data.solarGain;
 refs.benefitNote.textContent=data.benefitNote;
 refs.reason.textContent=data.missing;
 refs.sessions.textContent=data.sessions;
 refs.download.disabled=!root.FoxActualReport?.csv?.(report);
 refs.download.title=refs.download.disabled?'CSV available only when recorded readings exist':'Export actual costs for '+selected;
}
function syncReportDate(day){
 const input=doc.getElementById('foxActualEnd');
 // A future/incomplete accounting period cannot be selected in the main report.
 if(input&&(!input.max||day<=input.max)){
  input.value=day;
  input.dispatchEvent(new Event('change',{bubbles:true}));
 }
}
function onDay(event){
 const day=event.detail?.day;
 if(!validDay(day))return;
 selected=day;
 syncReportDate(day);
 render();
}
function init(){
 const host=doc.getElementById('foxSessionDay');
 if(!host||doc.getElementById('foxCalendarDailyBreakdown'))return;
 const element=(tag,className,text)=>{
  const el=doc.createElement(tag);if(className)el.className=className;
  if(text)el.textContent=text;return el;
 };
 const card=element('section','fox-daily-breakdown');card.id='foxCalendarDailyBreakdown';
 card.setAttribute('aria-live','polite');
 const title=element('h4','','Daily breakdown');card.append(title);
 const subtitle=element('p','note','Measured costs for the accounting day ending at 23:30 UK time, not forecasts.');
 card.append(subtitle);
 const figures=element('div','fox-daily-figures');
 const metric=(name)=>{
  const item=element('div','fox-daily-figure');
  item.append(element('span','',name));
  const value=element('strong','','—');item.append(value);figures.append(item);
  return value;
 };
 const exported=metric('Export earned'),imported=metric('Grid import cost'),net=metric('Net P&L');
 card.append(figures);
 const bonus=element('div','fox-daily-figures fox-house-extras');
 const benefitMetric=name=>{
  const item=element('div','fox-daily-figure');item.append(element('span','',name));
  const value=element('strong','','—');item.append(value);bonus.append(item);return value;
 };
 const houseSaved=benefitMetric('Household bill saving · excluding EV');
 const forceEarned=benefitMetric('Forced battery export earned · gross');
 const solarGain=benefitMetric('Extra solar-to-battery grid export gain vs direct export');
 card.append(bonus);
 const benefitNote=element('p','note','Awaiting verified household and forced-export readings.');
 card.append(benefitNote);
 const reason=element('p','fox-daily-reason','Awaiting recorded readings.');
 const sessions=element('p','fox-daily-sessions','No sessions selected.');
 const download=element('button','secondary','Export this day’s CSV');
 download.type='button';download.disabled=true;
 download.addEventListener('click',()=>{
  const report=reportFor(selected),csv=root.FoxActualReport?.csv?.(report);
  if(!csv||!selected)return;
  const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
  const link=doc.createElement('a');link.href=url;link.download='fox-actual-'+selected+'.csv';
  doc.body.append(link);link.click();link.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
 });
 card.append(reason,sessions,download);
 const toolbar=host.querySelector('.fox-session-day-toolbar');
 if(toolbar)toolbar.after(card);else host.prepend(card);
 refs={card,title,imported,exported,net,houseSaved,forceEarned,solarGain,benefitNote,reason,sessions,download};
 render();
}
doc.addEventListener('fox:calendar-day-selected',onDay);
doc.addEventListener('fox:calendar-sessions-changed',event=>{
 if(selected&&event.detail?.day===selected)render();
});
doc.addEventListener('fox:recorded-day-updated',event=>{
 if(selected&&event.detail?.day===selected){syncReportDate(selected);render();}
});
if(doc.readyState==='loading')doc.addEventListener('DOMContentLoaded',init);else init();
})(typeof window!=='undefined'?window:globalThis);
