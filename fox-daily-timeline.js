/* v35: Explicitly fictional day timeline. No live battery readings or control. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const planner=node?require('./fox-prehardware-planner.js'):root.FoxPrehardwarePlanner;
const clock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const label=t=>clock.format(new Date(t));
function sample(){
 const start=Date.parse('2026-10-29T05:30:00Z');
 const slots=Array.from({length:27},(_,i)=>{
  const time=start+i*1800000, hour=i/2+5.5;
  return {start:time,end:time+1800000,houseKwh:.12,
   exportPence:hour>=15&&hour<16?52:hour>=13&&hour<14?43:hour>=17&&hour<18?37:8,
   headroomKw:3.5};
 });
 return {capacityKwh:10,socPct:95,dischargeEfficiency:.9,slots,
  peakImportPence:23.3,cheapImportPence:3.5,wearPence:5,
  solarOpportunityPence:12,batteryPowerKw:5,
  solarOriginVerified:true,tariffApplicableVerified:true,
  instantaneousHeadroomVerified:true,forecastQuality:'SCENARIO_VALIDATED'};
}
function timeline(result){
 if(!result||result.ok!==true||!Array.isArray(result.rows))return [];
 return result.rows.map(r=>({
  time:label(r.start)+'–'+label(r.end),
  action:r.simulatedExportKwh>1e-8?'Export (hypothetical)':'Home use / hold',
  exportKwh:r.simulatedExportKwh,
  homeKwh:r.houseKwh,
  socPct:100*r.remainingBatteryKwh/10,
  revenueGbp:r.simulatedRevenueGbp
 }));
}
function render(host,result){
 host.replaceChildren();
 if(!result.ok){const p=document.createElement('p');p.textContent='Scenario unavailable: '+result.reason;host.append(p);return;}
 const stats=document.createElement('div');stats.className='fox-timeline-stats';
 for(const [key,value] of [
  ['Starting SOC','95% (fictional)'],['19:00 SOC',(result.at19Kwh/10*100).toFixed(1)+'% (simulated)'],
  ['Battery export',result.exportKwh.toFixed(2)+' kWh (simulated)'],
  ['Gross export','£'+result.exportRevenueGbp.toFixed(2)+' (not profit)']
 ]){
  const cell=document.createElement('div'),small=document.createElement('small'),strong=document.createElement('strong');
  small.textContent=key;strong.textContent=value;cell.append(small,strong);stats.append(cell);
 }
 host.append(stats);
 const list=document.createElement('ol');list.className='fox-timeline-list';
 const rows=timeline(result);
 let previous='';
 for(const row of rows){
  const li=document.createElement('li');li.className=row.exportKwh>0?'fox-timeline-export':'fox-timeline-hold';
  const time=document.createElement('time');time.textContent=row.time;
  const body=document.createElement('span');body.textContent=row.action+
   ' · household '+row.homeKwh.toFixed(2)+' kWh'+
   (row.exportKwh>0?' · grid export '+row.exportKwh.toFixed(2)+' kWh':'');
  const soc=document.createElement('strong');soc.textContent=row.socPct.toFixed(1)+'% SOC';
  li.append(time,body,soc);list.append(li);previous=row.action;
 }
 host.append(list);
 const evening=document.createElement('p');evening.className='note';
 evening.textContent='19:00–23:30: evening household usage is NOT simulated here. The 20% checkpoint is protected, but its ability to cover the full evening remains unverified.';
 host.append(evening);
 const overnight=document.createElement('p');overnight.className='note';
 overnight.textContent='23:30–05:30: proposed cheap-rate battery/EV charging window. Actual tariff eligibility, EV schedule and 8.3 kW simultaneous import headroom are not verified.';
 host.append(overnight);
 const caution=document.createElement('p');caution.className='note';
 caution.textContent='All prices, demand, SOC and solar assumptions in this example are fictional. Solar refill is deliberately zero. The 3.5 kW cap is an instantaneous site limit; half-hour planning cannot enforce it. No inverter commands or actual earnings.';
 host.append(caution);
}
function setup(){
 const main=document.querySelector('main');
 if(!main||document.getElementById('foxDayTimeline'))return;
 const panel=document.createElement('section');panel.id='foxDayTimeline';panel.className='panel';
 const title=document.createElement('h3');title.textContent='Daily battery timeline · example';
 const copy=document.createElement('p');copy.className='note';copy.textContent='See a clearly labelled fictional day before connecting hardware. The real battery schedule is not available yet.';
 const button=document.createElement('button');button.type='button';button.textContent='Show example day';button.className='secondary';
 const output=document.createElement('div');output.id='foxDayTimelineOutput';
 button.addEventListener('click',()=>{render(output,planner.planDay(sample()));button.textContent='Refresh example';});
 panel.append(title,copy,button,output);
 const chart=document.getElementById('priceChart');
 const anchor=chart?.closest('section');
 if(anchor&&anchor.parentNode===main)main.insertBefore(panel,anchor);
 else main.append(panel);
}
const api={sample,timeline};
if(node)module.exports=api;
else {root.FoxDailyTimeline=api;if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();}
})(typeof window!=='undefined'?window:globalThis);
