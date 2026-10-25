#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/FOX-OPTIMISER
python3 - <<'PYINSTALL'
from pathlib import Path
import subprocess,datetime
html=[Path('index.html'),Path('preview-v2.html')]
if not all(p.exists() for p in html):raise SystemExit('STOP: Missing HTML entry point. No changes made.')
source=r'''(()=>{
'use strict';
const ID='foxDayOptimizerV17';
const el=(t,s)=>{const x=document.createElement(t);if(s!==undefined)x.textContent=s;return x};
const fmt=x=>Number(x).toFixed(2);
const parts=d=>Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d).map(p=>[p.type,p.value]));
const localDate=d=>{const p=parts(d);return p.year+'-'+p.month+'-'+p.day};
const key=d=>{const p=parts(d);return p.year+'-'+p.month+'-'+p.day+' '+p.hour+':'+p.minute};
function slotsFor(date){const start=new Date(date+'T00:00:00Z').getTime()-86400000;const out=[];for(let t=start;t<start+72*3600000;t+=1800000){const d=new Date(t),p=parts(d);if(p.year+'-'+p.month+'-'+p.day!==date)continue;const h=+p.hour+(+p.minute)/60;if(h>=5.5&&h<23.5)out.push({at:d,clock:h,key:key(d)})}return out}
function init(){if(document.getElementById(ID))return;const main=document.querySelector('main');if(!main)return;
const box=el('section');box.id=ID;box.className='panel';box.style.cssText='margin:18px 0;padding:18px;border:1px solid #5278aa;border-radius:14px';box.append(el('h3','Continuous energy accounting · v1.7'));
const info=el('p','READ-ONLY simulation. Uses manual/synthetic solar and household forecasts, not measured Fox or home data. Published Outgoing Agile rates are optional. Never sends inverter commands.');info.className='note';box.append(info);
const form=el('div');form.style.cssText='display:flex;gap:10px;flex-wrap:wrap';const f={};
for(const [k,label,val,min,max] of [['soc','SOC at 05:30 (%)',100,5,100],['capacity','EVO10 nominal capacity (kWh)',10.24,1,100],['min','Minimum SOC (%)',5,0,50],['target','19:00 target SOC (%)',20,5,100],['solar','Forecast solar generation 05:30–19:00 (kWh)',5,0,40],['load','Baseline household demand (kW)',0.3,0,10],['eff','Charge/discharge efficiency (%)',95,1,100],['maxcharge','Max battery charge (kW)',5,0,20],['maxdischarge','Max battery discharge (kW)',5,0,20],['export','Net export limit (kW)',3.5,0,20],['import','Avoided import price (p/kWh)',28,0,100],['night','Overnight import (p/kWh)',3.33,0,100]]){
const l=el('label',label);l.style.cssText='display:flex;flex-direction:column;gap:4px;font-size:12px';const i=el('input');i.type='number';i.min=min;i.max=max;i.step='.01';i.value=val;i.style.cssText='width:140px;padding:8px';l.append(i);form.append(l);f[k]=i}box.append(form);
const modeLabel=el('label','Household demand scenario ');const mode=el('select');for(const [val,label] of [['low','Typical low-use day'],['wfh','Working from home / cooking'],['spike','High-use stress test']]){const op=el('option',label);op.value=val;mode.append(op)}modeLabel.append(mode);box.append(modeLabel);const solarLabel=el('label','Solar scenario ');const solarMode=el('select');for(const [val,label] of [['normal','Entered solar forecast'],['cloud','Cloudy: 25% of entered solar'],['none','No solar generation']]){const op=el('option',label);op.value=val;solarMode.append(op)}solarLabel.append(solarMode);box.append(solarLabel);
const buttons=el('div');buttons.style.cssText='display:flex;gap:8px;flex-wrap:wrap;margin:12px 0';const sample=el('button','Optimise with sample Agile prices');const published=el('button','Optimise with published Agile prices');for(const b of [sample,published]){b.type='button';buttons.append(b)}box.append(buttons);
const status=el('p','No simulation run.');status.setAttribute('aria-live','polite');box.append(status);const result=el('div');result.style.cssText='white-space:pre-line;line-height:1.7';box.append(result);const table=el('div');table.style.cssText='overflow-x:auto';box.append(table);main.append(box);
function simulate(c,slots,prices,optimise){
 const quantum=.02,minimum=c.capacity*c.min/100,start=Math.min(c.capacity,Math.max(minimum,c.capacity*c.soc/100));
 const target=c.capacity*c.target/100,eff=c.eff/100,rate=c.import/100;
 const shape=slots.map(s=>s.clock>=6&&s.clock<19?Math.max(0,Math.sin(Math.PI*(s.clock-6)/13)):0);const total=shape.reduce((a,b)=>a+b,0);
 const input=slots.map((s,i)=>{const h=s.clock;let extra=0;if(c.mode==='wfh')extra=(h>=12&&h<13?.25:0)+(h>=18&&h<19?.55:0);if(c.mode==='spike')extra=(h>=7.5&&h<8.5?1.2:0)+(h>=12&&h<13?1.0:0)+(h>=17.5&&h<19?1.8:0)+(h>=20&&h<21?1.2:0);return {clock:h,solar:total?c.solar*shape[i]/total:0,house:(c.load+extra)*.5,price:prices.get(s.key),at:s.at}});
 // Full sequential dynamic program. Battery state is discretised to 0.05 kWh.
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
async function run(live){sample.disabled=published.disabled=true;status.textContent='Building sequential 30-minute simulation…';try{
const c=Object.fromEntries(Object.entries(f).map(([k,x])=>[k,Number(x.value)]));c.mode=mode.value;c.solarMode=solarMode.value;c.solar=c.solar*(c.solarMode==='cloud'?.25:c.solarMode==='none'?0:1);if(Object.entries(c).filter(([k])=>k!=='mode'&&k!=='solarMode').some(([,x])=>!Number.isFinite(x)||x<0)||c.soc>100||c.min>=c.target||c.target>100||c.eff>100||c.eff<=0||c.maxdischarge<=0||c.maxcharge<=0||c.capacity<=0)throw Error('Check SOC, battery capacity, efficiency and power inputs.');
const day=localDate(new Date());const slots=slotsFor(day);if(slots.length!==36)throw Error('Expected 36 daytime half-hour slots; found '+slots.length+'.');
const prices=new Map();let source='SAMPLE PRICES (invented, not live)';
if(live){const tariff='E-1R-AGILE-OUTGOING-19-05-13-E',product='AGILE-OUTGOING-19-05-13';const url='https://api.octopus.energy/v1/products/'+product+'/electricity-tariffs/'+tariff+'/standard-unit-rates/?period_from='+encodeURIComponent(slots[0].at.toISOString())+'&period_to='+encodeURIComponent(new Date(slots.at(-1).at.getTime()+1800000).toISOString())+'&page_size=250';const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),16000);let response;try{response=await fetch(url,{signal:controller.signal})}finally{clearTimeout(timeout)}if(!response.ok)throw Error('Octopus price request HTTP '+response.status);const json=await response.json();for(const r of json.results||[])if(r.valid_from&&Number.isFinite(Number(r.value_inc_vat)))prices.set(key(new Date(r.valid_from)),Number(r.value_inc_vat));source='PUBLISHED OCTOPUS PRICES (not your tariff or bill)';}
else{for(const s of slots){const h=s.clock;prices.set(s.key,h<12?5:h<15?8:h<16?12:h<16.5?17:h<17?22:h<17.5?34:h<18?18:10)}}
const base=simulate(c,slots,prices,false);const plan=simulate(c,slots,prices,true);if(!base.ok||!plan.ok)throw Error(plan.reason||base.reason);
const priceSlots=slots.filter(s=>prices.has(s.key)&&s.clock<19).length;
status.textContent=source+' · '+priceSlots+' of '+slots.filter(s=>s.clock<19).length+' pre-19:00 intervals priced · '+day+'.';
const improvement=(plan.value+plan.end*c.night/100)-(base.value+base.end*c.night/100);
result.textContent='SIMULATION ONLY · '+slots.length+' chronological half-hours (05:30–23:30)\n'+
'Fox ESS EVO10 nominal capacity: '+fmt(c.capacity)+' kWh; minimum SOC: '+fmt(c.min)+'%\n'+
'Forecast solar: '+fmt(c.solar)+' kWh ('+c.solarMode+'); baseline home load: '+fmt(c.load)+' kW ('+c.mode+')\n'+
'19:00 protected target: '+fmt(c.target)+'% · predicted at 19:00: '+fmt(plan.at19/c.capacity*100)+'%\n'+
'Predicted SOC at 23:30: '+fmt(plan.end/c.capacity*100)+'%\n'+
'Planned forced battery export: '+fmt(plan.forced)+' kWh\n'+
'Total modelled export (including natural solar): '+fmt(plan.export)+' kWh\n'+
'Grid import needed 05:30–23:30: '+fmt(plan.import)+' kWh\n'+
'Financial improvement versus NO forced battery export: £'+fmt(improvement)+' (includes end-of-day battery energy valued at overnight rate)\n'+
(improvement<=.001?'No positive-value forced export was identified under these assumptions.':'Only financially beneficial exports are selected by the optimiser.')+'\n\n'+
'LIMITS: Forecast solar is an illustrative daylight curve, not a fetched weather forecast. Household profiles are hypothetical, not learned. Candidate schedules use 0.02 kWh SOC buckets, but battery energy is carried continuously without rounding losses. Bucket merging is an optimisation approximation, not an energy loss. Missing Octopus rates are never invented as published rates. Net export is capped at 3.5 kW per interval, not a daily kWh quota. Real inverter power limits, physical meter transients, solar export and actual 19:00 feasibility must be validated before any future control. No Fox/Ohme/Home Assistant access, production learning or actual dispatch.';
const sum=k=>plan.steps.reduce((a,z)=>a+(z[k]||0),0);const solarIn=sum('solar'),houseUse=sum('house'),solarHouse=sum('solarToHome'),solarStored=sum('solarCharge'),batteryHome=sum('homeFromBattery'),gridHouse=sum('grid'),naturalExport=sum('naturalExport'),forcedExport=sum('forced'),chargeLoss=solarStored/(c.eff/100)-solarStored,dischargeLoss=(batteryHome+forcedExport)/(c.eff/100)-(batteryHome+forcedExport);const surplusUnallocated=Math.max(0,solarIn-solarHouse-solarStored/(c.eff/100)-naturalExport);const initial=c.capacity*c.soc/100,ending=plan.end;const solarBalance=solarIn-solarHouse-solarStored/(c.eff/100)-naturalExport-surplusUnallocated;const houseBalance=houseUse-solarHouse-batteryHome-gridHouse;const batteryBalance=initial+solarStored-batteryHome/(c.eff/100)-forcedExport/(c.eff/100)-ending;result.textContent+='\n\nCONTINUOUS ENERGY AUDIT (kWh; synthetic)\nSolar generated: '+fmt(solarIn)+' | solar to house: '+fmt(solarHouse)+' | solar into battery (stored): '+fmt(solarStored)+' | natural export: '+fmt(naturalExport)+' | curtailed/unused: '+fmt(surplusUnallocated)+'\nHouse demand: '+fmt(houseUse)+' | solar: '+fmt(solarHouse)+' | battery: '+fmt(batteryHome)+' | grid: '+fmt(gridHouse)+'\nBattery opening (modelled): '+fmt(initial)+' | closing: '+fmt(ending)+' | forced export: '+fmt(forcedExport)+' | charge conversion loss: '+fmt(chargeLoss)+' | discharge conversion loss: '+fmt(dischargeLoss)+'\nSolar balance residual: '+fmt(solarBalance)+' kWh | home balance residual: '+fmt(houseBalance)+' kWh | battery balance residual: '+fmt(batteryBalance)+' kWh\n';if(Math.abs(solarBalance)>0.00001||Math.abs(houseBalance)>0.00001||Math.abs(batteryBalance)>0.00001)result.textContent+='WARNING: Energy audit outside tolerance; do not trust financial result.\n';if(plan.at19/c.capacity*100+0.1<c.target)result.textContent+='WARNING: 19:00 SOC target failed.\n';if(plan.end/c.capacity*100+0.1<c.min)result.textContent+='WARNING: Minimum SOC failed.\n';
const t=el('table');t.style.cssText='width:100%;border-collapse:collapse;font-size:12px';const head=el('tr');for(const h of ['UK time','Solar kWh','Home kWh','Agile p','Battery export kWh','Grid import kWh','SOC end %']){const th=el('th',h);th.style.padding='5px';head.append(th)}t.append(head);
for(const s of plan.steps){const tr=el('tr');const p=parts(s.at);for(const v of [p.hour+':'+p.minute,fmt(s.solar),fmt(s.house),s.price===undefined?'—':fmt(s.price),fmt(s.forced),fmt(s.grid),fmt(s.soc/c.capacity*100)]){const td=el('td',v);td.style.cssText='padding:5px;border-top:1px solid #52627a';tr.append(td)}t.append(tr)}table.replaceChildren(t);
}catch(e){status.textContent='Simulation unavailable: '+e.message;result.textContent='';table.replaceChildren()}finally{sample.disabled=published.disabled=false}}
sample.addEventListener('click',()=>run(false));published.addEventListener('click',()=>run(true));
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();'''
temp=Path('fox-energy-accounting-v17-check.js')
temp.write_text(source)
r=subprocess.run(['node','--check',str(temp)],capture_output=True,text=True)
if r.returncode:temp.unlink();raise SystemExit('STOP: JS syntax check failed: '+r.stderr)
if any('</body>' not in p.read_text() for p in html):temp.unlink();raise SystemExit('STOP: HTML marker missing. No changes made.')
temp.replace('fox-energy-accounting-v17.js')
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
for p in html:
 s=p.read_text()
 if 'fox-energy-accounting-v17.js' in s:continue
 p.with_name(p.name+'.bak-v17-'+stamp).write_text(s)
 p.write_text(s.replace('</body>','<script src="fox-energy-accounting-v17.js?v='+stamp+'"></script>\n</body>',1))
print('SUCCESS: v1.7 installed. Refresh preview-v2.html; run sample and published price tests.')
PYINSTALL
