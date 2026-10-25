#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/FOX-OPTIMISER
python3 - <<'PY'
from pathlib import Path
import subprocess,datetime,json
fixture=Path('fox-test-v09-data.json')
html=[Path('index.html'),Path('preview-v2.html')]
if not fixture.exists() or not all(p.exists() for p in html):
 raise SystemExit('STOP: Synthetic fixture or HTML missing. No files changed.')
d=json.loads(fixture.read_text())
if d.get('dataset_type')!='synthetic_test' or d.get('learning_eligible') is not False or len(d.get('entries',[]))!=480:
 raise SystemExit('STOP: Test fixture failed validation. No files changed.')
src=r'''(() => {
'use strict';
const ID='foxFinancialV13';
const E=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
const n=x=>Number(x)||0;
const f=x=>Number(x).toFixed(2);
const energy=(rows,key)=>rows.reduce((a,r)=>a+n(r[key])*.5,0);
function setup(){
 if(document.getElementById(ID))return;
 const host=document.getElementById('foxBatteryAwareV12')||document.querySelector('main');
 if(!host)return;
 const panel=E('section');panel.id=ID;panel.className='panel';
 panel.style.cssText='margin:18px 0;padding:18px;border:1px solid #5278aa;border-radius:14px';
 panel.append(E('h3','Financial scenario test · v1.3'));
 const note=E('p','Synthetic 10-day fixture only. Illustrative tariff comparison, not actual Octopus billing or a validated dispatch strategy. No hardware, Home Assistant, Fox or Ohme connection.');
 note.className='note';panel.append(note);
 const form=E('div');form.style.cssText='display:flex;flex-wrap:wrap;gap:12px';
 const inputs={};
 for(const [key,label,value,min,max] of [
 ['cheap','Cheap import (p/kWh)',3.33,0,100],
 ['peak','Other import (p/kWh)',28,0,100],
 ['export','Illustrative export (p/kWh)',12,0,100],
 ['reserve','Battery reserve (kWh)',2,0,9],
 ['capacity','Usable battery (kWh)',9,1,100],
 ['eff','Round-trip efficiency (%)',90,1,100]
 ]){
  const lab=E('label',label+' ');lab.style.cssText='display:flex;flex-direction:column;gap:4px;font-size:13px';
  const inp=E('input');inp.type='number';inp.min=min;inp.max=max;inp.step='.01';inp.value=value;inp.style.cssText='width:115px;padding:7px';
  lab.append(inp);form.append(lab);inputs[key]=inp;
 }
 panel.append(form);
 const btn=E('button','Compare synthetic financial scenarios');btn.type='button';btn.style.cssText='margin-top:12px;padding:10px 14px;cursor:pointer';
 panel.append(btn);
 const out=E('p','Comparison not run.');out.style.cssText='white-space:pre-line;line-height:1.8';out.setAttribute('aria-live','polite');panel.append(out);
 host.insertAdjacentElement('afterend',panel);
 btn.addEventListener('click',async()=>{
  btn.disabled=true;out.textContent='Validating synthetic data…';
  try{
   const c=Object.fromEntries(Object.entries(inputs).map(([k,x])=>[k,Number(x.value)]));
   if(Object.entries(c).some(([k,v])=>!Number.isFinite(v)||v<0)||c.capacity<=0||c.eff<=0||c.eff>100||c.reserve>c.capacity)throw Error('Check the tariff, capacity, efficiency and reserve inputs.');
   const response=await fetch('fox-test-v09-data.json',{cache:'no-store'});
   if(!response.ok)throw Error('Test fixture unavailable (HTTP '+response.status+')');
   const d=await response.json();
   const rows=d.entries;
   if(d.dataset_type!=='synthetic_test'||d.learning_eligible!==false||d.production_import_allowed!==false||!Array.isArray(rows)||rows.length!==480||!rows.every(r=>r.source==='SYNTHETIC_TEST_ONLY'&&r.learning_eligible===false))throw Error('Safety/fixture validation failed.');
   const cheap=r=>{const h=Number(r.timestamp_local.slice(11,13)),m=Number(r.timestamp_local.slice(14,16));return h===23&&m>=30||h<5||h===5&&m<30};
   const cost=rows.reduce((sum,r)=>sum+n(r.grid_import_kw)*.5*(cheap(r)?c.cheap:c.peak)/100,0);
   const revenue=energy(rows,'grid_export_kw')*c.export/100;
   const batteryIn=energy(rows,'battery_charge_kw');
   const batteryOut=energy(rows,'battery_discharge_kw');
   const headroom=Math.max(0,c.capacity-c.reserve);
   const roundTrip=c.eff/100;
   const valueHouse=headroom*c.peak/100;
   const valueExport=headroom*c.export/100;
   const chargeCost=headroom/roundTrip*c.cheap/100;
   const houseMargin=valueHouse-chargeCost;
   const exportMargin=valueExport-chargeCost;
   const better=houseMargin>=exportMargin?'House self-use':'Export (only where allowed)';
   out.textContent='TEST ONLY · 480 half-hours / 10 synthetic days\n'+
    'Original simulated grid import: '+f(energy(rows,'grid_import_kw'))+' kWh\n'+
    'Original simulated export: '+f(energy(rows,'grid_export_kw'))+' kWh\n'+
    'Original simulated import cost: £'+f(cost)+'\n'+
    'Original simulated export revenue: £'+f(revenue)+'\n'+
    'Original net variable energy cost: £'+f(cost-revenue)+'\n'+
    'Original synthetic battery charging: '+f(batteryIn)+' kWh; discharging: '+f(batteryOut)+' kWh\n\n'+
    'ONE FULL BATTERY CYCLE · hypothetical marginal comparison\n'+
    'Battery usable above '+f(c.reserve)+' kWh reserve: '+f(headroom)+' kWh\n'+
    'Overnight grid energy needed: '+f(headroom/roundTrip)+' kWh\n'+
    'Overnight charge cost: £'+f(chargeCost)+'\n'+
    'Avoided daytime import value: £'+f(valueHouse)+'\n'+
    'Daytime export revenue value: £'+f(valueExport)+'\n'+
    'House self-use margin: £'+f(houseMargin)+'\n'+
    'Export margin: £'+f(exportMargin)+'\n'+
    'Higher illustrative value: '+better+'\n\n'+
    'IMPORTANT: These are two separate illustrations, NOT a claim that the battery can complete this cycle daily. They do not schedule export, optimise 30-minute Agile rates, account for battery degradation, verify import/export limits, or model actual household consumption. The 3.5 kW DNO export limit remains unchanged. Production learning is untouched.';
  }catch(err){out.textContent='Test not run: '+err.message}
  finally{btn.disabled=false}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();'''
tmp=Path('fox-financial-v13.js.tmp')
tmp.write_text(src)
check=Path('fox-financial-v13.syntax.js');check.write_text(src)
r=subprocess.run(['node','--check',str(check)],capture_output=True,text=True)
check.unlink(missing_ok=True)
if r.returncode:
 tmp.unlink(missing_ok=True);raise SystemExit('STOP: JS syntax error: '+r.stderr)
if any('</body>' not in p.read_text() for p in html):
 tmp.unlink(missing_ok=True);raise SystemExit('STOP: Missing HTML body tag. No files changed.')
tmp.replace(Path('fox-financial-v13.js'))
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
for p in html:
 s=p.read_text()
 if 'fox-financial-v13.js' in s:continue
 p.with_name(p.name+'.bak-v13-'+stamp).write_text(s)
 p.write_text(s.replace('</body>','<script src="fox-financial-v13.js?v='+stamp+'"></script>\n</body>',1))
print('SUCCESS: v1.3 financial scenario test installed')
print('PASS: JavaScript syntax, 480 synthetic intervals, both HTML entry points')
print('SAFE: No production learning, server, Home Assistant, Fox, Ohme or hardware controls modified')
print('Refresh preview-v2.html and run Financial scenario test v1.3')
PY
