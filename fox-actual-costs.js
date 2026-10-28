/* Actual accounting only. Future authenticated adapters must run outside this public app. */
(function(root){
'use strict';
const fmt=new Intl.DateTimeFormat('en-CA',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function parts(t){return Object.fromEntries(fmt.formatToParts(new Date(t)).map(p=>[p.type,p.value]));}
function boundary(day){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Choose a valid end date');
 const [y,m,d]=day.split('-').map(Number);
 let t=Date.UTC(y,m-1,d,23,30);
 if(new Date(t).toISOString().slice(0,10)!==day)throw Error('Choose a valid end date');
 for(let i=0;i<3;i++){
  const p=parts(t);const offset=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute)-t;
  t=Date.UTC(y,m-1,d,23,30)-offset;
 }
 return t;
}
function previousDay(day){return new Date(Date.parse(day+'T12:00:00Z')-86400000).toISOString().slice(0,10);}
function windowFor(endDay){return {start:boundary(previousDay(endDay)),end:boundary(endDay)};}
function latestEndDay(now){const p=parts(now);let day=p.year+'-'+p.month+'-'+p.day;return now>=boundary(day)?day:previousDay(day);}
// Each metric needs complete, consecutive measured intervals. Missing is never zero.
function total(records,window,now){
 if(!window||!Number.isFinite(window.start)||!Number.isFinite(window.end)||window.end<=window.start||!Number.isFinite(now)||window.end>now||!Array.isArray(records))return null;
 if(records.some(r=>!r||!Number.isFinite(r.start)||!Number.isFinite(r.end)||r.end<=r.start))return null;
 const rows=records.filter(r=>r.end>window.start&&r.start<window.end).sort((a,b)=>a.start-b.start);
 let cursor=window.start,sum=0;
 for(const r of rows){
  if(r.start!==cursor||!Number.isFinite(r.end)||r.end<=r.start||r.end>window.end||!Number.isFinite(r.value)||r.value<0||r.measured!==true)return null;
  cursor=r.end;sum+=r.value;
  if(!Number.isFinite(sum))return null;
 }
 return cursor===window.end?sum:null;
}
const api={windowFor,latestEndDay,total};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else {root.FoxActualCosts=api;setup();}
function setup(){
 const init=()=>{
  const host=document.querySelector('main');if(!host)return;
  const panel=document.createElement('section');panel.className='panel';panel.id='foxActualCosts';
  panel.innerHTML=`<h2>Your actual daily electricity costs</h2>
  <p>Recorded energy only · 23:30 to 23:30 · Europe/London. No forecasts or assumed battery refill.</p>
  <label>Accounting day ending on <input type="date" id="foxActualEnd"></label>
  <p id="foxActualPeriod" aria-live="polite"></p>
  <button type="button" id="foxActualCSV" disabled>Export actual report CSV</button><p class="note">Export becomes available when recorded readings exist. Missing values remain blank in the file.</p>
  <h3>Connections</h3>
  <ul><li>Octopus: not connected — recorded grid import, export and applicable tariffs.</li>
  <li>Fox ESS: not connected — solar generation, battery charging/discharging and household energy.</li>
  <li>Ohme / charger meter: not connected — recorded EV charging.</li></ul>
  <p>Waiting for your hardware and API setup. Live collection is disabled. No API keys are requested or stored here.</p>
  <p>Confirmed import rates including VAT: daytime 23.2995p/kWh; regular overnight 3.4965p/kWh (23:30–05:30). Historical costs require the tariff applicable to each recorded interval, including confirmed Smart charging rates. Your current export rate has not been configured; Agile prices elsewhere are a planning scenario.</p>
  <div style="overflow-x:auto"><table style="width:100%;min-width:480px;border-collapse:collapse"><thead><tr><th style="text-align:left">Recorded item</th><th>Energy</th><th>Cost / earnings</th><th>Data status</th></tr></thead><tbody id="foxActualRows"></tbody></table></div>
  <p id="foxActualReconciliation" aria-live="polite"></p><h3>House and EV savings</h3><p>Battery / solar supplied to the house: Data unavailable.<br>Battery / solar supplied to the EV: Data unavailable.<br>Equivalent grid cost: Data unavailable.<br>Allocated actual supply cost: Data unavailable.<br>Savings: Data unavailable.</p>
  <p>Battery energy carried between days needs its recorded purchase cost. Solar and battery export can only be split where source measurements support it. Missing source splits or stored-energy costs stay unavailable; total meter export can still be reported separately.</p>
  <p>Standing charges will be shown separately. Export less battery and EV charging is a cash balance; avoided-import savings are a separate comparison and will not be added to that balance twice.</p>`;
  host.prepend(panel);
  let currentReport=null;
  const download=panel.querySelector('#foxActualCSV');
  if(download)download.addEventListener('click',()=>{
   const csv=root.FoxActualReport?.csv(currentReport);if(!csv)return;
   const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
   const link=document.createElement('a');link.href=url;link.download='fox-actual-'+input.value+'.csv';link.click();
   setTimeout(()=>URL.revokeObjectURL(url),1000);
  });
  const input=panel.querySelector('#foxActualEnd');input.value=latestEndDay(Date.now());input.max=input.value;
  const update=()=>{
   currentReport=null;if(download)download.disabled=true;
   const output=panel.querySelector('#foxActualPeriod');
   try{const w=windowFor(input.value);const pretty=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
    renderReport(w);
    output.textContent=pretty.format(new Date(w.start))+' → '+pretty.format(new Date(w.end))+' · '+((w.end-w.start)/3600000)+' hours. '+(w.end>Date.now()?'Period not complete.':'No recorded readings connected.');
   }catch(e){
    panel.querySelector('#foxActualRows').replaceChildren();
    const status=panel.querySelector('#foxActualReconciliation');
    if(status)status.textContent='Choose a valid accounting date to view the report.';
    output.textContent=e.message;
   }
  };
  function renderReport(w){
   const body=panel.querySelector('#foxActualRows');body.replaceChildren();
   const report=root.FoxActualReport?.build(input.value,{},Date.now());
   currentReport=report;
   if(download)download.disabled=!root.FoxActualReport?.csv(report);
   const status=panel.querySelector('#foxActualReconciliation');
   if(status)status.textContent='Import check: '+(report?.importCheck?.available?'Reconciled':report?.importCheck?.reason||'Waiting for readings')+'. Export split check: '+(report?.exportCheck?.available?'Reconciled':report?.exportCheck?.reason||'Waiting for readings')+'.';
   const metrics=[
    ['Total grid import','gridImport'],['Total metered export / earnings','gridExport'],
    ['Battery grid charging · whole accounting day','batteryCharge'],
    ['EV grid charging','evCharge'],['Household grid purchases','houseGrid'],
    ['Direct solar export','solarExport'],['Battery export','batteryExport'],
    ['Export earnings less battery and EV charging','cashBalance'],
    ['Net grid energy cost (import less export)','gridBalance'],['Standing charge','standingCharge']
   ];
   const cash=x=>(x<0?'−£':'£')+Math.abs(x).toFixed(2);
   for(const [label,key] of metrics){
    const metric=report?.[key];
    const energy=Number.isFinite(metric?.total)?metric.total.toFixed(2)+' kWh':'Data unavailable';
    const money=metric?.available&&Number.isFinite(metric.cost)?cash(metric.cost):
     metric?.available&&Number.isFinite(metric.value)?cash(metric.value):'Data unavailable';
    const row=document.createElement('tr');
    for(const value of [label,energy,money,metric?.reason|| (metric?.available?'Complete recorded data':'Report module unavailable')]){
     const cell=document.createElement('td');cell.textContent=value;cell.style.padding='10px 6px';row.append(cell);
    }
    body.append(row);
   }
  }
  input.addEventListener('change',update);update();
 };
 if(document.readyState!=='complete')document.addEventListener('DOMContentLoaded',init);else init();
}
})(typeof window!=='undefined'?window:globalThis);

