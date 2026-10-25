#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/FOX-OPTIMISER
python3 - <<'PY'
from pathlib import Path
import re, subprocess, datetime
fixture=Path('fox-test-v09-data.json')
if not fixture.exists(): raise SystemExit('STOP: v0.9 test fixture missing. No files changed.')
for name in ('index.html','preview-v2.html'):
 if not Path(name).exists(): raise SystemExit('STOP: '+name+' missing. No files changed.')
js=r'''(() => {
'use strict';
const ID='foxOptimisationV10';
const make=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
const number=(v)=>Number.isFinite(Number(v))?Number(v):0;
const money=(v)=>number(v).toFixed(2);
const date=(r)=>r.timestamp_local.slice(0,10);
const clock=(r)=>r.timestamp_local.slice(11,16);
const cheap=(r)=>clock(r)>='23:30'||clock(r)<'05:30';
const kwh=(rows,key)=>rows.reduce((s,r)=>s+number(r[key])*.5,0);
function analyse(rows,limit){
 const data=rows.map(r=>({...r}));
 const original=data.map(r=>number(r.grid_import_kw));
 const newGrid=data.map((r,i)=>original[i]-number(r.battery_charge_kw));
 const newBattery=new Array(data.length).fill(0);
 const eligible=data.map((r,i)=>({r,i})).filter(x=>cheap(x.r));
 const target=kwh(eligible.map(x=>x.r),'battery_charge_kw');
 let remaining=0;
 // Keep each overnight session independent: never move battery energy between nights.
 const nights=new Map();
 for(const x of eligible){
  // 00:00-05:30 belongs to the preceding calendar day.
  const nightKey=clock(x.r)>='23:30'?date(x.r):new Date(Date.parse(date(x.r)+'T12:00:00Z')-86400000).toISOString().slice(0,10);
  if(!nights.has(nightKey))nights.set(nightKey,[]);
  nights.get(nightKey).push(x);
 }
 for(const night of nights.values()){
  let needed=kwh(night.map(x=>x.r),'battery_charge_kw');
  for(const {i} of night.slice().sort((a,b)=>newGrid[a.i]-newGrid[b.i]||a.i-b.i)){
   const room=Math.max(0,Math.min(5,limit-newGrid[i]));
   const power=Math.min(room,needed*2);
   newBattery[i]=power;newGrid[i]+=power;needed=Math.max(0,needed-power*.5);
  }
  remaining+=needed;
 }
 // Battery charging outside the overnight window is retained unchanged.
 data.forEach((r,i)=>{if(!cheap(r)){newBattery[i]=number(r.battery_charge_kw);newGrid[i]+=newBattery[i];}});
 const max=a=>Math.max(0,...a);
 return {data,original,newGrid,newBattery,target,placed:target-remaining,shortfall:remaining,
  oldPeak:max(original),newPeak:max(newGrid),oldOver:original.filter(x=>x>limit+.001).length,
  newOver:newGrid.filter(x=>x>limit+.001).length,
  originalImport:original.reduce((a,b)=>a+b*.5,0),newImport:newGrid.reduce((a,b)=>a+b*.5,0)};
}
function setup(){
 if(document.getElementById(ID))return;
 const host=document.querySelector('#foxTestModeV09')||document.querySelector('main');if(!host)return;
 const panel=make('section');panel.id=ID;panel.className='panel';panel.style.cssText='margin:18px 0;padding:18px;border:1px solid #5278aa;border-radius:14px;';
 const title=make('h3','Charging Optimisation Test · v1.0');
 const info=make('p','Read-only, synthetic data only. Keeps the test EV and household profiles unchanged. Redistributes existing overnight battery charging across cheap-rate half-hours; no inverter or Ohme control.');info.className='note';
 const label=make('label','Provisional shared grid limit (kW) ');const cap=make('input');cap.type='number';cap.min='1';cap.max='30';cap.step='0.1';cap.value='8.3';cap.style.cssText='width:85px;margin:8px;';label.append(cap);
 const btn=make('button','Compare 10-day charging schedules');btn.type='button';btn.style.cssText='padding:10px 15px;border-radius:8px;cursor:pointer;';
 const status=make('p','Comparison not run.');status.setAttribute('aria-live','polite');
 const summary=make('div');summary.style.cssText='white-space:pre-line;line-height:1.8;';
 const select=make('select');select.setAttribute('aria-label','Comparison day');select.style.cssText='display:none;padding:8px;margin:10px 0;';
 const table=make('div');table.style.cssText='overflow-x:auto;max-height:420px;overflow-y:auto;';
 panel.append(title,info,label,btn,status,summary,select,table);
 host.insertAdjacentElement('afterend',panel);
 let data=[],currentLimit=8.3;
 function show(){
  const day=select.value;
  const subset=data.filter(r=>date(r)===day);
  const res=analyse(subset,currentLimit);
  const note=make('p',day+' · Daily view. For an overnight session crossing midnight, refer to the complete 10-day totals above.');
  const t=make('table');t.style.cssText='width:100%;font-size:12px;border-collapse:collapse;';
  const tr=make('tr');['Time','EV kW','House kW','Original battery kW','Revised battery kW','Original grid kW','Revised grid kW'].forEach(h=>tr.append(make('th',h)));
  const thead=make('thead');thead.append(tr);t.append(thead);
  const body=make('tbody');res.data.forEach((r,i)=>{const row=make('tr');
   [clock(r),number(r.ev_kw).toFixed(2),number(r.house_kw).toFixed(2),number(r.battery_charge_kw).toFixed(2),res.newBattery[i].toFixed(2),res.original[i].toFixed(2),res.newGrid[i].toFixed(2)].forEach((v,j)=>{const td=make('td',v);td.style.cssText='padding:6px;border-top:1px solid #52627a;white-space:nowrap;';if(j===6&&number(v)>currentLimit+.001)td.style.color='#ff9b82';row.append(td);});body.append(row);});
  t.append(body);table.replaceChildren(note,t);
 }
 select.addEventListener('change',show);
 btn.addEventListener('click',async()=>{
  btn.disabled=true;status.textContent='Validating synthetic test data…';
  try{
   currentLimit=Number(cap.value);if(!Number.isFinite(currentLimit)||currentLimit<1||currentLimit>30)throw Error('Enter a grid limit between 1 and 30 kW');
   const response=await fetch('fox-test-v09-data.json',{cache:'no-store'});if(!response.ok)throw Error('Test fixture HTTP '+response.status);
   const p=await response.json();
   if(p.dataset_type!=='synthetic_test'||p.learning_eligible!==false||p.production_import_allowed!==false||!Array.isArray(p.entries)||p.entries.length!==480||!p.entries.every(r=>r.source==='SYNTHETIC_TEST_ONLY'&&r.learning_eligible===false))throw Error('Synthetic fixture safety validation failed');
   data=p.entries.slice().sort((a,b)=>a.timestamp_local.localeCompare(b.timestamp_local));
   const days=[...new Set(data.map(date))];if(days.length!==10||days.some(d=>data.filter(r=>date(r)===d).length!==48))throw Error('Missing or duplicate daily intervals');
   const result=analyse(data,currentLimit);
   status.textContent='TEST ONLY · 480 intervals · 10 days · Production learning unchanged';
   summary.textContent='Original peak grid import: '+money(result.oldPeak)+' kW\nRevised peak grid import: '+money(result.newPeak)+' kW\nOriginal intervals above '+currentLimit.toFixed(1)+' kW: '+result.oldOver+'\nRevised intervals above '+currentLimit.toFixed(1)+' kW: '+result.newOver+'\nOvernight battery energy to reschedule: '+money(result.target)+' kWh\nBattery energy placed within provisional limit: '+money(result.placed)+' kWh\nUnplaced battery energy: '+money(result.shortfall)+' kWh\nOriginal modelled grid import: '+money(result.originalImport)+' kWh\nRevised modelled grid import: '+money(result.newImport)+' kWh\n\nIMPORTANT: The revised result is a simplified peak-shaving feasibility test, not a valid operational schedule. It does not simulate battery SOC continuity, charge/discharge conflicts, export behaviour, tariffs outside the standard window, or real Ohme schedules. EV and household demand are not rescheduled. No production learning credit.';
   select.replaceChildren(...days.map(d=>{const o=make('option',d);o.value=d;return o;}));select.style.display='block';show();
  }catch(e){status.textContent='Comparison not run: '+e.message;summary.textContent='';table.replaceChildren();select.style.display='none';}
  finally{btn.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
'''
Path('fox-optimisation-v10.js').write_text(js)
check=subprocess.run(['node','--check','fox-optimisation-v10.js'],capture_output=True,text=True)
if check.returncode: Path('fox-optimisation-v10.js').unlink(missing_ok=True);raise SystemExit('STOP: JS syntax error: '+check.stderr)
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
for name in ('index.html','preview-v2.html'):
 p=Path(name);s=p.read_text()
 if 'fox-optimisation-v10.js' in s: continue
 if 'fox-test-v09.js' not in s: raise SystemExit('STOP: '+name+' has no v0.9 test script; cannot attach safely')
 p.with_name(name+'.bak-v10-'+stamp).write_text(s)
 tag='<script src="fox-optimisation-v10.js?v='+stamp+'"></script>'
 if '</body>' in s: s=s.replace('</body>',tag+'\n</body>',1)
 else: raise SystemExit('STOP: '+name+' missing body close')
 p.write_text(s)
print('SUCCESS: v1.0 synthetic charging comparison installed')
print('PASS: JS syntax; existing 480-reading fixture reused; both HTML pages updated')
print('SAFE: no writes to server, API, learning logger, EV or battery controls')
print('Open preview-v2.html and select Compare 10-day charging schedules')
PY
