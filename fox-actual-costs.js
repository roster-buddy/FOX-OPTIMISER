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
  <section id="foxHouseBenefit" class="fox-house-benefit" aria-live="polite">
   <h3>Daily household savings &amp; battery export</h3>
   <p class="note">Household figures exclude EV charging. Force-discharge gross receipts are already included in total grid export revenue.</p>
   <p class="note">Compare actual house-only use against buying the same electricity at the applicable grid rate. Battery supply costs include traced charging costs and energy losses.</p>
   <div class="fox-benefit-grid">
    <div><small>House from grid · comparison</small><strong id="foxHouseBaseline">—</strong></div>
    <div><small>Actual house supply cost</small><strong id="foxHouseActual">—</strong></div>
    <div><small>Household bill saving</small><strong id="foxHouseSaving">—</strong></div>
    <div><small>Forced battery export earned</small><strong id="foxForcedEarned">—</strong></div>
    <div><small>Extra solar-battery export profit above direct export</small><strong id="foxSolarGain">—</strong></div>
   </div>
   <p id="foxHouseStatus" class="note">Household saving: awaiting verified house-only readings.</p>
   <p id="foxForcedStatus" class="note">Force-discharge earnings: awaiting verified battery-to-grid attribution.</p>
   <p id="foxSolarStatus" class="note">Solar stored in battery: waiting for validated origin, charging-loss and grid-export history. Comparison uses the confirmed direct-export rate at the time solar entered the battery (12p/kWh only where applicable).</p>
   <details id="foxDischargeDetails" class="foxDisclosure foxTechnicalDisclosure">
    <summary>Battery discharge measurements · DC / AC / losses</summary>
   <div class="fox-benefit-grid fox-discharge-grid">
    <div><small>Battery DC discharge</small><strong id="foxDischargeDC">—</strong></div>
    <div><small>Battery-only inverter AC output</small><strong id="foxDischargeAC">—</strong></div>
    <div><small>Measured DC-to-AC difference</small><strong id="foxDischargeLoss">—</strong></div>
   </div>
   <p id="foxDischargeStatus" class="note">Discharge comparison unavailable until verified battery-only DC and AC readings are connected. Metered grid export, not battery output, determines paid earnings.</p>
   </details>
   <p class="note">Force-discharge earnings are already included in total grid export P&L, not additional income to add again. Additional *net* force-discharge profit and savings after foregone solar export are unavailable until traceable energy costs and alternatives are known.</p>
  </section>
  <details id="foxActualReportDetails" class="foxDisclosure foxTechnicalDisclosure">
   <summary>Full electricity ledger &amp; reconciliation</summary>
   <p class="note">Detailed meter and device readings, their measured kWh, costs and data-quality checks.</p>
  <div style="overflow-x:auto"><table style="width:100%;min-width:480px;border-collapse:collapse"><thead><tr><th style="text-align:left">Recorded item</th><th>Energy</th><th>Cost / earnings</th><th>Data status</th></tr></thead><tbody id="foxActualRows"></tbody></table></div>
  <p id="foxActualReconciliation" aria-live="polite"></p>
   <p class="note">Battery energy carried between days needs its recorded purchase cost. Solar and battery export can only be split where source measurements support it. Missing source splits or stored-energy costs stay unavailable; total meter export can still be reported separately.</p>
   <p class="note">Standing charges will be shown separately. Export less battery and EV charging is a cash balance; avoided-import savings are a separate comparison and will not be added to that balance twice.</p>
  </details>`;
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
   const money=x=>x?.available&&Number.isFinite(x.value)?((x.value<0?'−£':'£')+Math.abs(x.value).toFixed(2)):'—';
   const household=report?.savings,force=report?.forceExport,discharge=report?.dischargeFlow,solar=report?.solarStorage;
   const fill=(selector,value)=>{const el=panel.querySelector(selector);if(el)el.textContent=value;};
   fill('#foxHouseBaseline',household?.available?'£'+household.baselineCost.toFixed(2):'—');
   fill('#foxHouseActual',household?.available?'£'+household.actualCost.toFixed(2):'—');
   fill('#foxHouseSaving',money(household));
   fill('#foxForcedEarned',money(force));
   fill('#foxSolarGain',money(solar));
   fill('#foxSolarStatus',solar?.available?
    'Solar-retained accounting (house grid-origin first; export solar-origin first; model assumption, not physically measured electrons): solar-origin grid export '+
    solar.solarGridExportAcKwh.toFixed(2)+' kWh earned '+money({available:true,value:solar.solarGridRevenueGbp})+
    '. Total battery DC-to-AC difference this day '+solar.dcToAc.batteryDischargingKwh.toFixed(2)+
    ' kWh (house use accounted for separately); actual metered export '+solar.dcToAc.meteredGridExportKwh.toFixed(2)+' kWh'+
    ', minus '+money({available:true,value:solar.exportSolarOpportunityGbp})+
    ' in foregone direct solar export and '+money({available:true,value:solar.solarExportWearGbp})+
    ' in recorded/confirmed wear allowance. Solar used for household supply also forgoes direct export and is deducted in the battery payback tracker.':
    'Solar-stored export gain unavailable: '+(solar?.reason||'Waiting for validated readings'));
   fill('#foxDischargeDC',discharge?.available?discharge.dcKwh.toFixed(2)+' kWh':'—');
   fill('#foxDischargeAC',discharge?.available?discharge.acKwh.toFixed(2)+' kWh':'—');
   fill('#foxDischargeLoss',discharge?.available?discharge.lossKwh.toFixed(2)+' kWh':'—');
   fill('#foxDischargeStatus',discharge?.available?
    'DC-to-AC difference between verified battery-only measurement points. May include inverter auxiliary use. Not the difference between battery energy and metered grid export.':
    'Discharge comparison unavailable: '+(discharge?.reason||'Waiting for readings'));
   fill('#foxHouseStatus',household?.available?
    'House '+household.houseKwh.toFixed(2)+' kWh · grid '+household.gridKwh.toFixed(2)+' kWh · direct solar '+
    household.solarKwh.toFixed(2)+' kWh · battery '+household.batteryKwh.toFixed(2)+' kWh. Solar opportunity cost tracked separately.':
    'Household savings unavailable: '+(household?.reason||'Waiting for readings'));
   fill('#foxForcedStatus',force?.available?
    'Force-export '+force.total.toFixed(2)+' kWh · gross receipts included within total metered export (not extra net profit).':
    'Force-discharge earnings unavailable: '+(force?.reason||'Waiting for readings'));
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

