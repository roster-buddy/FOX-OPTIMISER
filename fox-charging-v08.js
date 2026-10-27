(() => {
'use strict';
const KEY='fox-charging-v06-settings';
const defaults={evConnect:'23:30',evPercent:15,evDeadline:'04:00',evCapacity:61.7,evKw:6.63,evEfficiency:90,gridKw:8.3,houseKw:0.4,batteryKw:5,batteryEfficiency:90};
let cfg={...defaults};try{cfg={...cfg,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}
const n=(v,d)=>Number.isFinite(+v)?+v:d;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const pad=x=>String(x).padStart(2,'0');

const ukParts=d=>Object.fromEntries(
 new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/London',
  year:'numeric',month:'2-digit',day:'2-digit',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 }).formatToParts(d).map(x=>[x.type,x.value])
);
const localDate=d=>{
 const p=ukParts(d);
 return `${p.year}-${p.month}-${p.day}`;
};
const time=d=>{
 const p=ukParts(d);
 return `${p.hour}:${p.minute}`;
};
const dateKey=d=>`${localDate(d)}T${time(d)}`;
const isFree=t=>t==='happy'||t==='legacy'; // Only explicitly marked free sessions; Power Up is not assumed free.
const typeAt=d=>{const x=window.foxOctopusSessions?.getForDay?.(localDate(d));if(!x)return null;const key=dateKey(d);if(Array.isArray(x))return x.find(v=>v?.key===key||v?.start===key)?.type||null;if(typeof x==='object')return x[key]?.type||x[time(d)]?.type||null;return null};

const solarState={learningComplete:false,learningDays:0,loggerOnline:false};
const ukDay=(d)=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const x=Object.fromEntries(p.map(a=>[a.type,a.value]));return x.year+'-'+x.month+'-'+x.day;};

function targetDecisionV360(night){
 const key='fox-target-decision-v360';
 let previous=null;
 try{previous=JSON.parse(localStorage.getItem(key)||'null');}catch{}
 const decision=window.FoxTargetCore.decide(Date.now(),night,previous);
 if(!decision.pending){
  try{localStorage.setItem(key,JSON.stringify(decision));}catch{}
 }
 return decision;
}
function solarCard() {
 const node=document.getElementById('foxSolarAwareV08');
 if(!node)return;
 const night=window.FoxOvernightCore.windowFor(Date.now());
 const decision=targetDecisionV360(night);
 const day=ukDay(new Date(night.end));
 const snap=window.foxSolarForecastV08?.(day);
 const rows=[
  'Active overnight target: 100%.',
  decision.pending?'23:30 decision pending.':'23:30 decision recorded for this night.',
  decision.note,
  'The app must be open to record this decision. No background scheduler or device control.'
 ];
 if(decision.late)rows.push('Recorded after 23:30; this is not proof a decision ran at the cutoff.');
 if(snap?.available){
  rows.push('Weather estimate for '+day+': '+snap.generationKwh.toFixed(2)+
   ' kWh solar. Household demand remains estimated.');
 }else rows.push('Weather unavailable. The active overnight target remains 100%.');
 rows.push('The comparison below evaluates timing and losses, not just total daily solar surplus.');
 node.textContent=rows.join('\n');
}

function renderTargetResearchV380(result) {
 let panel=document.getElementById('foxTargetTablesV380');
 if(!result){
  if(panel)panel.replaceChildren();
  return;
 }
 if(!panel){
  const anchor=document.getElementById('foxTargetResultV360');
  if(!anchor)return;
  panel=document.createElement('div');
  panel.id='foxTargetTablesV380';
  anchor.insertAdjacentElement('afterend',panel);
 }
 const make=(tag,text)=>Object.assign(
  document.createElement(tag),{textContent:text}
 );
 const table=(headers,rows)=>{
  const wrap=document.createElement('div');
  wrap.style.cssText='overflow:auto;max-height:400px;margin:12px 0';
  const t=document.createElement('table');
  t.style.cssText='width:100%;border-collapse:collapse;text-align:left';
  const head=document.createElement('thead');
  const hr=document.createElement('tr');
  for(const text of headers)hr.append(make('th',text));
  head.append(hr);
  const body=document.createElement('tbody');
  for(const values of rows){
   const row=document.createElement('tr');
   for(const text of values){
    const cell=make('td',String(text));
    cell.style.cssText='padding:9px 6px;border-bottom:1px solid #334765';
    row.append(cell);
   }
   body.append(row);
  }
  t.append(head,body);
  wrap.append(t);
  return wrap;
 };
 const best=result.best;
 const candidates=[...result.candidates].sort((a,b)=>a.target-b.target);
 const fmt=x=>Number(x).toFixed(2);
 const basis=result.full||best;
 const targets=table(
  ['Target','SOC at 05:30','Battery grid charge','SOC at 19:00','Benefit vs baseline'],
  candidates.map(x=>[
   x.target+'%',
   fmt(x.socAt0530)+'%',
   fmt(x.overnightKWh)+' kWh',
   fmt(x.at19)+'%',
   '£'+fmt(basis.cost-x.cost)+(x.target===best.target?' · selected':'')
  ])
 );
 const uk=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/London',day:'2-digit',month:'short',
  hour:'2-digit',minute:'2-digit',hourCycle:'h23'
 });
 const schedule=table(
  ['Half-hour start (UK)','Export rate','Battery export','Solar stored','SOC at end'],
  best.result.steps.map(x=>[
   uk.format(new Date(x.utc)),
   fmt(x.price)+'p/kWh',
   fmt(x.forced)+' kWh',
   fmt(x.solarStored)+' kWh',
   fmt(x.ending/result.capacity*100)+'%'+
    (x.checkpoint?' · 19:00 checkpoint':'')
  ])
 );
 panel.replaceChildren(
  make('h4','Overnight target comparison · research'),
  make('p','Snapshot only. Re-run after prices, weather or assumptions change. '+
   'Only feasible tested targets appear. Baseline: '+
   (result.full?'100% target.':'best feasible candidate; 100% is infeasible.')),
  targets,
  make('h4','Selected research schedule · '+best.target+'% overnight target'),
  make('p','This is the selected research scenario, not the active dashboard export plan. '+
   'Solar stored is battery energy after charging losses. '+
   'Household use and natural solar exports are included in the calculation.'),
  schedule
 );
}

function comparisonTimeV456(){
 return new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/London',day:'2-digit',month:'short',year:'numeric',
  hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'
 }).format(new Date())+' Europe/London';
}
let targetComparisonRequestedV455=false;
let targetComparisonTimerV455;
function compareTargetsV360(){
 targetComparisonRequestedV455=true;
 clearTimeout(targetComparisonTimerV455);
 renderTargetResearchV380(null);
 const output=document.getElementById('foxTargetResultV360');
 output.textContent='Calculating research comparison...';
 targetComparisonTimerV455=setTimeout(()=>{
  try{
   const now=Date.now();
   const night=window.FoxOvernightCore.windowFor(now);
   const input=window.foxTargetInputsV360?.(night);
   if(!input?.available)throw Error(input?.reason||'Target inputs unavailable');
   const projection=window.foxOvernightSocV350?.(night.start);
   if(!projection?.available)throw Error('Valid predicted 23:30 SOC required');
   const result=window.FoxTargetCore.compare(
    input.config,input.slots,
    {...cfg,
     ...(window.foxChargingScenarioV420?
      {evSchedule:window.foxChargingScenarioV420.evSchedule}:{}),
     capacity:input.config.capacity,soc:projection.soc},now
   );
   if(!result.ok)throw Error(result.reason);
   const best=result.best;
   const full=result.full;
   output.textContent=
    'RESEARCH ONLY · Active overnight target remains 100%.\n'+
    'Comparison calculated at: '+comparisonTimeV456()+'\n'+
     'Next-day comparison ends at 23:00 UK time. 23:00–23:30 is excluded from this calculation.\n'+
    'Lowest estimated cost among tested 5%-step targets: '+best.target+'%.\n'+
    'Predicted SOC at 05:30: '+best.socAt0530.toFixed(2)+'%; at 19:00: '+
    best.at19.toFixed(2)+'%.\n'+
    'Overnight battery import: '+best.overnightKWh.toFixed(2)+' kWh. '+
    'Next-day forced battery export: '+best.forced.toFixed(2)+' kWh.\n'+
    (full?'Estimated improvement versus charging to 100%: £'+
     Math.max(0,full.cost-best.cost).toFixed(2)+'.':
     '100% target is infeasible under the entered overnight assumptions.')+
    (best.evShort>.05?'\nWARNING: EV charging requirement is also infeasible.':'')+
    '\nIncludes overnight battery charging, daytime import/export, optional wear '+
    'and an assumed terminal refill to the same full battery. '+
    'EV and overnight household costs are common to these candidates. '+
    'Measured-history validation is not yet available.';
   renderTargetResearchV380({...result,capacity:input.config.capacity});
  }catch(error){
   output.textContent='Comparison unavailable: '+error.message+
    '. Active overnight target remains 100%.\nLast comparison attempt: '+comparisonTimeV456();
  }
 },0);
}
async function refreshLearning(){
 try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error('offline');const data=await r.json();solarState.loggerOnline=true;solarState.learningDays=Number(data.valid_days)||0;solarState.learningComplete=data.learning_complete===true;}
 catch{solarState.loggerOnline=false;solarState.learningComplete=false;solarState.learningDays=0;}
 solarCard();
}

function render(){

 const batteryCapacity=n(
  document.querySelector('[name="capacity"]')?.value,9
 );
 const manualSoc=clamp(n(
  document.querySelector('[name="soc"]')?.value,50
 ),0,100);
 const night=window.FoxOvernightCore.windowFor(Date.now());
 const projection=window.foxOvernightSocV350?.(night.start);
 const soc=projection?.available?projection.soc:manualSoc;
 const startingNote=projection?.available?
  'Predicted SOC at 23:30: '+soc.toFixed(2)+'%. '+projection.source+
  (projection.tailSlots?' · Evening self-use extended beyond price coverage; no extra forced exports.':''):
  'MANUAL FALLBACK: '+manualSoc.toFixed(2)+'% assumed at 23:30. '+
  (projection?.reason||'Daytime forecast link unavailable')+'.';

 const decision=targetDecisionV360(night);
 const result=window.FoxOvernightCore.simulate({
  ...cfg,
  ...(window.foxChargingScenarioV420?
   {evSchedule:window.foxChargingScenarioV420.evSchedule}:{}),
  capacity:batteryCapacity,
  soc,
  target:decision.target
 },Date.now());

 const {
  evNeed,batteryNeed,evDelivered,batDelivered,
  deadlineOutsideWindow
 }=result;

 const evLeft=result.evShort;
 const batLeft=result.batteryShort;
 let freeImport=0,paidImport=0,freeMinutes=0;

 const rows=result.rows.map(row=>{
  const free=isFree(typeAt(new Date(row.start)));
  const used=row.segments.reduce(
   (sum,x)=>sum+x.gridKW*x.hours,0
  );
  if(free){
   freeImport+=used;
   freeMinutes+=30;
  }else{
   paidImport+=used;
  }
  return {...row,free};
 });
 const fmt=x=>x.toFixed(2);
 const status=document.getElementById('foxChargeStatus');
 const evOK=evLeft<.05,batOK=batLeft<.05;
  if(deadlineOutsideWindow) { status.title='EV deadline is after 05:30. This simulation only models the 23:30–05:30 overnight window.'; } else { status.removeAttribute('title'); }
 status.textContent=startingNote+' '+`EV: ${fmt(evDelivered)} / ${fmt(evNeed)} kWh from mains by ${cfg.evDeadline} (${evOK?'feasible':'SHORT '+fmt(evLeft)+' kWh'}). Battery: ${fmt(batDelivered)} / ${fmt(batteryNeed)} kWh from mains (${batOK?'target feasible':'SHORT '+fmt(batLeft)+' kWh'}). Peak simultaneous grid import: ${cfg.gridKw.toFixed(1)} kW (provisional). Battery starts at 23:30; EV priority from assumed connection ${cfg.evConnect} UK time. Target: ${decision.target}%. ${decision.note}${result.gridExceeded?' WARNING: supplied EV schedule plus household demand exceeds the import ceiling; battery charging is withheld during affected segments.':result.householdExceedsCap?' WARNING: household demand alone exceeds the import ceiling.':''}`;
 const tbody=document.getElementById('foxChargeRows');tbody.replaceChildren();
 for(const r of rows){const tr=document.createElement('tr');for(const x of [r.at,fmt(r.ev),fmt(r.bat),fmt(r.grid),r.free?'Booked free session*':'Intelligent Go · cheap']){const td=document.createElement('td');td.textContent=x;td.style.padding='7px 5px';tr.append(td)}tbody.append(tr)}
 document.getElementById('foxChargeFoot').textContent=`Estimated scheduled import: ${fmt(freeImport)} kWh in marked free slots and ${fmt(paidImport)} kWh in other slots. *The 23:30–05:30 period is shown as Intelligent Octopus Go cheap-rate unless a booked free session is explicitly marked. Free import is subject to Octopus eligibility, booked-hour allowances and actual metering. Rows show half-hour average power. Segment checks use assumed constant loads; they cannot enforce instantaneous limits. This simulates the whole selected night from the labelled starting SOC, not charging already delivered. This is a planning estimate, not a bill or live Ohme reading.`;
}
function setup(){
 if(document.getElementById('foxChargingV06'))return;
 const host=document.querySelector('#v4Calendar')?.closest('section')||document.querySelector('main');if(!host)return;
 const panel=document.createElement('section');panel.className='panel';panel.id='foxChargingV06';
 panel.innerHTML=`<h3>EV + home battery charging planner</h3><p class="note">Read-only simulation · EV windows are estimates, NOT Ohme's actual schedule · Recalculates every 30 seconds</p><div id="foxChargeInputs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px"></div><p id="foxChargeStatus" aria-live="polite"></p><div style="overflow-x:auto"><table style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr><th>UK time</th><th>EV avg kW</th><th>Battery avg kW</th><th>Grid avg kW</th><th>Tariff</th></tr></thead><tbody id="foxChargeRows"></tbody></table></div><p id="foxChargeFoot" class="note"></p><p class="note">Battery target 100% during learning. Solar is not assumed overnight. House demand and grid headroom are provisional. This simulation does not change Ohme or inverter schedules. No live data or hardware commands.</p>`;
 host.insertAdjacentElement('afterend',panel);

const solarPanel=document.createElement('section');
solarPanel.className='panel';
solarPanel.id='foxSolarAwareV08Panel';
solarPanel.innerHTML='<h3>Solar-aware overnight battery planning · v0.8</h3><p class="note">Forecast scenario only. Active battery target remains 100% during learning.</p><div id="foxSolarAwareV08" style="white-space:pre-line;line-height:1.8"></div>';
panel.insertAdjacentElement('afterend',solarPanel);
const compareButton=document.createElement('button');
compareButton.type='button';
compareButton.textContent='Compare next-day overnight targets · research';
compareButton.addEventListener('click',compareTargetsV360);
const targetOutput=document.createElement('p');
targetOutput.id='foxTargetResultV360';
targetOutput.style.whiteSpace='pre-line';
targetOutput.textContent='Comparison not run. Active target remains 100%.';
solarPanel.append(compareButton,targetOutput);


 const fields=[['evConnect','Assumed EV plug-in (UK time)',null,null,null],['evPercent','EV top-up (%)',1,100,1],['evDeadline','EV ready by (HH:MM)',null,null,null],['gridKw','Shared grid import cap (kW)',1,30,.1],['houseKw','House demand (kW)',0,15,.1],['evKw','EV charging power (kW)',0,22,.1],['batteryKw','Battery max charging power (kW)',0,20,.1],['evCapacity','EV usable capacity (kWh)',1,150,.1],['evEfficiency','EV charging efficiency (%)',50,100,1],['batteryEfficiency','Battery charging efficiency (%)',50,100,1]];
 const wrap=panel.querySelector('#foxChargeInputs');
 for(const [key,label,min,max,step] of fields){const lab=document.createElement('label');lab.textContent=label;const input=document.createElement('input');input.dataset.key=key;input.type=(key==='evDeadline'||key==='evConnect')?'time':'number';input.value=cfg[key];if(min!==null){input.min=min;input.max=max;input.step=step}input.addEventListener('change',()=>{if(key==='evDeadline'||key==='evConnect'){cfg[key]=/^\d{2}:\d{2}$/.test(input.value)?input.value:defaults[key]}else{cfg[key]=clamp(n(input.value,defaults[key]),min,max)}input.value=cfg[key];localStorage.setItem(KEY,JSON.stringify(cfg));render();window.foxReplanChargingV430?.()});lab.append(input);wrap.append(lab)}
 render();solarCard();refreshLearning();setInterval(()=>{render();solarCard()},30000);setInterval(refreshLearning,60000);
 document.getElementById('settings')?.addEventListener('change',()=>{
  if(!document.getElementById('settings').checkValidity())return;
  render();
  window.foxSolarAwareRefreshV08?.();
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
window.foxChargingPlannerV06={refresh:render};
// FOX_RESEARCH_REFRESH_453
window.foxSolarAwareRefreshV08=function(){
 solarCard();
 if(targetComparisonRequestedV455){
  compareTargetsV360();
  return;
 }
 const output=document.getElementById('foxTargetResultV360');
 if(!output)return;
 renderTargetResearchV380(null);
 try{
  const night=window.FoxOvernightCore.windowFor(Date.now());
  const input=window.foxTargetInputsV360?.(night);
  output.textContent=input?.available?
   'Fresh forecast inputs available. Tap Compare next-day overnight targets to calculate a new research comparison. Active overnight target remains 100%.':
   'Comparison unavailable: '+
    (input?.reason||'Target inputs unavailable')+
    '. Active overnight target remains 100%.';
 }catch(error){
  output.textContent='Comparison unavailable: '+error.message+
   '. Active overnight target remains 100%.';
 }
};
})();
