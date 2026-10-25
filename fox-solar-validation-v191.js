(()=>{
'use strict';
const ID='foxDayOptimizerV18';
const el=(t,s)=>{const x=document.createElement(t);if(s!==undefined)x.textContent=s;return x};
const fmt=x=>Number(x).toFixed(2);
const parts=d=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));
const localDate=d=>{const p=parts(d);return p.year+'-'+p.month+'-'+p.day};
const key=d=>{const p=parts(d);return p.year+'-'+p.month+'-'+p.day+' '+p.hour+':'+p.minute};
function slotsFor(date){const start=new Date(date+'T00:00:00Z').getTime()-86400000;const out=[];for(let t=start;t<start+72*3600000;t+=1800000){const d=new Date(t),p=parts(d);if(p.year+'-'+p.month+'-'+p.day!==date)continue;const h=+p.hour+(+p.minute)/60;if(h>=5.5&&h<23.5)out.push({at:d,clock:h,key:key(d)})}return out}
function init(){if(document.getElementById(ID))return;const main=document.querySelector('main');if(!main)return;
const box=el('section');box.id=ID;box.className='panel';box.style.cssText='margin:18px 0;padding:18px;border:1px solid #5278aa;border-radius:14px';box.append(el('h3','Solar forecast validation · v1.9.1'));
const info=el('p','READ-ONLY forecast scenario, not real Fox or home data. Uses an Open-Meteo hourly tilted-panel irradiance forecast and manually estimated household use. Outgoing Agile prices are optional. No inverter commands. Forecasts for elapsed hours are not historical meter readings.');info.className='note';box.append(info);
const form=el('div');form.style.cssText='display:flex;gap:10px;flex-wrap:wrap';const f={};
for(const [k,label,val,min,max] of [['soc','SOC at 05:30 (%)',100,5,100],['capacity','EVO10 nominal capacity (kWh)',10.24,1,100],['min','Minimum SOC (%)',5,0,50],['target','19:00 target SOC (%)',20,5,100],['solar','Manual fallback solar 05:30–19:00 (kWh)',5,0,40],['load','Baseline household demand (kW)',0.3,0,10],['eff','Charge/discharge efficiency (%)',95,1,100],['maxcharge','Max battery charge (kW)',5,0,20],['maxdischarge','Max battery discharge (kW)',5,0,20],['export','Net export limit (kW)',3.5,0,20],['import','Avoided import price (p/kWh)',28,0,100],['night','Overnight import (p/kWh)',3.33,0,100],['pv','Installed solar DC (kWp)',2.01,0.1,20],['solarmac','Solar inverter AC cap (kW)',1.5,0.1,20],['pr','PV performance ratio (%)',82,20,100],['tilt','Panel tilt (degrees)',35,0,90],['bearing','Roof-facing bearing from map (degrees clockwise from north)',110,0,360],['derate','Solar forecast uncertainty reduction (%)',20,0,90]]){
const l=el('label',label);l.style.cssText='display:flex;flex-direction:column;gap:4px;font-size:12px';const i=el('input');i.type='number';i.min=min;i.max=max;i.step='.01';i.value=val;i.style.cssText='width:140px;padding:8px';l.append(i);form.append(l);f[k]=i}box.append(form);
const weatherRow=el('div');weatherRow.style.cssText='display:flex;gap:12px;flex-wrap:wrap;align-items:end;margin:12px 0';
const makeCoordinate=(name,key,min,max)=>{const l=el('label',name);l.style.cssText='display:flex;flex-direction:column;gap:4px;font-size:12px';const i=el('input');i.type='number';i.step='any';i.min=min;i.max=max;i.placeholder='Saved solar site coordinate';i.style.cssText='width:170px;padding:8px';try{i.value=localStorage.getItem(key)||''}catch(e){}l.append(i);weatherRow.append(l);return i};
const latField=makeCoordinate('Solar site latitude (exact)','fox-solar-lat',-90,90);
const lonField=makeCoordinate('Solar site longitude (exact)','fox-solar-lon',-180,180);
const dayLabel=el('label','Forecast date');dayLabel.style.cssText='display:flex;flex-direction:column;gap:4px;font-size:12px';
const dayMode=el('select');for(const [v,name] of [['tomorrow','Tomorrow · full-day plan'],['today','Today · includes elapsed hours']]){const o=el('option',name);o.value=v;dayMode.append(o)}dayMode.value='tomorrow';dayLabel.append(dayMode);weatherRow.append(dayLabel);box.append(weatherRow);
const privacy=el('p','Uses solar-site coordinates saved locally by Fox Optimiser, not a postcode approximation. Coordinates are sent only when requesting a weather forecast. Your 19:00 SOC target remains exactly what you enter: no extra SOC buffer. The supplied Apple Maps screenshot shows the top of the roof facing approximately 110° (east-southeast) according to its compass. You confirmed that the solar-facing roof is towards the top of that image, so the forecast defaults to 110°. The map supports an approximate direction, not a surveyed roof angle.');privacy.className='note';box.append(privacy);
const bearingStatus=el('p','Roof direction confirmed from your Apple Maps image: approximately 110° (east-southeast), not 180° due south.');bearingStatus.style.cssText='font-weight:600;margin:8px 0';box.append(bearingStatus);
const orientationButtons=el('div');orientationButtons.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:8px 0';
const compareBearing=el('button','Optional: compare with due south');
const use110=el('button','Use map-confirmed 110°');
const use180=el('button','Override: use 180° due south');
for(const b of [compareBearing,use110,use180]){b.type='button';orientationButtons.append(b)}box.append(orientationButtons);
const bearingComparison=el('p','No orientation comparison run.');bearingComparison.style.cssText='white-space:pre-line;line-height:1.7';bearingComparison.setAttribute('aria-live','polite');box.append(bearingComparison);
try{
 // Apply the newly user-confirmed roof orientation once. Later user overrides persist.
 if(localStorage.getItem('fox-solar-bearing-map-v191')!=='confirmed'){
  localStorage.setItem('fox-solar-bearing-confirmed','110');
  localStorage.setItem('fox-solar-bearing-map-v191','confirmed');
 }
 const confirmed=localStorage.getItem('fox-solar-bearing-confirmed');
 if(confirmed==='110'||confirmed==='180'){
  f.bearing.value=confirmed;
  bearingStatus.textContent=confirmed==='110'?'Roof-facing direction confirmed from your map: approximately 110° (east-southeast). Forecast uses this orientation.':'Custom override: 180° due south. The supplied map indicates approximately 110°.';
 }
}catch(e){}
function setConfirmedBearing(deg){f.bearing.value=deg;try{localStorage.setItem('fox-solar-bearing-confirmed',String(deg))}catch(e){}bearingStatus.textContent='Panel direction confirmed as '+deg+'° in this browser. This changes the v1.9.1 forecast only, not any actual equipment.';}
use110.addEventListener('click',()=>setConfirmedBearing(110));use180.addEventListener('click',()=>setConfirmedBearing(180));
f.bearing.addEventListener('input',()=>{bearingStatus.textContent='Custom bearing entered: '+f.bearing.value+'°. Verify this against the roof; not automatically confirmed.'});
const modeLabel=el('label','Household demand scenario ');const mode=el('select');for(const [val,label] of [['low','Typical low-use day'],['wfh','Working from home / cooking'],['spike','High-use stress test']]){const op=el('option',label);op.value=val;mode.append(op)}modeLabel.append(mode);box.append(modeLabel);const solarLabel=el('label','Solar stress test (applies to forecast/manual) ');const solarMode=el('select');for(const [val,label] of [['normal','Entered solar forecast'],['cloud','Cloudy: 25% of entered solar'],['none','No solar generation']]){const op=el('option',label);op.value=val;solarMode.append(op)}solarLabel.append(solarMode);box.append(solarLabel);
const buttons=el('div');buttons.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:12px 0';
const sample=el('button','Forecast + sample Agile prices');
const published=el('button','Forecast + published Agile prices');
const manual=el('button','Manual solar fallback + sample prices');
for(const b of [sample,published,manual]){b.type='button';buttons.append(b)}box.append(buttons);
const status=el('p','No simulation run.');status.setAttribute('aria-live','polite');box.append(status);const result=el('div');result.style.cssText='white-space:pre-line;line-height:1.7';box.append(result);const table=el('div');table.style.cssText='overflow-x:auto';box.append(table);main.append(box);
function simulate(c,slots,prices,optimise){
 const quantum=.02,minimum=c.capacity*c.min/100,start=Math.min(c.capacity,Math.max(minimum,c.capacity*c.soc/100));
 const target=c.capacity*c.target/100,eff=c.eff/100,rate=c.import/100;
 const input=slots.map((s,i)=>{const h=s.clock;let extra=0;if(c.mode==='wfh')extra=(h>=12&&h<13?.25:0)+(h>=18&&h<19?.55:0);if(c.mode==='spike')extra=(h>=7.5&&h<8.5?1.2:0)+(h>=12&&h<13?1.0:0)+(h>=17.5&&h<19?1.8:0)+(h>=20&&h<21?1.2:0);return {clock:h,solar:c.solarBySlot[i],house:(c.load+extra)*.5,price:prices.get(s.key),at:s.at}});
 // Chronological approximate dynamic program; carried energy remains continuous.
 let states=new Map([[Math.round(start/quantum),{energy:start,value:0,import:0,export:0,forced:0,prev:null}]]);const history=[];
 for(let t=0;t<input.length;t++){
 const z=input[t],next=new Map();
 for(const [q,st] of states){
  const stored=st.energy,solarHouse=Math.min(z.house,z.solar),houseDeficit=z.house-solarHouse,solarSurplus=z.solar-solarHouse;
  const homeFromBattery=Math.min(houseDeficit,c.maxdischarge*.5*eff,Math.max(0,(stored-minimum)*eff));
  const houseGrid=houseDeficit-homeFromBattery;
  const afterHouse=stored-homeFromBattery/eff;
  const solarCharge=Math.min(solarSurplus*eff,c.maxcharge*.5*eff,Math.max(0,c.capacity-afterHouse));
  const afterSolar=afterHouse+solarCharge;
  const naturalExport=Math.min(c.export*.5,Math.max(0,solarSurplus-solarCharge/eff));
  const room=Math.max(0,c.export*.5-naturalExport);
  const maxForced=(optimise&&z.clock<19&&z.price!==undefined)?Math.min(room,c.maxdischarge*.5*eff,Math.max(0,(afterSolar-minimum)*eff)):0;
  const steps=Math.ceil(maxForced/quantum);
  for(let a=0;a<=steps;a++){
   const forced=Math.min(maxForced,a*quantum),after=afterSolar-forced/eff;
   if(z.clock===18.5&&after+1e-8<target)continue;
   const nq=Math.round(after/quantum);
   // SOC buckets only merge candidate paths; physical stored energy remains continuous.
   const earned=(naturalExport+forced)*(z.price||0)/100;
   const value=st.value+earned-houseGrid*rate;
   const prev=next.get(nq);
   if(!prev||value>prev.value){next.set(nq,{energy:after,value,import:st.import+houseGrid,export:st.export+naturalExport+forced,forced:st.forced+forced,prev:q,step:{...z,soc:after,forced,naturalExport,grid:houseGrid,solarCharge,homeFromBattery,solarToHome:solarHouse,solarSurplus,storedBefore:stored,storedAfterRaw:after}})}
  }
 }
 if(!next.size)return {ok:false,reason:'The 19:00 SOC target cannot be reached with this solar forecast, starting SOC and household demand. No export plan can satisfy it.'};
 history.push(next);states=next;
 }
 let best=null,bq=null;for(const [q,s] of states)if(!best||s.value+s.energy*c.night/100>best.value+best.energy*c.night/100){best=s;bq=q}
 const steps=[];for(let t=history.length-1;t>=0;t--){const st=history[t].get(bq);steps.push(st.step);bq=st.prev}steps.reverse();
 return {ok:true,...best,steps,at19:steps.find(x=>x.clock===18.5)?.soc||0,end:steps.at(-1)?.soc||0};
}
const total=xs=>xs.reduce((a,b)=>a+b,0);
const getJSON=async(url,label)=>{const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let response;try{response=await fetch(url,{signal:controller.signal,cache:'no-store'});}catch(e){throw Error(label+' request blocked/offline: '+e.message)}finally{clearTimeout(timeout)}if(!response.ok)throw Error(label+' HTTP '+response.status);return response.json()};
function manualProfile(slots,c){const shape=slots.map(s=>s.clock>=6&&s.clock<19?Math.max(0,Math.sin(Math.PI*(s.clock-6)/13)):0);const sum=total(shape);return shape.map(v=>(sum?c.solar*v/sum:0)*(1-c.derate/100));}
async function weatherProfile(slots,c){
 const latitudeText=latField.value.trim(),longitudeText=lonField.value.trim();
 if(latitudeText===''||longitudeText==='')throw Error('Solar installation coordinates are missing. The app looks for saved fox-solar-lat and fox-solar-lon values; enter exact coordinates if they are not available in this browser.');
 const lat=Number(latitudeText),lon=Number(longitudeText);
 if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat< -90||lat>90||lon< -180||lon>180)throw Error('Enter valid solar-site latitude and longitude.');
 try{localStorage.setItem('fox-solar-lat',latitudeText);localStorage.setItem('fox-solar-lon',longitudeText)}catch(e){}
 // Open-Meteo azimuth convention: 0 south, -90 east, +90 west.
 const bearing=c.bearing-180;
 const u=new URL('https://api.open-meteo.com/v1/forecast');
 for(const [k,v] of Object.entries({latitude:latitudeText,longitude:longitudeText,hourly:'global_tilted_irradiance',tilt:c.tilt,azimuth:bearing,timezone:'UTC',timeformat:'unixtime',forecast_days:3,past_days:1}))u.searchParams.set(k,v);
 const json=await getJSON(u.toString(),'Open-Meteo solar forecast');
 const ts=json?.hourly?.time,values=json?.hourly?.global_tilted_irradiance;
 if(!Array.isArray(ts)||!Array.isArray(values)||ts.length!==values.length||!ts.length)throw Error('Open-Meteo returned no hourly global tilted irradiance; manual fallback is available.');
 const samples=new Map(ts.map((t,i)=>[Number(t)*1000,values[i]]));
 const powers=slots.map(s=>{
  // Hourly radiation at t is the mean over (t-1h,t]. Map each half-hour by its END time.
  const end=s.at.getTime()+1800000,hourEnd=Math.ceil(end/3600000)*3600000;
  const ghi=samples.get(hourEnd);
  if(ghi===null||!Number.isFinite(Number(ghi)))return null;
  return Math.min(c.solarmac,Math.max(0,Number(ghi))/1000*c.pv*c.pr/100)*.5;
 });
 if(powers.some(v=>v===null))throw Error('Open-Meteo forecast has missing hourly intervals; refusing to invent solar measurements. Use manual fallback.');
 return {values:powers.map(v=>v*(1-c.derate/100)),raw:powers,latitude:latitudeText,longitude:longitudeText};
}
async function run(live,useManual){sample.disabled=published.disabled=manual.disabled=true;status.textContent='Loading solar forecast and preparing simulation…';try{
const c=Object.fromEntries(Object.entries(f).map(([k,x])=>[k,Number(x.value)]));c.mode=mode.value;c.solarMode=solarMode.value;if(Object.entries(c).filter(([k])=>k!=='mode'&&k!=='solarMode').some(([,x])=>!Number.isFinite(x)||x<0)||c.soc>100||c.min>=c.target||c.target>100||c.eff>100||c.eff<=0||c.maxdischarge<=0||c.maxcharge<=0||c.capacity<=0||c.pr>100||c.derate>=100||c.tilt>90||c.bearing>360||c.pv<=0||c.solarmac<=0)throw Error('Check SOC target, PV installation, efficiency and power inputs.');
const now=new Date();let day=localDate(now);if(dayMode.value==='tomorrow')day=localDate(new Date(new Date(day+'T12:00:00Z').getTime()+86400000));const slots=slotsFor(day);if(slots.length!==36)throw Error('Expected 36 daytime half-hour slots; found '+slots.length+'.');
let weatherText='';
if(useManual){c.solarBySlot=manualProfile(slots,c);weatherText='MANUAL SOLAR FALLBACK · hypothetical daylight curve, not fetched';}
else{const w=await weatherProfile(slots,c);c.solarBySlot=w.values;weatherText='OPEN-METEO FORECAST for your exact saved solar-site coordinates · '+fmt(total(w.raw))+' kWh before safety reduction';}
const solarStress=c.solarMode==='cloud'?.25:c.solarMode==='none'?0:1;c.solarBySlot=c.solarBySlot.map(x=>x*solarStress);const prices=new Map();let source='SAMPLE PRICES (invented, not live)';
if(live){const tariff='E-1R-AGILE-OUTGOING-19-05-13-E',product='AGILE-OUTGOING-19-05-13';const url='https://api.octopus.energy/v1/products/'+product+'/electricity-tariffs/'+tariff+'/standard-unit-rates/?period_from='+encodeURIComponent(slots[0].at.toISOString())+'&period_to='+encodeURIComponent(new Date(slots.at(-1).at.getTime()+1800000).toISOString())+'&page_size=250';const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),16000);let response;try{response=await fetch(url,{signal:controller.signal})}finally{clearTimeout(timeout)}if(!response.ok)throw Error('Octopus price request HTTP '+response.status);const json=await response.json();for(const r of json.results||[])if(r.valid_from&&Number.isFinite(Number(r.value_inc_vat)))prices.set(key(new Date(r.valid_from)),Number(r.value_inc_vat));source='PUBLISHED OCTOPUS PRICES (not your tariff or bill)';}
else{for(const s of slots){const h=s.clock;prices.set(s.key,h<12?5:h<15?8:h<16?12:h<16.5?17:h<17?22:h<17.5?34:h<18?18:10)}}
if(live&&!slots.some(s=>prices.has(s.key)&&s.clock<19))throw Error('No published Agile export prices are available for that date yet. Try sample prices or select Today.');const base=simulate(c,slots,prices,false);const plan=simulate(c,slots,prices,true);if(!base.ok||!plan.ok)throw Error(plan.reason||base.reason);
const priceSlots=slots.filter(s=>prices.has(s.key)&&s.clock<19).length;
status.textContent=weatherText+' · '+source+' · '+priceSlots+' of '+slots.filter(s=>s.clock<19).length+' pre-19:00 intervals priced · '+day+'.';
const improvement=(plan.value+plan.end*c.night/100)-(base.value+base.end*c.night/100);
result.textContent='SIMULATION ONLY · '+slots.length+' chronological half-hours (05:30–23:30)\n'+
'Fox ESS EVO10 nominal capacity: '+fmt(c.capacity)+' kWh; minimum SOC: '+fmt(c.min)+'%\n'+
'Weather-adjusted solar: '+fmt(total(c.solarBySlot))+' kWh over 05:30–23:30 (includes '+fmt(c.derate)+'% forecast reduction; solar stress: '+c.solarMode+'); baseline home load: '+fmt(c.load)+' kW ('+c.mode+')\n'+
'19:00 protected target: '+fmt(c.target)+'% (no added buffer) · predicted: '+fmt(plan.at19/c.capacity*100)+'%\n'+
'Predicted SOC at 23:30: '+fmt(plan.end/c.capacity*100)+'%\n'+
'Planned forced battery export: '+fmt(plan.forced)+' kWh\n'+
'Total modelled export (including natural solar): '+fmt(plan.export)+' kWh\n'+
'Grid import needed 05:30–23:30: '+fmt(plan.import)+' kWh\n'+
'Financial improvement versus NO forced battery export: £'+fmt(improvement)+' (includes end-of-day battery energy valued at overnight rate)\n'+
(improvement<=.001?'No positive-value forced export was identified under these assumptions.':'Only financially beneficial exports are selected by the optimiser.')+'\n\n'+
'LIMITS: Open-Meteo irradiance is a forecast, NOT measured generation. PV conversion assumes an editable performance ratio, solar inverter cap, azimuth and tilt; shading, clipping, weather errors and time-of-day consumption can change reality. An hourly radiation mean is split into two equal half-hours. Forecast scenarios include elapsed hours if you select Today; this is NOT a live dispatch plan. Household profiles are hypothetical, not learned. Candidate schedules use 0.02 kWh SOC buckets; battery energy is carried continuously. Bucket merging is approximate, not proof of global optimum. Missing Octopus rates are not invented as published rates; the price mapping is not yet account/tariff-verified. 3.5 kW net export is an instantaneous cap approximated by half-hours, not daily kWh. Real inverter limits, meter transients and forecast feasibility require validation. No Fox/Ohme/Home Assistant access, production learning or actual dispatch.';
const sum=k=>plan.steps.reduce((a,z)=>a+(z[k]||0),0);const solarIn=sum('solar'),houseUse=sum('house'),solarHouse=sum('solarToHome'),solarStored=sum('solarCharge'),batteryHome=sum('homeFromBattery'),gridHouse=sum('grid'),naturalExport=sum('naturalExport'),forcedExport=sum('forced'),chargeLoss=solarStored/(c.eff/100)-solarStored,dischargeLoss=(batteryHome+forcedExport)/(c.eff/100)-(batteryHome+forcedExport);const surplusUnallocated=Math.max(0,solarIn-solarHouse-solarStored/(c.eff/100)-naturalExport);const initial=c.capacity*c.soc/100,ending=plan.end;const solarBalance=solarIn-solarHouse-solarStored/(c.eff/100)-naturalExport-surplusUnallocated;const houseBalance=houseUse-solarHouse-batteryHome-gridHouse;const batteryBalance=initial+solarStored-batteryHome/(c.eff/100)-forcedExport/(c.eff/100)-ending;result.textContent+='\n\nCONTINUOUS ENERGY AUDIT (kWh; synthetic)\nSolar generated: '+fmt(solarIn)+' | solar to house: '+fmt(solarHouse)+' | solar into battery (stored): '+fmt(solarStored)+' | natural export: '+fmt(naturalExport)+' | curtailed/unused: '+fmt(surplusUnallocated)+'\nHouse demand: '+fmt(houseUse)+' | solar: '+fmt(solarHouse)+' | battery: '+fmt(batteryHome)+' | grid: '+fmt(gridHouse)+'\nBattery opening (modelled): '+fmt(initial)+' | closing: '+fmt(ending)+' | forced export: '+fmt(forcedExport)+' | charge conversion loss: '+fmt(chargeLoss)+' | discharge conversion loss: '+fmt(dischargeLoss)+'\nSolar balance residual: '+fmt(solarBalance)+' kWh | home balance residual: '+fmt(houseBalance)+' kWh | battery balance residual: '+fmt(batteryBalance)+' kWh\n';const evening=plan.steps.filter(z=>z.clock>=19);const eveningNetUse=total(evening.map(z=>Math.max(0,z.house-z.solarToHome)));const eveningNeeded=(c.capacity*c.min/100+eveningNetUse/(c.eff/100))/c.capacity*100;
result.textContent+='\n19:00 SOC advisory: Forecast household consumption through 23:30 suggests '+fmt(eveningNeeded)+'% needed at 19:00 (including '+fmt(c.min)+'% minimum SOC). Your requested '+fmt(c.target)+'% target is unchanged.\n';
if(eveningNeeded>c.target+0.01)result.textContent+='ADVISORY ONLY: Expected evening usage may require '+fmt(eveningNeeded)+'% SOC at 19:00 to avoid some grid imports. The optimiser HAS NOT raised your 20% target.\n';
if(plan.at19/c.capacity*100-c.target < 0.5)result.textContent+='LOW FORECAST MARGIN: Modelled 19:00 SOC is within 0.5 percentage points of your chosen target. A weather or usage error could cause a shortfall. This is a WARNING ONLY; the SOC target remains unchanged.\n';
if(Math.abs(solarBalance)>0.00001||Math.abs(houseBalance)>0.00001||Math.abs(batteryBalance)>0.00001)result.textContent+='WARNING: Energy audit outside tolerance; do not trust financial result.\n';if(plan.at19/c.capacity*100+0.1<c.target)result.textContent+='WARNING: 19:00 SOC target failed.\n';if(plan.end/c.capacity*100+0.1<c.min)result.textContent+='WARNING: Minimum SOC failed.\n';
const t=el('table');t.style.cssText='width:100%;border-collapse:collapse;font-size:12px';const head=el('tr');for(const h of ['UK time','Solar kWh','Home kWh','Agile p','Battery export kWh','Grid import kWh','SOC end %']){const th=el('th',h);th.style.padding='5px';head.append(th)}t.append(head);
for(const s of plan.steps){const tr=el('tr');const p=parts(s.at);for(const v of [p.hour+':'+p.minute,fmt(s.solar),fmt(s.house),s.price===undefined?'—':fmt(s.price),fmt(s.forced),fmt(s.grid),fmt(s.soc/c.capacity*100)]){const td=el('td',v);td.style.cssText='padding:5px;border-top:1px solid #52627a';tr.append(td)}t.append(tr)}table.replaceChildren(t);
}catch(e){status.textContent='Simulation unavailable: '+e.message;result.textContent='';table.replaceChildren()}finally{sample.disabled=published.disabled=manual.disabled=false}}
compareBearing.addEventListener('click',async()=>{
 compareBearing.disabled=true;bearingComparison.textContent='Loading two forecasts for your exact coordinates…';
 try{
 const c=Object.fromEntries(Object.entries(f).map(([k,x])=>[k,Number(x.value)]));
 if(!Number.isFinite(c.pv)||c.pv<=0||!Number.isFinite(c.solarmac)||c.solarmac<=0||!Number.isFinite(c.pr)||c.pr<=0||c.pr>100||c.derate<0||c.derate>=100||c.tilt<0||c.tilt>90)throw Error('Check solar installation and forecast settings.');
 let date=localDate(new Date());if(dayMode.value==='tomorrow')date=localDate(new Date(new Date(date+'T12:00:00Z').getTime()+86400000));
 const slots=slotsFor(date);if(slots.length!==36)throw Error('Unexpected half-hour slot count.');
 const [s110,s180]=await Promise.all([weatherProfile(slots,{...c,bearing:110}),weatherProfile(slots,{...c,bearing:180})]);
 const sumPeriod=(r,a,b)=>total(r.values.filter((v,i)=>slots[i].clock>=a&&slots[i].clock<b));
 const e110=total(s110.values),e180=total(s180.values),diff=e180-e110;
 bearingComparison.textContent='ORIENTATION COMPARISON · '+date+' · exact saved solar-site coordinates\n'+
 'Forecast with 110° east-southeast: '+fmt(total(s110.raw))+' kWh before weather uncertainty reduction; '+fmt(e110)+' kWh after '+fmt(c.derate)+'% reduction\n'+
 'Forecast with 180° due south: '+fmt(total(s180.raw))+' kWh before reduction; '+fmt(e180)+' kWh after reduction\n'+
 'Morning 05:30–12:00: 110° '+fmt(sumPeriod(s110,5.5,12))+' kWh · 180° '+fmt(sumPeriod(s180,5.5,12))+' kWh\n'+
 'Afternoon 12:00–19:00: 110° '+fmt(sumPeriod(s110,12,19))+' kWh · 180° '+fmt(sumPeriod(s180,12,19))+' kWh\n'+
 'Difference (south minus east-southeast): '+(diff>=0?'+':'')+fmt(diff)+' kWh\n'+
 'These are ALTERNATIVE roof orientations, not two arrays of panels. The orientation indicated by your Apple Maps screenshot is approximately 110°. This comparison is optional; use another value only if a separate physical survey confirms it. Comparing forecasts does not change the saved bearing, your 20% SOC target or any inverter setting.';
 }catch(e){bearingComparison.textContent='Comparison unavailable: '+e.message}
 finally{compareBearing.disabled=false}
});
sample.addEventListener('click',()=>run(false,false));published.addEventListener('click',()=>run(true,false));manual.addEventListener('click',()=>run(false,true));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();