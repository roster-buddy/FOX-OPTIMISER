#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/FOX-OPTIMISER
python3 - <<'PY'
from pathlib import Path
from datetime import datetime
import subprocess, shutil, re
required=['app.js','fox-charging-v07.js','fox-v05.js','index.html','preview-v2.html']
for name in required:
    if not Path(name).exists(): raise SystemExit('STOP: missing '+name)
app=Path('app.js').read_text()
old=Path('fox-charging-v07.js').read_text()
if 'function initialiseSolarV3()' not in app or 'function solarKwh(t)' not in app: raise SystemExit('STOP: solar forecast interface changed')
if "const batteryNeed=Math.max(0,batteryCapacity*(100-soc)/100/(cfg.batteryEfficiency/100));" not in old: raise SystemExit('STOP: v0.7 planner interface changed')
if 'window.foxSolarForecastV08' in app: raise SystemExit('STOP: solar bridge already present; no changes')
if 'fox-charging-v08.js' in Path('preview-v2.html').read_text(): raise SystemExit('STOP: v0.8 already installed')
stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
bridge='''// v0.8: read-only access to the existing solar forecast. Never expose coordinates.
window.foxSolarForecastV08 = function(day) {
  const valid = /^\\d{4}-\\d{2}-\\d{2}$/.test(day);
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
'''
app_new=app.replace('function initialiseSolarV3() {',bridge+'\nfunction initialiseSolarV3() {',1)
js=old.replace("window.foxChargingPlannerV06={refresh:render};", "window.foxChargingPlannerV06={refresh:render};")
# Solar card is a companion to the unchanged 100%-during-learning planner.
insert='''
const solarState={learningComplete:false,learningDays:0,loggerOnline:false};
const ukDay=(d)=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(d);const x=Object.fromEntries(p.map(a=>[a.type,a.value]));return x.year+'-'+x.month+'-'+x.day;};
function solarCard() {
 const node=document.getElementById('foxSolarAwareV08');if(!node)return;
 const start=new Date();start.setHours(23,30,0,0);if(new Date()>=start)start.setDate(start.getDate()+1);
 const target=new Date(start);target.setDate(target.getDate()+1);
 const day=ukDay(target);
 const snap=window.foxSolarForecastV08?.(day);
 const cap=Number(document.querySelector('[name="capacity"]')?.value);
 const soc=Number(document.querySelector('[name="soc"]')?.value);
 const valid=Number.isFinite(cap)&&cap>0&&Number.isFinite(soc)&&soc>=0&&soc<=100;
 const fmt=x=>Number(x).toFixed(2);
 const rows=[];
 rows.push('Learning: '+(solarState.loggerOnline?(solarState.learningDays+' / 28 valid days'):'No verified logger status')+'.');
 if(!snap?.available){rows.push('Solar: '+(snap?.reason||'Forecast not yet loaded')+'. Load the existing Solar forecast panel.');}
 else {
  rows.push('Forecast for '+day+': '+fmt(snap.generationKwh)+' kWh solar; '+fmt(snap.dayHouseKwh)+' kWh estimated daytime home demand.');
  rows.push('Simple estimated daytime surplus: '+fmt(snap.surplusKwh)+' kWh. This is NOT guaranteed battery charging: generation timing, household load, battery charging limits and exports matter.');
  if(valid){
   const minSoc=20;
   const hypothetical=Math.max(minSoc,100-100*Math.min(snap.surplusKwh,cap*(1-minSoc/100))/cap);
   const overnight100=cap*(100-soc)/100/.9;
   const overnightScenario=cap*Math.max(0,hypothetical-soc)/100/.9;
   rows.push('100% overnight baseline: '+fmt(overnight100)+' kWh grid energy from entered SOC.');
   rows.push('Illustrative solar-headroom scenario: '+hypothetical.toFixed(0)+'% target ('+fmt(overnightScenario)+' kWh grid energy). NOT an optimised recommendation.');
  }
 }
 rows.push(solarState.learningComplete?'28-day threshold reached. Adaptive target still requires a validated measured consumption/export model; the planner remains at 100% until that is implemented.':'During learning, the active battery target stays 100%. Solar scenario is informational only.');
 node.textContent=rows.join('\\n');
}
async function refreshLearning(){
 try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error('offline');const data=await r.json();solarState.loggerOnline=true;solarState.learningDays=Number(data.valid_days)||0;solarState.learningComplete=data.learning_complete===true;}
 catch{solarState.loggerOnline=false;solarState.learningComplete=false;solarState.learningDays=0;}
 solarCard();
}
'''
js=js.replace('function render(){',insert+'\nfunction render(){',1)
js=js.replace("  document.getElementById('foxChargeFoot').textContent=", "  solarCard();\n  document.getElementById('foxChargeFoot').textContent=",1)
js=js.replace("  render();setInterval(render,30000);", "  const card=document.createElement('section');card.className='panel';card.style.whiteSpace='pre-line';card.id='foxSolarAwareV08';card.setAttribute('aria-live','polite');panel.insertAdjacentElement('afterend',card);\n  render();refreshLearning();setInterval(render,30000);setInterval(refreshLearning,60000);",1)
js=js.replace('window.foxChargingPlannerV06={refresh:render};','window.foxChargingPlannerV06={refresh:render};\nwindow.foxSolarAwareRefreshV08=solarCard;')
# Solar forecast refresh must update companion card, including on failed fetch.
app_new=app_new.replace('    plan();\n  } catch (e) {','    plan();\n    window.foxSolarAwareRefreshV08?.();\n  } catch (e) {',1)
app_new=app_new.replace('    plan();\n  } finally {','    plan();\n    window.foxSolarAwareRefreshV08?.();\n  } finally {',1)
# Validate scripts BEFORE any changes.
probe=Path('fox-charging-v08.js.tmp');probe.write_text(js)
try:
 for name in ['app.js','fox-charging-v08.js.tmp']:
  test=app_new if name=='app.js' else js
  check=subprocess.run(['node','--check','--input-type=commonjs'],input=test,text=True,capture_output=True)
  if check.returncode: raise SystemExit('STOP: syntax failed '+name+' '+check.stderr)
finally: probe.unlink(missing_ok=True)
# Back up files and write only after validation.
for name in ['app.js','index.html','preview-v2.html']:
 shutil.copy2(name,f'{name}.bak-v08-{stamp}')
Path('app.js').write_text(app_new)
Path('fox-charging-v08.js').write_text(js)
for name in ['index.html','preview-v2.html']:
 p=Path(name);s=p.read_text()
 hits=re.findall(r"<script\b[^>]*src=['\"]fox-charging-v07\.js[^>]*></script>",s)
 if len(hits)!=1: raise SystemExit('STOP: expected exactly one v0.7 script in '+name)
 s=s.replace(hits[0],f'<script src="fox-charging-v08.js?v={stamp}" defer></script>')
 p.write_text(s)
print('SUCCESS: Fox Optimiser v0.8 solar-aware preview installed')
print('PASS: JavaScript syntax; existing solar forecast reused')
print('PASS: Backups saved; v0.7 manual settings preserved')
print('SAFE: Battery planner stays at 100% while learning; solar target is illustrative only')
print('UNCHANGED: server, calendar, EV and inverter controls')
print('Refresh preview-v2.html; load Solar forecast if needed')
PY
