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
 '  <div><small>Direct solar Agile uplift above 12p · monthly</small><strong id="foxDemoMonthDirectSolar"></strong></div>',
 '  <div><small>£4,800 payback · still to recover</small><strong id="foxDemoMonthRemaining"></strong></div>',
 '  <div><small>Break-even · flat-rate illustration</small><strong id="foxDemoMonthBreakEven"></strong></div>',
 ' </div><p id="foxDemoMonthExplanation" class="note"></p>',
 ' <details class="foxDisclosure"><summary>Example charging and discharging losses (technical)</summary>',
 '  <p class="note">Illustrative charging loss <span id="foxDemoMonthChargeLoss"></span> · discharge loss <span id="foxDemoMonthDischargeLoss"></span>. These costs are already included in the battery purchase allocation.</p>',
 ' </details>',
 ' <h4>Pick a sample day</h4>',
 ' <div id="foxDemoMonthDays" class="fox-demo-calendar" role="group" aria-label="Illustrative October 2026 days"></div>',
 ' <div class="fox-demo-day"><h4 id="foxDemoDayHeading">SIMULATED DAY</h4>',
 '  <p class="fox-demo-key-label">Daily battery benefit · illustrative, not your actual earnings</p>',
 '  <div class="fox-demo-stats fox-demo-primary-stats">',
 '   <div class="fox-demo-main-saving"><small>Battery-house saving · after foregone solar export</small><strong id="foxDemoHouseSaved"></strong></div>',
 '   <div><small>Extra stored-solar export profit · after wear</small><strong id="foxDemoDaySolarGain"></strong></div>',
 '   <div><small>Direct solar Agile uplift above 12p</small><strong id="foxDemoDayDirectSolar"></strong></div>',
 '  </div>',
 '  <p class="fox-demo-key-label">Separate cash received · not automatically extra profit</p>',
 '  <div class="fox-demo-cash-line"><span>Forced battery export · gross receipts</span><strong id="foxDemoForcedIncome"></strong></div>',
 '  <details class="foxDisclosure fox-demo-explanation"><summary>Compare household costs and energy flows</summary>',
 '   <div class="fox-demo-stats fox-demo-secondary-stats">',
 '    <div><small>House cost with solar but without battery</small><strong id="foxDemoBaseline"></strong></div>',
 '    <div><small>House supply cost incl. allocated battery charging</small><strong id="foxDemoHouseCost"></strong></div>',
 '   </div>',
 '   <div class="fox-demo-flow" id="foxDemoHouseFlow"></div>',
 '   <div class="fox-demo-flow" id="foxDemoBatteryFlow"></div>',
 '  </details>',
 '  <details class="foxDisclosure fox-demo-explanation"><summary>Technical export, discharge costs and meter balance</summary>',
 '   <div id="foxDemoDetail" class="fox-demo-detail"></div></details>',
 ' </div>',
 ' <details class="foxDisclosure fox-demo-explanation fox-demo-method"><summary>How this fictional payback calculation works</summary>',
 '  <p class="fox-demo-caution">Payback uses battery-only house savings MINUS the 12p opportunity value of solar stored and used in the house, PLUS additional solar-origin stored export gain above the 12p direct-export alternative after estimated wear. PLUS direct-solar-only Agile uplift above 12p (floored at zero per day). It excludes the remaining forced-export gross earnings and does not assume those are incremental profit. All values are fabricated examples, including solar, EV charging, energy losses and export rates. Daily totals cannot demonstrate compliance with the 3.5 kW instantaneous grid export limit. Battery investment recovery DOES subtract foregone solar export from battery-to-house use; raw meter bill comparisons do not. Force export margin does not account for keeping the battery for household use or a later export price. Gross export earnings are already included in grid cash balance.</p>',
 ' </details>',
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
  set('foxDemoDayDirectSolar',money(d.directSolarUpliftGbp));
  set('foxDemoForcedIncome',money(d.forcedExportReceiptsGbp));
  set('foxDemoHouseFlow','House '+kwh(d.houseDemandKwh)+
    ' = grid '+kwh(d.houseGridKwh)+' + direct solar '+kwh(d.houseSolarKwh)+
    ' + battery '+kwh(d.houseBatteryKwh)+'. EV '+kwh(d.evGridKwh)+' is separate.');
  set('foxDemoBatteryFlow','Battery charging: grid '+kwh(d.batteryGridChargeKwh)+
    ' + solar '+kwh(d.solarBatteryInputKwh)+' → charging loss '+kwh(d.batteryChargeLossKwh)+
    '. Discharge: DC '+kwh(d.batteryDcDischargeKwh)+' → AC '+kwh(d.batteryAcDeliveredKwh)+
    ' (loss '+kwh(d.batteryDischargeLossKwh)+').');
  const detail=byId('foxDemoDetail');
  detail.replaceChildren();
  const sections=[
   ['Solar energy attributed to battery',[
    ['Solar diverted into battery',kwh(d.solarStorage.solarChargeInputAcKwh)],
    ['Solar-attributed battery electricity reaching grid',kwh(d.solarStorage.solarGridExportAcKwh)],
    ['Export receipts',money(d.solarStorage.solarGridRevenueGbp)],
    ['Foregone direct export at 12p',money(d.solarStorage.exportSolarOpportunityGbp)],
    ['Attributed battery wear',money(d.solarStorage.solarExportWearGbp)],
    ['Additional stored-solar export gain',money(d.solarStorage.solarExportGainGbp)],
    ['Solar export value foregone by battery-to-house use',money(d.solarStorage.houseSolarOpportunityGbp)]
   ]],
   ['Battery export and grid cash',[
    ['Battery export',kwh(d.forceGridExportKwh)],
    ['Gross battery export receipts',money(d.forcedExportReceiptsGbp)],
    ['Allocated battery purchase cost',money(d.forceBatteryCostGbp)],
    ['Assumed battery wear',money(d.forceWearGbp)],
    ['Margin before foregone alternatives',money(d.forceMarginBeforeAlternativeGbp)],
    ['Direct solar export',kwh(d.solarExportKwh)],
    ['Direct solar export receipts',money(d.solarExportReceiptsGbp)],
    ['Combined metered export',kwh(d.meteredGridExportKwh)],
    ['Combined export receipts',money(d.totalExportReceiptsGbp)],
    ['Total meter import cost including EV',money(d.totalGridImportCostGbp)],
    ['Grid cash balance',money(d.netGridCashGbp)],
    ['EV charging cost',money(d.evImportCostGbp)]
   ]]
  ];
  for(const [heading,rows] of sections){
   const h=doc.createElement('h5');h.textContent=heading;detail.append(h);
   const dl=doc.createElement('dl');dl.className='fox-demo-detail-list';
   for(const [label,value] of rows){
    const dt=doc.createElement('dt');dt.textContent=label;
    const dd=doc.createElement('dd');dd.textContent=value;
    dl.append(dt,dd);
   }
   detail.append(dl);
  }
  const note=doc.createElement('p');note.className='note';
  note.textContent='DEMO assumptions: weighted stored-energy purchase costs carry forward between days. The £4,800 recovery example subtracts foregone direct solar export value. Solar attribution is an accounting assumption, not physically identifiable electrons.';
  detail.append(note);
 }
 function render(){
  const t=sample.totals;
  set('foxDemoMonthSaved',money(t.batteryPaybackSavingGbp));
  set('foxDemoMonthSolarGain',money(t.solarStorageExportGainGbp));
  set('foxDemoMonthDirectSolar',money(t.directSolarUpliftGbp));
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
   '. Break-even uses battery household savings after solar opportunity costs PLUS additional solar-stored export profit above the 12p alternative (after estimated wear), PLUS direct-solar Agile uplift above 12p on independently exported solar. This repeats the SAME fictional October each month; it is not an AI prediction. No actual readings were loaded.');
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
