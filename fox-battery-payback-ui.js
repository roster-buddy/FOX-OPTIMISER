/* Read-only £4,800 battery investment progress. Actual data only.
   Does not read the DEMO core or add gross export receipts. */
(function(root){
'use strict';
const doc=root.document;
if(!doc||!root.FoxBatteryPaybackCore)return;
const core=root.FoxBatteryPaybackCore;
const money=n=>(n<0?'−£':'£')+Math.abs(n).toFixed(2);
function ukDay(){
 const f=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'});
 const p=Object.fromEntries(f.formatToParts(new Date()).map(x=>[x.type,x.value]));
 return p.year+'-'+p.month+'-'+p.day;
}
function setup(){
 const actual=doc.getElementById('foxActualCosts');
 if(!actual||doc.getElementById('foxBatteryPayback'))return;
 const box=doc.createElement('section');box.id='foxBatteryPayback';box.className='fox-payback';
 box.innerHTML=[
 '<div class="fox-payback-title"><div><span class="fox-payback-eyebrow">BATTERY INVESTMENT TRACKER</span>',
 '<h3>Break even on your £4,800 battery</h3></div><strong class="fox-payback-target">Target £4,800</strong></div>',
 '<p class="note">Battery-to-house savings plus extra money from storing solar and exporting it later. Lost 12p direct-export opportunity and battery conversion losses are deducted. EV and gross export revenue are not counted twice.</p>',
 '<div class="fox-payback-stats">',
 ' <div><small>Battery savings · current month</small><strong id="foxPaybackMonth">—</strong></div>',
 ' <div><small>Extra solar-storage export profit · current month</small><strong id="foxPaybackSolarMonth">—</strong></div>',
 ' <div><small>Verified total recovery</small><strong id="foxPaybackSaved">—</strong></div>',
 ' <div><small>Solar-storage export gain · cumulative</small><strong id="foxPaybackSolarTotal">—</strong></div>',
 ' <div><small>Still to recover</small><strong id="foxPaybackRemaining">£4,800.00</strong></div>',
 ' <div><small>Expected break-even date</small><strong id="foxPaybackDate">Learning…</strong></div>',
 '</div>',
 '<div class="fox-payback-track" role="progressbar" aria-label="Verified battery investment recovery" aria-valuemin="0" aria-valuemax="4800" aria-valuenow="0" aria-valuetext="Awaiting verified readings"><div id="foxPaybackFill"></div></div>',
 '<p id="foxPaybackStatus" class="note" aria-live="polite">Awaiting validated battery costs and household readings. No forecast is possible yet.</p>',
 '<p class="note">Solar stored and exported is compared against what the original solar energy could have earned via direct export (12p/kWh only where that historical baseline is confirmed). Charging/discharging losses and validated wear are reflected in the solar gain. Source provenance is model-attributed, not physically separable electrons. Financing, maintenance and battery replacement costs are not included. Historical readings must be imported for full-lifetime recovery.</p>'
 ].join('');
 // Financial recovery is the headline: place it before the separate DEMO,
 // date controls, technical ledger and loss measurements.
 const heading=actual.querySelector('h2');
 if(heading)heading.after(box);else actual.prepend(box);
 const get=id=>box.querySelector('#'+id);
 const progress=box.querySelector('.fox-payback-track');
 function render(){
  const reports=root.FoxCalendarPnl?.getVerifiedPaybackHistory?.()||[];
  const entries=core.extract(reports),asOf=ukDay();
  const state=core.analyse(entries,core.DEFAULT_TARGET_GBP,asOf);
  if(!state.available){
   get('foxPaybackMonth').textContent='—';
   get('foxPaybackSolarMonth').textContent='—';
   get('foxPaybackSolarTotal').textContent='—';
   get('foxPaybackSaved').textContent='—';
   get('foxPaybackRemaining').textContent=money(core.DEFAULT_TARGET_GBP);
   get('foxPaybackDate').textContent='Learning…';
   get('foxPaybackStatus').textContent=state.reason+
    '. The prediction becomes available after at least 60 verified days with sufficient coverage.';
   get('foxPaybackFill').style.width='0%';
   progress.setAttribute('aria-valuenow','0');
   progress.setAttribute('aria-valuetext','Awaiting verified readings');
   return;
  }
  const month=asOf.slice(0,7);
  const batteryMonth=entries.filter(x=>x.date.slice(0,7)===month)
   .reduce((n,x)=>n+x.batterySavingGbp,0);
  const monthlyCount=entries.filter(x=>x.date.slice(0,7)===month).length;
  const solarMonth=entries.filter(x=>x.date.slice(0,7)===month).reduce((n,x)=>n+(x.solarStorageGainGbp??0),0);
  get('foxPaybackMonth').textContent=monthlyCount?money(batteryMonth):'—';
  get('foxPaybackSolarMonth').textContent=monthlyCount?money(solarMonth):'—';
  get('foxPaybackSolarTotal').textContent=money(state.solarStorageGainGbp);
  get('foxPaybackSaved').textContent=money(state.totalBenefitGbp);
  get('foxPaybackRemaining').textContent=money(state.remainingGbp);
  get('foxPaybackFill').style.width=state.progressPct.toFixed(1)+'%';
  progress.setAttribute('aria-valuenow',String(Math.max(0,Math.min(core.DEFAULT_TARGET_GBP,state.totalBenefitGbp))));
  progress.setAttribute('aria-valuetext',state.progressPct.toFixed(1)+'% of £4,800 recovered');
  if(state.forecast?.available&&state.forecast.date){
   get('foxPaybackDate').textContent=state.forecast.date;
   get('foxPaybackStatus').textContent='Indicative '+state.forecast.kind+' projection ('+
    state.forecast.coveredDays+' verified days). '+state.forecast.method+'. '+state.forecast.notes;
  }else {
   get('foxPaybackDate').textContent='Learning…';
   get('foxPaybackStatus').textContent=state.completeDays+' verified solar-source and household days ('+
    (100*state.coverage).toFixed(0)+'% coverage). '+
    (state.forecast?.reason||'Awaiting enough data')+
    '. Progress counts complete recorded dates only; '+
    (state.confirmedForceDays===0?'net forced-export profit is not yet verified.':'verified incremental forced-export profit is included where available.');
  }
 }
 doc.addEventListener('fox:recorded-day-updated',render);
 render();
}
if(doc.readyState!=='complete')doc.addEventListener('DOMContentLoaded',setup);
else setup();
})(typeof window!=='undefined'?window:globalThis);
