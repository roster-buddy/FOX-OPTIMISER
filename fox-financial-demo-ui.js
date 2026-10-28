/* Explicitly opt-in illustrative mode. No writes to actual reports or storage. */
(function(root){
'use strict';
const doc=root.document;
if(!doc||!root.FoxFinancialDemoCore)return;
const core=root.FoxFinancialDemoCore;
const money=n=>(n<0?'−£':'£')+Math.abs(n).toFixed(2);
const kwh=n=>n.toFixed(2)+' kWh';
function setup(){
 const actual=doc.getElementById('foxActualCosts');
 if(!actual||doc.getElementById('foxFinancialDemo'))return;
 let sample=core.makeMonth(),chosen=15;
 const el=doc.createElement('section');el.id='foxFinancialDemo';el.className='fox-demo-panel';
 el.setAttribute('aria-label','Synthetic demonstration finances only');
 el.innerHTML=[
 '<div class="fox-demo-heading">',
 ' <div><span class="fox-demo-label">DEMO · SIMULATED DATA ONLY</span>',
 ' <h3>See sample savings &amp; battery earnings</h3>',
 ' <p class="note">Illustrative October 2026 figures, not your Fox ESS, Octopus or Ohme readings.</p></div>',
 ' <button id="foxDemoToggle" type="button" class="secondary" aria-expanded="false" aria-controls="foxDemoContent">Open sample figures</button>',
 '</div>',
 '<div id="foxDemoContent" hidden>',
 ' <div class="fox-demo-banner" role="status">SAMPLE DATA — NOT ACTUAL FINANCIAL RESULTS · no API connection · no battery control</div>',
 ' <div class="fox-demo-controls"><label class="fox-demo-ev"><input id="foxDemoIncludeEV" type="checkbox" checked> Include hypothetical EV charging in grid bills</label>',
 '  <span id="foxDemoEvHint">EV is always excluded from household savings.</span></div>',
 ' <h4>Illustrative October 2026 total · 31 simulated days</h4>',
 ' <div class="fox-demo-stats">',
 '  <div><small>Battery-house saving · after solar opportunity cost, EV excluded</small><strong id="foxDemoMonthSaved"></strong></div>',
 '  <div><small>Forced battery export receipts · gross</small><strong id="foxDemoMonthForce"></strong></div>',
 '  <div><small>Extra profit from stored solar export · after 12p alternative and wear</small><strong id="foxDemoMonthSolarGain"></strong></div>',
 '  <div><small>£4,800 payback · still to recover</small><strong id="foxDemoMonthRemaining"></strong></div>',
 '  <div><small>Break-even · flat-rate illustration</small><strong id="foxDemoMonthBreakEven"></strong></div>',
 ' </div><p id="foxDemoMonthExplanation" class="note"></p>',
 ' <details class="foxDisclosure"><summary>Example charging and discharging losses (technical)</summary>',
 '  <p class="note">Illustrative charging loss <span id="foxDemoMonthChargeLoss"></span> · discharge loss <span id="foxDemoMonthDischargeLoss"></span>. These costs are already included in the battery purchase allocation.</p>',
 ' </details>',
 ' <h4>Pick a sample day</h4>',
 ' <div id="foxDemoMonthDays" class="fox-demo-calendar" role="group" aria-label="Illustrative October 2026 days"></div>',
 ' <div class="fox-demo-day"><h4 id="foxDemoDayHeading">SIMULATED DAY</h4>',
 '  <div class="fox-demo-stats">',
 '   <div><small>House cost with solar but without battery</small><strong id="foxDemoBaseline"></strong></div>',
 '   <div><small>House supply cost incl. allocated battery charging</small><strong id="foxDemoHouseCost"></strong></div>',
 '   <div><small>Battery-house saving · net of solar opportunity cost</small><strong id="foxDemoHouseSaved"></strong></div>',
 '   <div><small>Forced battery grid export · gross receipts</small><strong id="foxDemoForcedIncome"></strong></div>',
 '   <div><small>Additional stored-solar export gain</small><strong id="foxDemoDaySolarGain"></strong></div>',
 '  </div><div class="fox-demo-flow" id="foxDemoHouseFlow"></div>',
 '  <div class="fox-demo-flow" id="foxDemoBatteryFlow"></div>',
 '  <details class="foxDisclosure"><summary>Example discharge costs, export and cash balance</summary>',
 '   <div id="foxDemoDetail" class="fox-demo-detail"></div></details>',
 ' </div>',
 ' <p class="fox-demo-caution">Payback uses battery-only house savings MINUS the 12p opportunity value of solar stored and used in the house, PLUS additional solar-origin stored export gain above the 12p direct-export alternative after estimated wear. It excludes the remaining forced-export gross earnings and does not assume those are incremental profit. All values are fabricated examples, including solar, EV charging, energy losses and export rates. Daily totals cannot demonstrate compliance with the 3.5 kW instantaneous grid export limit. Household bill savings do not subtract foregone solar export value. Force export margin does not account for keeping the battery for household use or a later export price. Gross export earnings are already included in grid cash balance.</p>',
 '</div>'
 ].join('');
 const heading=actual.querySelector('h2');if(!heading)return;heading.after(el);
 const byId=id=>el.querySelector('#'+id);
 const content=byId('foxDemoContent'),toggle=byId('foxDemoToggle'),ev=byId('foxDemoIncludeEV');
 const set=(id,value)=>byId(id).textContent=value;
 const days=byId('foxDemoMonthDays');
 for(const day of sample.days){
  const button=doc.createElement('button');
  button.type='button';button.className='fox-demo-day-button';button.dataset.day=String(day.day);
  const number=doc.createElement('strong');number.textContent=String(day.day);
  const value=doc.createElement('small');value.textContent=money(day.batteryPaybackGainGbp);
  button.append(number,value);
  button.setAttribute('aria-label','Simulated October '+day.day+', battery recovery benefit '+money(day.batteryPaybackGainGbp));
  button.addEventListener('click',()=>{chosen=day.day;renderDay();});
  days.append(button);
 }
 function renderDay(){
  const d=sample.days[chosen-1];
  for(const button of days.querySelectorAll('button'))button.setAttribute('aria-pressed',String(Number(button.dataset.day)===chosen));
  set('foxDemoDayHeading','DEMO · '+new Intl.DateTimeFormat('en-GB',{
   day:'numeric',month:'long',year:'numeric',timeZone:'UTC'
  }).format(new Date(d.date+'T12:00:00Z')));
  set('foxDemoBaseline',money(d.baselineWithoutBatteryGbp));
  set('foxDemoHouseCost',money(d.houseActualSupplyGbp));
  set('foxDemoHouseSaved',money(d.batteryPaybackSavingGbp));
  set('foxDemoDaySolarGain',money(d.solarStorage.solarExportGainGbp));
  set('foxDemoForcedIncome',money(d.forcedExportReceiptsGbp));
  set('foxDemoHouseFlow','House '+kwh(d.houseDemandKwh)+
    ' = grid '+kwh(d.houseGridKwh)+' + direct solar '+kwh(d.houseSolarKwh)+
    ' + battery '+kwh(d.houseBatteryKwh)+'. EV '+kwh(d.evGridKwh)+' is separate.');
  set('foxDemoBatteryFlow','Battery charging: grid '+kwh(d.batteryGridChargeKwh)+
    ' + solar '+kwh(d.solarBatteryInputKwh)+' → charging loss '+kwh(d.batteryChargeLossKwh)+
    '. Discharge: DC '+kwh(d.batteryDcDischargeKwh)+' → AC '+kwh(d.batteryAcDeliveredKwh)+
    ' (loss '+kwh(d.batteryDischargeLossKwh)+').');
  set('foxDemoDetail','SOLAR ORIGIN EXAMPLE: solar diverted into battery '+kwh(d.solarStorage.solarChargeInputAcKwh)+
    '; solar-attributed battery electricity reaching grid '+kwh(d.solarStorage.solarGridExportAcKwh)+
    '; paid export '+money(d.solarStorage.solarGridRevenueGbp)+
    '; direct solar export foregone at 12p per input kWh '+money(d.solarStorage.exportSolarOpportunityGbp)+
    '; attributed battery wear '+money(d.solarStorage.solarExportWearGbp)+
    '; additional profit '+money(d.solarStorage.solarExportGainGbp)+
    '. Solar used from battery in house forgoes '+money(d.solarStorage.houseSolarOpportunityGbp)+
    ' potential direct export, deducted from house saving. DEMO: battery grid export '+kwh(d.forceGridExportKwh)+
    ' earns '+money(d.forcedExportReceiptsGbp)+
    '. Allocated battery purchase cost '+money(d.forceBatteryCostGbp)+
    ', assumed wear '+money(d.forceWearGbp)+
    ' gives a margin before forgone alternatives of '+money(d.forceMarginBeforeAlternativeGbp)+
    '. Solar grid export '+kwh(d.solarExportKwh)+' earns '+money(d.solarExportReceiptsGbp)+
    '. Combined hypothetical metered export '+kwh(d.meteredGridExportKwh)+
    ' earns '+money(d.totalExportReceiptsGbp)+
    '. Total meter import cost, including EV '+money(d.totalGridImportCostGbp)+
    ', makes grid cash balance '+money(d.netGridCashGbp)+
    '. EV alone costs '+money(d.evImportCostGbp)+
    '. A weighted stored-energy cost pool carries forward across days. Solar stored energy has zero purchase cost, but foregone solar export is not deducted.');
 }
 function render(){
  const t=sample.totals;
  set('foxDemoMonthSaved',money(t.batteryPaybackSavingGbp));
  set('foxDemoMonthSolarGain',money(t.solarStorageExportGainGbp));
  const remaining=Math.max(0,4800-t.batteryPaybackGainGbp);
  set('foxDemoMonthRemaining',money(remaining));
  if(t.batteryPaybackGainGbp>0){
   const months=Math.ceil(remaining/t.batteryPaybackGainGbp);
   const horizon=new Date(Date.UTC(2026,10+months,1));
   set('foxDemoMonthBreakEven',horizon.toISOString().slice(0,7));
  } else set('foxDemoMonthBreakEven','No payback at this rate');
  set('foxDemoMonthForce',money(t.forcedExportReceiptsGbp));
  set('foxDemoMonthChargeLoss',kwh(t.batteryChargeLossKwh));
  set('foxDemoMonthDischargeLoss',kwh(t.batteryDischargeLossKwh));
  set('foxDemoMonthExplanation','House use '+kwh(t.houseDemandKwh)+
   ' · EV separately '+kwh(t.evGridKwh)+' (cost '+money(t.evImportCostGbp)+
   ') · illustrative grid cash balance including EV '+money(t.netGridCashGbp)+
   '. Break-even uses battery household savings after solar opportunity costs PLUS additional solar-stored export profit above the 12p alternative (after estimated wear). This repeats the SAME fictional October each month; it is not an AI prediction. No actual readings were loaded.');
  renderDay();
 }
 toggle.addEventListener('click',()=>{
  content.hidden=!content.hidden;
  toggle.setAttribute('aria-expanded',String(!content.hidden));
  toggle.textContent=content.hidden?'Open sample figures':'Close sample figures';
  if(!content.hidden)render();
 });
 ev.addEventListener('change',()=>{
  sample=core.makeMonth({includeEV:ev.checked});
  render();
 });
}
// Deferred scripts can execute while the document is 'interactive', before
// fox-actual-costs.js has created its panel on DOMContentLoaded.
if(doc.readyState!=='complete')doc.addEventListener('DOMContentLoaded',setup);
else setup();
})(typeof window!=='undefined'?window:globalThis);
