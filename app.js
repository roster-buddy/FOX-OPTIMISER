 'use strict';
let financialWearP=0;
try{
 const v=Number(localStorage.getItem('fox-wear-p')||0);
 if(Number.isFinite(v)&&v>=0&&v<=100)financialWearP=v;
}catch{}

const DEFAULTS={soc:80,capacity:9,reserve:20,exportKw:3.5,homeDay:7,solarDay:6,peakImport:28,cheapImport:7,efficiency:90,tariff:'E-1R-AGILE-OUTGOING-19-05-13-E'};
const $=id=>document.getElementById(id);
let settings={...DEFAULTS},prices=[],priceSource='none',lastPlan=[];
try{settings={...DEFAULTS,...JSON.parse(localStorage.getItem('fox-settings')||'{}')}}catch{}

// Migrate legacy 2 kWh reserve to the new 20% target.
if (!localStorage.getItem('fox-v2-migrated')) {
  settings.reserve = 20;
  localStorage.setItem('fox-settings', JSON.stringify(settings));
  localStorage.setItem('fox-v2-migrated', '1');
}
const london=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
const londonDate=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',day:'2-digit',month:'short'});
const time=t=>london.format(new Date(t));
const date=t=>londonDate.format(new Date(t));
const hour=t=>Number(time(t).split(':')[0]);
const mins=t=>Number(time(t).split(':')[1]);
const cheap=t=>{const h=hour(t),m=mins(t);return h>23||(h===23&&m>=30)||h<5||(h===5&&m<30)};
const formatMoney=p=>`£${(p/100).toFixed(2)}`;
function inputSettings(){for(const [k,v] of Object.entries(settings)){const el=document.querySelector(`[name="${k}"]`);if(el)el.value=v}}
function readSettings(){const next={};for(const k of Object.keys(DEFAULTS)){const el=document.querySelector(`[name="${k}"]`);next[k]=k==='tariff'?el.value.trim().toUpperCase():Number(el.value)}if(!document.querySelector('#settings').checkValidity())return false;if(next.reserve<5||next.reserve>100){$('priceStatus').textContent='Battery target must be between 5% and 100%.';return false}settings=next;localStorage.setItem('fox-settings',JSON.stringify(settings));return true}
function fallbackSolarKwh(t){const h=hour(t)+mins(t)/60;const sun=Math.max(0,Math.sin(Math.PI*(h-6)/12));return settings.solarDay/15.19*sun*.5} // Approx half-hour normalised solar shape, not a weather forecast

// FOX OPTIMISER V0.3 SOLAR
// Solar forecasts only. No inverter commands.
const SOLAR_V3 = {
  kwp: 2.01,
  tilt: 35,
  azimuth: -70,
  performance: 0.80
};

let solarForecastHours = new Map();
let solarForecastActive = false;

function solarKwh(t) {
  if (!solarForecastActive) return fallbackSolarKwh(t);
  const hourStart = Math.floor(t / 3600000) * 3600000;
  const watts = solarForecastHours.get(hourStart);
  if (watts === undefined) return fallbackSolarKwh(t);
  return Math.max(
    0,
    SOLAR_V3.kwp * watts / 1000 *
    SOLAR_V3.performance * 0.5
  );
}

// v0.8: read-only access to the existing solar forecast. Never expose coordinates.
window.foxSolarForecastV08 = function(day) {
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(day);
  if (!valid || !solarForecastActive) return {available:false, reason:'Live solar forecast unavailable'};
  let generation=0, house=0, slots=0, missing=0;
  // Use UTC hours to match the existing Open-Meteo GMT forecast keys.
  const begin=Date.parse(day+'T06:00:00Z');
  const finish=Date.parse(day+'T22:00:00Z');
  for (let t=begin;t<finish;t+=1800000) {
    const key=Math.floor(t/3600000)*3600000;
    if (!solarForecastHours.has(key)) {missing++;continue;}
    generation+=solarKwh(t);
    house+=loadKwh(t);
    slots++;
  }
  if (missing || slots!==32) return {available:false,reason:'Forecast missing some daylight slots'};
  return {available:true,day,generationKwh:generation,dayHouseKwh:house,
    surplusKwh:Math.max(0,generation-house),source:'Open-Meteo tilted irradiance + estimated household demand'};
};

function initialiseSolarV3() {
  if (document.getElementById("solarV3Panel")) return;

  const anchor = document.getElementById("priceChart");
  if (!anchor) {
    console.warn("Solar panel anchor not found");
    return;
  }

  const section = anchor.closest("section") || anchor.parentElement;
  const panel = document.createElement("section");
  panel.id = "solarV3Panel";
  panel.style.cssText =
    "padding:20px;margin:16px 0;border-radius:16px;" +
    "border:1px solid #334765;background:#121e32;color:#fff";

  panel.innerHTML = `
    <h2 style="margin:0 0 8px">Solar forecast</h2>
    <p style="color:#aabbd4">
      2.01 kWp · East-southeast (110°) ·
      Estimated roof pitch 35°
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap">
      <label style="flex:1;min-width:140px">
        Latitude
        <input id="solarLatitude" type="number"
          step="any" min="-90" max="90"
          placeholder="Enter solar-site latitude"
          style="display:block;width:100%;padding:10px;
          box-sizing:border-box;background:#0b1424;
          border:1px solid #506480;color:white">
      </label>
      <label style="flex:1;min-width:140px">
        Longitude
        <input id="solarLongitude" type="number"
          step="any" min="-180" max="180"
          placeholder="Enter solar-site longitude"
          style="display:block;width:100%;padding:10px;
          box-sizing:border-box;background:#0b1424;
          border:1px solid #506480;color:white">
      </label>
    </div>
    <button id="solarForecastButton" type="button"
      style="margin-top:12px;padding:12px 18px;
      background:#30496e;color:white;border:0;
      border-radius:8px;font-weight:700">
      Load solar forecast
    </button>
    <p id="solarForecastStatus"
       style="color:#aabbd4" aria-live="polite">
      Enter coordinates to forecast solar generation.
    </p>
    <p style="font-size:12px;color:#8ea4c3">
      Coordinates are stored in this browser, not
      in the GitHub source. They are sent to
      Open-Meteo when requesting forecasts.
    </p>
  `;

  section.parentNode.insertBefore(panel, section);

  const lat = localStorage.getItem("fox-solar-lat");
  const lon = localStorage.getItem("fox-solar-lon");
  if (lat !== null) document.getElementById(
    "solarLatitude").value = lat;
  if (lon !== null) document.getElementById(
    "solarLongitude").value = lon;

  document.getElementById("solarForecastButton")
    .addEventListener("click", loadSolarForecastV3);

  if (lat !== null && lon !== null) loadSolarForecastV3();
}


// Validate hourly UTC irradiance before activating a weather forecast.
function validateSolarHoursV310(times, values, now) {
  if (!Number.isFinite(now) ||
      !Array.isArray(times) || !Array.isArray(values) ||
      !times.length || times.length !== values.length) {
    throw Error("Missing solar forecast data");
  }
  const next = new Map();
  for (let i = 0; i < times.length; i++) {
    const t = times[i];
    const watts = values[i];
    if (typeof t !== "string" ||
        !/^\d{4}-\d{2}-\d{2}T\d{2}:00$/.test(t)) {
      throw Error("Invalid solar forecast hour");
    }
    const when = Date.parse(t + "Z");
    if (!Number.isFinite(when) ||
        new Date(when).toISOString().slice(0,16) !== t) {
      throw Error("Invalid solar forecast hour");
    }
    if (typeof watts !== "number" ||
        !Number.isFinite(watts) || watts < 0) {
      throw Error("Invalid solar irradiance");
    }
    if (next.has(when)) throw Error("Duplicate solar forecast hour");
    next.set(when, watts);
  }
  const start = Math.ceil(now / 1800000) * 1800000;
  for (let i = 0; i < 48; i++) {
    const hourStart = Math.floor((start + i * 1800000) / 3600000) * 3600000;
    if (!next.has(hourStart)) {
      throw Error("Solar forecast missing next-24-hour coverage");
    }
  }
  return next;
}

async function loadSolarForecastV3() {
  const latInput = document.getElementById("solarLatitude");
  const lonInput = document.getElementById("solarLongitude");
  const status = document.getElementById("solarForecastStatus");
  const button = document.getElementById("solarForecastButton");

  if (!latInput.value.trim() || !lonInput.value.trim()) {
    status.textContent = "Enter both coordinates.";
    return;
  }

  const lat = Number(latInput.value);
  const lon = Number(lonInput.value);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) ||
      lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    status.textContent = "Invalid coordinates.";
    return;
  }

  button.disabled = true;
  status.textContent = "Loading live solar forecast...";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);

  try {
    const params = new URLSearchParams({
      latitude: String(lat),
      longitude: String(lon),
      hourly: "global_tilted_irradiance",
      tilt: String(SOLAR_V3.tilt),
      azimuth: String(SOLAR_V3.azimuth),
      forecast_days: "3",
      timezone: "GMT"
    });

    const response = await fetch(
      "https://api.open-meteo.com/v1/forecast?" + params,
      {signal: controller.signal}
    );

    if (!response.ok) {
      throw Error("Weather HTTP " + response.status);
    }

    const json = await response.json();
    const times = json.hourly?.time;
    const values = json.hourly?.global_tilted_irradiance;

    const next = validateSolarHoursV310(times, values, Date.now());

    solarForecastHours = next;
    solarForecastActive = true;
    v4LastSolarCheck=Date.now();
    v4UpdateRefreshStatus();

    localStorage.setItem("fox-solar-lat", String(lat));
    localStorage.setItem("fox-solar-lon", String(lon));

    const start = Math.ceil(
      Date.now() / 1800000
    ) * 1800000;

    let kwh = 0;
    for (let i = 0; i < 48; i++) {
      kwh += solarKwh(start + i * 1800000);
    }

    status.textContent =
      "LIVE SOLAR FORECAST · Next 24 hours: " +
      kwh.toFixed(2) +
      " kWh estimated generation. Export plan recalculated.";

    plan();
    window.foxSolarAwareRefreshV08?.();
  } catch (e) {
    solarForecastActive = false;
    solarForecastHours.clear();
    status.textContent =
      "Forecast unavailable: " + e.message +
      ". Using estimated solar curve.";
    plan();
    window.foxSolarAwareRefreshV08?.();
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
  }
}

initialiseSolarV3();

function loadKwh(t){const h=hour(t);const weight=(h>=17&&h<23)?1.65:(h>=0&&h<6)?0.55:1;return settings.homeDay/50.4*weight} // approximate daily 24h weighting
function netLoad(t){return Math.max(0,loadKwh(t)-solarKwh(t))}
function nextCheapIndex(items,i){for(let j=i;j<items.length;j++)if(cheap(items[j].start))return j;return items.length}

// FOX OPTIMISER V0.2 - READ-ONLY FORECAST ENGINE
// All times use Europe/London. This does not send inverter commands.
const V2 = {
  eveningTarget: 0.20,
  eveningMinimum: 0.05,
  gridExportLimitKw: 3.5,
  estimatedChargeKw: 5,
  batteryDischargeKw: 5
};

window.foxReplanChargingV430=function(){
 const table=document.getElementById('foxTargetTablesV380');
 if(table)table.replaceChildren();
 const output=document.getElementById('foxTargetResultV360');
 if(output)output.textContent='Scenario changed. Run research comparison again.';
 plan();
};
function chargingPolicyV420(){
 let cfg={};
 try{
  cfg=JSON.parse(localStorage.getItem('fox-charging-v06-settings')||'{}')||{};
 }catch{}
 return {
  ...(window.foxChargingScenarioV420||{
   mode:'unknown',confirmed:false,evSchedule:[],smartWindows:[]
  }),
  cheapP:settings.cheapImport,peakP:settings.peakImport,
  gridKW:Number.isFinite(cfg.gridKw)?cfg.gridKw:8.3,
  evMaxKW:Number.isFinite(cfg.evKw)?cfg.evKw:6.63
 };
}
function dispatchConfigV420(){
 const cap=settings.capacity;
 return {
  capacity:cap,eff:Math.max(.5,Math.min(1,settings.efficiency/100)),
  min:cap*.05,initial:cap*settings.soc/100,
  target:cap*.20,forcedFloor:cap*.20,
  chargeKW:V2.estimatedChargeKw,dischargeKW:V2.batteryDischargeKw,
  exportKW:V2.gridExportLimitKw,
  refillP:settings.cheapImport,wearP:financialWearP
 };
}
function dispatchSlotV420(t,rate){
 return window.FoxChargeAdapter.apply({
  utc:new Date(t).toISOString(),clock:hour(t)+mins(t)/60,
  solar:solarKwh(t),house:loadKwh(t),price:rate,
  allowExport:hour(t)<19,
  checkpoint:hour(t+1800000)===19&&mins(t+1800000)===0
 },chargingPolicyV420());
}
function simulateV2(slots,exports={},gridRequests=[]){
 const config=dispatchConfigV420();
 const input=slots.map(x=>dispatchSlotV420(x.start,x.rate));
 const result=window.FoxScheduleCore.replay(
  config,input,slots.map((_,i)=>exports[i]||0),gridRequests
 );
 const output=result.steps.map((step,i)=>{
  const action=step.forced>.001?'Export':
   step.chargeGrid>.001?'Cheap charge':
   step.hold?'Hold battery':
   step.solarStored>.01?'Solar charge / self-use':'Self-use';
  return {
   ...slots[i],action,
   kwh:action==='Export'?step.forced:
    action==='Cheap charge'?step.chargeGrid*config.eff:0,
   socEnd:100*step.ending/config.capacity,
   solarEstimate:step.solar,houseEstimate:step.house,
   evEstimate:step.ev,gridChargeEstimate:step.chargeGrid,
   importRate:step.importP,gridConflict:step.gridConflict,
   chargingSimulated:true,
   partialEVApproximation:input[i].partialEVApproximation
  };
 });
 return {...result,output,value:(result.revenue-result.importCost)*100};
}

// Provisional data freshness policy: successful retrieval within 60 minutes.
// This is not a measurement timestamp or weather model issue time.
function forecastFreshV320(loaded, now) {
  return Number.isFinite(loaded) && Number.isFinite(now) &&
    loaded <= now && now - loaded < 3600000;
}

function plan() {
  const now = Date.now();
  const boundary = Math.ceil(now / 1800000) * 1800000;
  prices = prices.filter(x => x.start >= boundary);

  if (priceSource === 'live' &&
      !forecastFreshV320(v4LastPriceCheck, now)) {
    lastPlan = [];
    renderEmpty();
    $('priceStatus').textContent =
      'STALE / UNVERIFIED PRICES · Export plan withheld. Load fresh Octopus rates.';
    return;
  }

  if (priceSource === 'live' && !prices.length) {
    lastPlan = [];
    renderEmpty();
    $('priceStatus').textContent =
      'PRICE COVERAGE EXPIRED · No complete future half-hours remain. Load Octopus rates.';
    return;
  }

  if (typeof solarForecastActive !== 'undefined' && solarForecastActive) {
    let covered = true;
    for (let i = 0; i < 48; i++) {
      const key = Math.floor((boundary + i * 1800000) / 3600000) * 3600000;
      if (!solarForecastHours.has(key)) covered = false;
    }
    if (!forecastFreshV320(v4LastSolarCheck, now) || !covered) {
      solarForecastActive = false;
      solarForecastHours.clear();
      const status = document.getElementById('solarForecastStatus');
      if (status) status.textContent =
        'STALE / INCOMPLETE SOLAR FORECAST · Using estimated solar curve. Reload the weather forecast.';
    }
  }
  if (!prices.length) {
    lastPlan = [];
    renderEmpty();
    return;
  }

  const slots = prices.slice().sort((a,b) => a.start - b.start);

  let selfUse;
  try{selfUse=simulateV2(slots,{})}
  catch(error){
   lastPlan=[];renderEmpty();
   $('priceStatus').textContent='Charging simulation unavailable: '+error.message;
   return;
  }
  if(selfUse.gridConflict){
   lastPlan=[];renderEmpty();
   $('priceStatus').textContent=
    'SIMULATED GRID CONFLICT: supplied EV and estimated household demand exceed the provisional import ceiling. EV intervals have not been reduced or moved.';
   return;
  }
  let baseline=selfUse;
  const eff=Math.max(.5,Math.min(1,settings.efficiency/100));
  try {
    const result=window.FoxScheduleCore.solve(
     dispatchConfigV420(),slots.map(x=>dispatchSlotV420(x.start,x.rate))
    );
    if(result.ok&&result.valid&&result.reached19){
      const requests=Object.fromEntries(
        result.steps.map((x,i)=>[i,x.forced])
      );
      const trial=simulateV2(slots,requests,result.steps.map(x=>x.chargeGrid));
      if(trial.valid&&
          (!selfUse.valid||
           trial.financial.cost<selfUse.financial.cost-.0001)){
        baseline=trial;
      }
    }
  } catch(error) {
    lastPlan=[];
    renderEmpty();
    $('priceStatus').textContent='Plan unavailable: '+error.message;
    return;
  }

  lastPlan = baseline.output;
  render();
  renderFinancialComparison(selfUse,baseline);

  const status = document.getElementById("priceStatus");
  if (status) {
    const source = priceSource === "live" ?
      "LIVE OCTOPUS" : "SAMPLE DATA";
    const note = !baseline.reached19 ?
      " · 19:00 checkpoint not yet available: forced exports withheld" :
      !baseline.valid ?
      " · WARNING: forecast household usage may breach 20% at 19:00" :
      " · 19:00 target checked";
    status.textContent = source + " · " +
      slots.length + " half-hours" + note +
      (typeof solarForecastActive !== 'undefined' && !solarForecastActive ?
        " · Estimated solar curve" : "");
  }
}

function renderFinancialComparison(base,opt){
 let panel=document.getElementById('financialComparison');
 if(!panel){
  panel=document.createElement('section');
  panel.id='financialComparison';
  panel.className='panel';
  panel.innerHTML=`
<h3>Estimated benefit compared with self-use</h3>
<label>Assumed wear (p per battery kWh discharged)
<input id="financialWear" type="number" min="0" max="100" step="0.5">
</label>
<div id="financialResult" aria-live="polite"></div>
<p class="note">Available-price horizon only, plus an assumed refill
to 100% at the entered cheap rate. Charging costs within the horizon
are already included; only the remaining shortfall is added.
Both strategies start with the same manual SOC. Outside-horizon
household use, EV charging feasibility, standing charges are excluded. This is a planning estimate, not
measured profit. Wear is an optional sensitivity assumption and
defaults to zero.</p>`;
  document.querySelector('.metrics')
   .insertAdjacentElement('afterend',panel);
  const input=panel.querySelector('input');
  input.value=financialWearP;
  input.addEventListener('change',()=>{
   if(!input.value.trim()||!input.checkValidity())return;
   financialWearP=Number(input.value);
   try{
    localStorage.setItem('fox-wear-p',String(financialWearP));
   }catch{}
   plan();
  });
 }
 const f=window.FoxFinanceCore.compare(base,opt,{
  capacity:settings.capacity,
  eff:Math.max(.5,Math.min(1,settings.efficiency/100)),
  refillP:settings.cheapImport,wearP:financialWearP
 });
 const money=x=>'£'+x.toFixed(2);
 document.getElementById('financialResult').textContent=
  'Gross export revenue, all modelled solar + battery: '+
  money(f.opt.revenue)+
  '. Import cost within horizon: '+money(f.opt.importCost)+
  '. Remaining assumed refill: '+money(f.opt.refillCost)+
  '. Improvement before additional wear: '+money(f.gross)+
  '. Additional assumed wear: '+money(f.wearCost)+
  '. Estimated improvement after additional wear: '+money(f.net)+
  (!opt.reached19?' — 19:00 checkpoint unavailable.':
   !opt.valid?' — WARNING: reserve forecast fails.':'');
}


// Project the selected plan to 23:30. Unpriced tail: self-use only.
// Never invent export prices or forced exports beyond published coverage.
function overnightSocV350(now, cutoff) {
  const unavailable=reason=>({available:false,reason});
  const boundary=Math.ceil(now/1800000)*1800000;
  if(!Number.isFinite(cutoff)||cutoff<boundary)
    return unavailable('23:30 has passed; entered SOC is a manual night-start scenario');
  if(!lastPlan.length)
    return unavailable('No valid daytime plan');
  if(priceSource==='live'&&!forecastFreshV320(v4LastPriceCheck,now))
    return unavailable('Price plan is stale');
  const slots=lastPlan.filter(x=>x.start<cutoff);
  let cursor=boundary;
  let energy=settings.capacity*settings.soc/100;
  const cap=settings.capacity;
  const eff=Math.max(.5,Math.min(1,settings.efficiency/100));
  if(!Number.isFinite(cap)||cap<=0)
    return unavailable('Invalid battery capacity');
  for(const x of slots){
    if(x.start!==cursor||!Number.isFinite(x.socEnd)||
       x.socEnd<0||x.socEnd>100)
      return unavailable('Daytime plan has gaps or invalid SOC');
    energy=cap*x.socEnd/100;
    cursor+=1800000;
  }
  let tailSlots=0;
  while(cursor<cutoff){
    if(cursor+1800000>cutoff)
      return unavailable('Unaligned overnight boundary');
    try{
      // No invented export price or economic extra charging in the tail.
      const slot={...dispatchSlotV420(cursor,0),allowExport:false};
      const result=window.FoxScheduleCore.replay(
        {...dispatchConfigV420(),initial:energy},[slot],[],[0]
      );
      if(result.gridConflict)
        return unavailable('Supplied EV and estimated household demand exceed the grid ceiling in the forecast extension');
      energy=result.end;
    }catch(error){
      return unavailable('Charging forecast extension unavailable: '+error.message);
    }
    cursor+=1800000;
    tailSlots++;
  }
  return {
    available:true,soc:100*energy/cap,at:cutoff,tailSlots,
    source:priceSource==='sample'?'SAMPLE daytime plan':'Published-price daytime plan'
  };
}
window.foxOvernightSocV350=function(cutoff){
  return overnightSocV350(Date.now(),cutoff);
};


// Expose complete next-day research inputs without inventing prices.
window.foxTargetInputsV360=function(night){
 const now=Date.now();
 if(priceSource!=='live'||!forecastFreshV320(v4LastPriceCheck,now))
  return {available:false,reason:'Fresh published next-day prices required'};
 if(!solarForecastActive||!forecastFreshV320(v4LastSolarCheck,now))
  return {available:false,reason:'Fresh weather forecast required for target comparison'};
 const finish=window.FoxOvernightCore.eventAt(night.end,'23:00');
 const rates=new Map();
 for(const p of prices){
  if(rates.has(p.start))
   return {available:false,reason:'Duplicate price intervals'};
  rates.set(p.start,p.rate);
 }
 const slots=[];
 for(let t=night.end;t<finish;t+=1800000){
  const rate=rates.get(t);
  const key=Math.floor(t/3600000)*3600000;
  if(!Number.isFinite(rate))
   return {available:false,reason:'Waiting for published export prices: first missing interval '+
    date(t)+' '+time(t)+' Europe/London. Complete coverage through 23:00 is required'};
  if(!solarForecastHours.has(key))
   return {available:false,reason:'Weather forecast coverage missing for '+
    date(t)+' '+time(t)+' Europe/London. Reload the solar forecast'};
  slots.push(dispatchSlotV420(t,rate));
 }
 const cap=settings.capacity;
 return {available:true,slots,config:{
  capacity:cap,eff:Math.max(.5,Math.min(1,settings.efficiency/100)),
  min:cap*.05,target:cap*.20,forcedFloor:cap*.20,
  chargeKW:V2.estimatedChargeKw,dischargeKW:V2.batteryDischargeKw,
  exportKW:V2.gridExportLimitKw,
  refillP:settings.cheapImport,wearP:financialWearP
 }};
};

function renderForecastSocV330(slots) {
  let panel = document.getElementById('forecastSocPanel');
  if (!slots.length) {
    if (panel) panel.replaceChildren(Object.assign(
      document.createElement('p'),
      {textContent:'Forecast SOC unavailable — load valid future prices.'}
    ));
    return;
  }
  if (!panel) {
    const anchor = document.getElementById('priceChart');
    if (!anchor) return;
    panel = document.createElement('section');
    panel.id = 'forecastSocPanel';
    panel.style.cssText =
      'margin:16px 0;padding:18px;border:1px solid #334765;' +
      'border-radius:16px;background:#121e32;color:#fff';
    anchor.insertAdjacentElement('afterend', panel);
  }
  const make = (tag, text) => Object.assign(
    document.createElement(tag), {textContent:text}
  );
  const heading = make('h2', 'Forecast battery SOC');
  const note = make('p',
    'SIMULATED · Starting assumption: ' + settings.soc +
    '% at ' + date(slots[0].start) + ' ' + time(slots[0].start) +
    '. Uses estimated solar and household demand; no live battery readings. ' +
    'Times are Europe/London. Each row shows SOC at the END of that half-hour.'
  );
  note.style.cssText='color:#aabbd4;line-height:1.5';
  const checkpoints = slots.filter(x =>
    hour(x.start + 1800000) === 19 && mins(x.start + 1800000) === 0
  );
  const summary = document.createElement('div');
  if (!checkpoints.length) {
    summary.append(make('p',
      '19:00 prediction unavailable within the current price coverage.'
    ));
  }
  for (const x of checkpoints) {
    const meets = x.socEnd >= 20 - 1e-7;
    const line = make('p',
      date(x.start + 1800000) + ' 19:00: ' +
      x.socEnd.toFixed(2) + '% predicted · Target ≥20% · ' +
      (meets ? 'Target met in simulation' : 'WARNING: below target')
    );
    line.style.cssText =
      'font-weight:700;color:' + (meets ? '#5be0b4' : '#ffb86b');
    summary.append(line);
  }
  const scroll = document.createElement('div');
  scroll.style.cssText='overflow:auto;max-height:380px';
  const table = document.createElement('table');
  table.style.cssText='width:100%;border-collapse:collapse;text-align:left';
  const head = document.createElement('thead');
  const header = document.createElement('tr');
  for (const text of ['End time (UK)', 'Predicted SOC', 'Checkpoint']) {
    const cell = make('th', text);
    cell.style.cssText='padding:10px 8px;border-bottom:1px solid #506480';
    header.append(cell);
  }
  head.append(header);
  const body = document.createElement('tbody');
  for (const x of slots) {
    const end = x.start + 1800000;
    const checkpoint = hour(end) === 19 && mins(end) === 0;
    const row = document.createElement('tr');
    const label = checkpoint ?
      (x.socEnd >= 20 - 1e-7 ? '19:00 target met' : '19:00 BELOW TARGET') :
      (x.socEnd < 5 - 1e-7 ? 'BELOW 5% MINIMUM' : '');
    for (const text of [
      date(end) + ' ' + time(end),
      x.socEnd.toFixed(2) + '%',
      label
    ]) {
      const cell = make('td', text);
      cell.style.cssText='padding:9px 8px;border-bottom:1px solid #263850';
      row.append(cell);
    }
    if (checkpoint) row.style.cssText='background:#24344b;font-weight:700';
    body.append(row);
  }
  table.append(head, body);
  scroll.append(table);
  panel.replaceChildren(heading, note, summary, scroll);
}

function renderEmpty(){renderForecastSocV330([]);const f=document.getElementById('financialResult');if(f)f.textContent='No price data loaded; financial comparison unavailable.';$('schedule').textContent='No prices loaded. Tap “Load live Octopus prices” or use clearly labelled sample data.';$('priceChart').getContext('2d').clearRect(0,0,1000,320);$('exportDisplay').textContent='—';$('revenueDisplay').textContent='No forecast yet';$('nextAction').textContent='Waiting';$('nextActionTime').textContent='Load prices to begin';$('socDisplay').textContent=`${settings.soc}%`;$('batteryKwh').textContent=`${(settings.capacity*settings.soc/100).toFixed(1)} kWh estimated`;$('reserveDisplay').textContent=`20% at 19:00 · 5% evening minimum`}
function render(){renderForecastSocV330(lastPlan);const exportKwh=lastPlan.reduce((a,x)=>a+(x.action==='Export'?x.kwh:0),0);const revenue=lastPlan.reduce((a,x)=>a+(x.action==='Export'?x.kwh*Math.max(0,x.rate):0),0);$('socDisplay').textContent=`${settings.soc}%`;$('batteryKwh').textContent=`${(settings.capacity*settings.soc/100).toFixed(1)} kWh estimated`;$('reserveDisplay').textContent=`20% at 19:00 · 5% evening minimum`;$('exportDisplay').textContent=`${exportKwh.toFixed(2)} kWh`;$('revenueDisplay').textContent=`${formatMoney(revenue)} gross export revenue`;
const next=lastPlan.find(x=>x.action==='Export');$('nextAction').textContent=next?next.action:'Hold battery';$('nextActionTime').textContent=next?`${date(next.start)} ${time(next.start)}`:'No financially attractive export slots';$('chartNote').textContent=priceSource==='live'?'Live Octopus public rates · future half-hours only.':'SAMPLE PRICES — synthetic data, not actual Octopus rates.';
$('schedule').replaceChildren(...lastPlan.map(x=>{const el=document.createElement('div');el.className=`slot ${x.action==='Export'?'export':x.action==='Cheap charge'?'charge':''}`;const t=document.createElement('span');t.className='time';t.textContent=`${date(x.start)} ${time(x.start)}`;const a=document.createElement('b');a.textContent=x.action==='Export'?`Export ${x.kwh.toFixed(2)} kWh`:x.action==='Cheap charge'?`Charge ${x.kwh.toFixed(2)} kWh`:'Hold / self-use';const p=document.createElement('span');p.className='price';p.textContent=`${x.rate.toFixed(1)}p`;el.append(t,a,p);return el}));drawChart()}
function drawChart(){const canvas=$('priceChart'),ctx=canvas.getContext('2d');const W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);if(!lastPlan.length)return;const data=lastPlan.slice(0,64);const vals=data.map(x=>x.rate);const min=Math.min(0,...vals),max=Math.max(10,...vals);const left=45,right=15,top=15,bottom=38,chartW=W-left-right,chartH=H-top-bottom;ctx.strokeStyle='#314560';ctx.lineWidth=1;ctx.font='17px system-ui';ctx.fillStyle='#9bb0ce';for(let i=0;i<=4;i++){const y=top+chartH*i/4;ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(W-right,y);ctx.stroke();ctx.fillText((max-(max-min)*i/4).toFixed(0),5,y+5)}const barW=chartW/data.length;data.forEach((x,i)=>{const y=top+chartH*(max-x.rate)/(max-min);const zero=top+chartH*max/(max-min);ctx.fillStyle=x.action==='Export'?'#5be0b4':'#6486d8';ctx.fillRect(left+i*barW+1,Math.min(y,zero),Math.max(2,barW-2),Math.max(1,Math.abs(zero-y)));if(i%Math.max(1,Math.ceil(data.length/8))===0){ctx.fillStyle='#9bb0ce';ctx.font='15px system-ui';ctx.fillText(time(x.start),left+i*barW,H-9)}})}
function samplePrices(){const now=Date.now(),start=Math.ceil(now/1800000)*1800000;prices=Array.from({length:48},(_,i)=>{const t=start+i*1800000,h=hour(t);const rate= h>=17&&h<19?35+(h===17?8:0):h>=16&&h<21?24:h>=0&&h<6?5:12;return{start:t,rate}});priceSource='sample';$('priceStatus').textContent='SAMPLE MODE · No live rates';plan()}
async function loadLive(){if(!readSettings())return;const tariff=settings.tariff;const match=tariff.match(/^[A-Z]-1R-(.+)-[A-Z]$/);if(!match){$('priceStatus').textContent='Invalid tariff code format. Check your Octopus export tariff.';return}const product=match[1];const start=new Date(Math.ceil(Date.now()/1800000)*1800000).toISOString();const end=new Date(Date.now()+48*3600000).toISOString();const url=`https://api.octopus.energy/v1/products/${encodeURIComponent(product)}/electricity-tariffs/${encodeURIComponent(tariff)}/standard-unit-rates/?period_from=${encodeURIComponent(start)}&period_to=${encodeURIComponent(end)}&page_size=250`;$('priceStatus').textContent='Loading public Octopus rates…';try{const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),60000);let response;try{response=await fetch(url,{signal:controller.signal})}finally{clearTimeout(timer)}if(!response.ok)throw Error(`Octopus returned HTTP ${response.status}`);const data=await response.json();if(!Array.isArray(data.results))throw Error('Unexpected Octopus response');const found=data.results.filter(x=>x.valid_from&&Number.isFinite(Number(x.value_inc_vat))&&Date.parse(x.valid_from)>=Math.ceil(Date.now()/1800000)*1800000).map(x=>({start:Date.parse(x.valid_from),rate:Number(x.value_inc_vat)})).sort((a,b)=>a.start-b.start);if(!found.length)throw Error('No future published half-hour rates');prices=found;priceSource='live';v4LastPriceCheck=Date.now();v4UpdateRefreshStatus();$('priceStatus').textContent=`LIVE OCTOPUS · ${prices.length} published half-hours`;plan();globalThis.window?.foxSolarAwareRefreshV08?.()}catch(e){plan();$('priceStatus').textContent+=` · Price refresh failed: ${e.message}. Last successful-load time retained.`}}
function downloadCSV(){if(!lastPlan.length)return;const lines=['UK date,UK time,Export rate p/kWh,Recommended action,Estimated energy kWh,Data source',...lastPlan.map(x=>`${date(x.start)},${time(x.start)},${x.rate.toFixed(3)},${x.action},${x.kwh.toFixed(3)},${priceSource}`)];const url=URL.createObjectURL(new Blob([lines.join('\n')],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='fox-optimiser-plan.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)}
$('settings').addEventListener('input',()=>{if(readSettings())plan()});$('refreshBtn').addEventListener('click',loadLive);$('liveBtn').addEventListener('click',loadLive);$('sampleBtn').addEventListener('click',samplePrices);$('downloadBtn').addEventListener('click',downloadCSV);$('resetBtn').addEventListener('click',()=>{settings={...DEFAULTS};inputSettings();localStorage.setItem('fox-settings',JSON.stringify(settings));prices=[];priceSource='none';renderEmpty();loadLive()});inputSettings();renderEmpty();loadLive();

(function() {
  const reserveInput = document.querySelector('[name="reserve"]');
  if (reserveInput) {
    reserveInput.value = 20;
    reserveInput.disabled = true;
    reserveInput.title = 'Fixed 20% SOC target at 19:00';
    const label = reserveInput.closest('label');
    if (label) {
      for (const node of label.childNodes) {
        if (node.nodeType === 3 && node.textContent.trim()) {
          node.textContent = '19:00 SOC target (%) ';
          break;
        }
      }
    }
  }
})();


// FOX OPTIMISER V0.4 FOUNDATION
// Read-only simulation. No inverter commands.

const V4 = {
  learningDaysRequired: 28,
  refreshIntervalMs: 15 * 60 * 1000
};

let v4LastPriceCheck = null;
let v4LastSolarCheck = null;
let v4RefreshBusy = false;
let v4CalendarMonth = new Date();
v4CalendarMonth.setDate(1);

function v4BuildDashboard() {
  if (document.getElementById("v4Learning")) return;

  const metrics = document.querySelector(".metrics");
  if (!metrics) return;

  const learning = document.createElement("section");
  learning.className = "panel";
  learning.id = "v4Learning";

  learning.innerHTML = `
    <h3>Intelligent overnight charging</h3>
    <p style="font-size:1.6rem;font-weight:700">
      Overnight target: 100%
    </p>
    <p class="note">
      Initial 28-day measured learning period.
      The countdown has not started because live
      battery and household data logging is not
      connected yet.
    </p>
    <p class="note">
      During learning, the recommended overnight
      target remains 100% between 23:30 and 05:30.
      EV charging is assumed to take place only
      during this cheap import window.
    </p>
    <p id="v4RefreshStatus" class="note">
      Automatic forecast refresh enabled.
    </p>
    <p class="note">
      No commands are sent to your battery.
      Uses the entered import tariff and published export rates.
    </p>
  `;

  metrics.insertAdjacentElement("afterend", learning);

  const calendar = document.createElement("section");
  calendar.className = "panel";
  calendar.id = "v4Calendar";

  calendar.innerHTML = `
    <h3>Savings & Earnings Calendar</h3>
    <p class="note">
      Actual financial results will appear when
      verified energy measurements are available.
    </p>

    <div style="display:flex;gap:12px;
                align-items:center;margin:16px 0">
      <button type="button" class="secondary"
        id="v4PreviousMonth">‹</button>
      <strong id="v4MonthLabel"
        style="flex:1;text-align:center"></strong>
      <button type="button" class="secondary"
        id="v4NextMonth">›</button>
    </div>

    <div id="v4CalendarGrid"
      style="display:grid;
             grid-template-columns:repeat(7,minmax(0,1fr));
             gap:4px"></div>

    <p class="note" style="margin-top:14px">
      Export earned: awaiting data
    </p>
    <p class="note">
      Household import savings: awaiting data
    </p>
    <p class="note">
      Battery charging cost: awaiting data
    </p>
    <p class="note">
      Net battery benefit: awaiting data
    </p>
    <p class="note">
      Battery installation cost: £4,800.
      Payback tracking will begin when measured
      financial results are available.
    </p>
  `;

  const schedule = document.getElementById("schedule");
  const schedulePanel = schedule?.closest("section");

  if (schedulePanel) {
    schedulePanel.insertAdjacentElement(
      "afterend", calendar
    );
  } else {
    document.querySelector("main").append(calendar);
  }

  document.getElementById("v4PreviousMonth")
    .addEventListener("click", () => {
      v4CalendarMonth.setMonth(
        v4CalendarMonth.getMonth() - 1
      );
      v4RenderCalendar();
    });

  document.getElementById("v4NextMonth")
    .addEventListener("click", () => {
      v4CalendarMonth.setMonth(
        v4CalendarMonth.getMonth() + 1
      );
      v4RenderCalendar();
    });

  v4RenderCalendar();
  v4UpdateRefreshStatus();
}

function v4RenderCalendar() {
  const grid = document.getElementById(
    "v4CalendarGrid"
  );
  if (!grid) return;

  const year = v4CalendarMonth.getFullYear();
  const month = v4CalendarMonth.getMonth();

  document.getElementById("v4MonthLabel")
    .textContent =
      v4CalendarMonth.toLocaleDateString("en-GB", {
        month: "long",
        year: "numeric"
      });

  grid.replaceChildren();

  for (const label of [
    "M","T","W","T","F","S","S"
  ]) {
    const cell = document.createElement("div");
    cell.textContent = label;
    cell.style.cssText =
      "text-align:center;font-size:12px;" +
      "opacity:.7;padding:6px 0";
    grid.append(cell);
  }

  const firstDay =
    (new Date(year, month, 1).getDay() + 6) % 7;

  const days = new Date(
    year, month + 1, 0
  ).getDate();

  for (let i = 0; i < firstDay; i++) {
    grid.append(document.createElement("div"));
  }

  for (let day = 1; day <= days; day++) {
    const cell = document.createElement("div");
    cell.style.cssText =
      "min-height:45px;border:1px solid #334765;" +
      "border-radius:7px;text-align:center;" +
      "padding:5px 1px;font-size:12px";

    const number = document.createElement("div");
    number.textContent = String(day);

    const amount = document.createElement("div");
    amount.textContent = "—";
    amount.style.cssText =
      "font-size:11px;opacity:.65;margin-top:4px";

    cell.append(number, amount);
    cell.title =
      "Awaiting measured battery financial data";

    grid.append(cell);
  }
}

function v4UpdateRefreshStatus() {
  const el = document.getElementById(
    "v4RefreshStatus"
  );
  if (!el) return;

  const display = t => t
    ? new Date(t).toLocaleString("en-GB")
    : "no successful load yet";

  el.textContent =
    "Automatic updates every 15 minutes while " +
    "the app is open. Last successful price load: " +
    display(v4LastPriceCheck) +
    ". Last successful solar load: " +
    display(v4LastSolarCheck) + ".";
}

async function v4Refresh() {
  if (v4RefreshBusy ||
      document.visibilityState !== "visible") {
    return;
  }

  v4RefreshBusy = true;

  try {
    const lat = localStorage.getItem(
      "fox-solar-lat"
    );
    const lon = localStorage.getItem(
      "fox-solar-lon"
    );

    if (lat !== null && lon !== null) {
      await loadSolarForecastV3();

    }

    await loadLive();


  } catch (error) {
    console.warn("Automatic refresh:", error);
  } finally {
    v4RefreshBusy = false;
    v4UpdateRefreshStatus();
  }
}

v4BuildDashboard();

setInterval(
  v4Refresh,
  V4.refreshIntervalMs
);

document.addEventListener(
  "visibilitychange",
  () => {
    if (document.visibilityState === "visible") {
      v4Refresh();
    }
  }
);


// FOX EXPORT POWER CLARITY V1
// 3.5 kW is the maximum instantaneous NET grid
// export power. It is not a daily kWh limit.
//
// 30 minutes at 3.5 kW = 1.75 kWh.
// 1 hour at 3.5 kW = 3.5 kWh.
// Multiple export periods accumulate without
// any artificial daily energy cap.
//
// Respect a lower configured export power,
// but never exceed the 3.5 kW planning ceiling.
//
// Physical DNO compliance remains the
// responsibility of the inverter configuration.

Object.defineProperty(
  V2,
  "gridExportLimitKw",
  {
    configurable: true,
    enumerable: true,
    get() {
      const requested = Number(settings.exportKw);

      if (!Number.isFinite(requested)) {
        return 3.5;
      }

      return Math.max(
        0,
        Math.min(3.5, requested)
      );
    }
  }
);


// Recheck expiry without waiting for a network request to finish.
setInterval(() => {
  if (document.visibilityState === 'visible') plan();
}, 60000);
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') plan();
});
