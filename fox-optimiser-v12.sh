#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/FOX-OPTIMISER
python3 - <<'PY'
from pathlib import Path
import json,subprocess,datetime
source=Path('fox-battery-aware-v11.js')
fixture=Path('fox-test-v09-data.json')
html=[Path('index.html'),Path('preview-v2.html')]
if not source.exists() or not fixture.exists() or not all(p.exists() for p in html):
 raise SystemExit('STOP: v1.1 source, test fixture or HTML missing. No changes made.')
data=json.loads(fixture.read_text())
if data.get('dataset_type')!='synthetic_test' or data.get('learning_eligible') is not False or len(data.get('entries',[]))!=480:
 raise SystemExit('STOP: test fixture not safe/complete. No changes made.')
src=source.read_text()
a=src.find('function run(rows,limit,capacity,eff,maxCharge){')
b=src.find('function setup(){',a)
if a<0 or b<0:raise SystemExit('STOP: v1.1 layout unexpected. No changes made.')
newrun=r"""function run(rows,limit,capacity,eff,maxCharge){
 const originalPeak=Math.max(...rows.map(r=>n(r.grid_import_kw)));
 const sessions=new Map();
 rows.forEach((r,i)=>{if(overnight(r)){const key=session(r);if(!sessions.has(key))sessions.set(key,[]);sessions.get(key).push({r,i});}});
 const revised=rows.map(r=>n(r.grid_import_kw)-n(r.battery_charge_kw));
 const battery=rows.map(r=>overnight(r)?0:n(r.battery_charge_kw));
 rows.forEach((r,i)=>{if(!overnight(r))revised[i]+=battery[i]});
 let required=0,placed=0,shortfall=0,excessRequest=0,conflicts=0,fullSessions=0,completeCount=0;
 const checks=[];
 for(const [key,items] of sessions){
  items.sort((a,b)=>a.i-b.i);
  const times=items.map(x=>clock(x.r));
  const complete=items.length===12&&times[0]==='00:00'&&times.at(-1)==='23:30'?false:
   items.length===12&&times[0]==='23:30'&&times.at(-1)==='05:00';
  // Chronological sorting must use timestamp, not clock string.
  items.sort((a,b)=>a.r.timestamp_local.localeCompare(b.r.timestamp_local));
  const completeSession=items.length===12&&clock(items[0].r)==='23:30'&&clock(items[11].r)==='05:00';
  const first=items[0].r;
  const initial=Math.max(0,Math.min(100,n(first.battery_soc_pct)));
  const requested=sum(items,x=>n(x.r.battery_charge_kw)*.5);
  const need=capacity*(100-initial)/100/eff;
  let left=need;
  const candidates=items.map(x=>{
   const base=revised[x.i],discharge=n(x.r.battery_discharge_kw);
   const headroom=Math.max(0,Math.min(maxCharge,limit-base));
   return {...x,base,discharge,headroom:discharge>0?0:headroom};
  });
  // Cheapest equivalent test: use available lower-baseload intervals first.
  // No export or tariff optimisation, and no physical controls.
  for(const x of [...candidates].sort((a,b)=>a.base-b.base||a.i-b.i)){
   const energy=Math.max(0,Math.min(left,x.headroom*.5));
   battery[x.i]=energy*2;
   revised[x.i]+=energy*2;
   left-=energy;
  }
  let soc=initial;
  for(const x of candidates){
   if(x.discharge>0&&battery[x.i]>0.0001)conflicts++;
   soc=Math.min(100,soc+battery[x.i]*.5*eff/capacity*100);
  }
  const got=Math.max(0,need-left);
  if(completeSession){
   completeCount++;required+=need;placed+=got;shortfall+=Math.max(0,left);
   excessRequest+=Math.max(0,requested-need);
   if(soc>=99.95)fullSessions++;
  }
  checks.push({key,initial,final:soc,requested,need,got,shortfall:Math.max(0,left),excess:Math.max(0,requested-need),count:items.length,complete:completeSession});
 }
 const over=revised.filter(x=>x>limit+.001).length;
 const baseOver=rows.filter(r=>n(r.grid_import_kw)-n(r.battery_charge_kw)>limit+.001).length;
 return {originalPeak,newPeak:Math.max(...revised),over,baseOver,required,placed,shortfall,excessRequest,conflicts,checks,battery,revised,fullSessions,completeCount};
}
"""
# Remove redundant variable for clarity
newrun=newrun.replace("""  const times=items.map(x=>clock(x.r));
  const complete=items.length===12&&times[0]==='00:00'&&times.at(-1)==='23:30'?false:
   items.length===12&&times[0]==='23:30'&&times.at(-1)==='05:00';
  // Chronological sorting must use timestamp, not clock string.
""","""  // Chronological sorting must use timestamp, not clock string.
""")
out=src[:a]+newrun+src[b:]
out=out.replace("const ID='foxBatteryAwareV11'","const ID='foxBatteryAwareV12'")
out=out.replace("Battery-aware feasibility test · v1.1","SOC-target charging test · v1.2")
out=out.replace("Run SOC-aware 10-day test","Run 10-day SOC target test")
old="const line=E('p','Session '+x.key+': starting SOC '+f(x.initial)+'%, ending SOC '+f(x.final)+'%; charged '+f(x.got)+'/'+f(x.requested)+' kWh from grid; shortfall '+f(x.shortfall)+' kWh. Intervals available: '+x.count+'.');"
new="const line=E('p','Session '+x.key+(x.complete?' (complete)':' (INCOMPLETE — excluded from headline)')+': starting SOC '+f(x.initial)+'%, ending SOC '+f(x.final)+'%; energy needed for 100% '+f(x.need)+' kWh; scheduled '+f(x.got)+' kWh; GENUINE shortfall '+f(x.shortfall)+' kWh; synthetic request above SOC need '+f(x.excess)+' kWh. Intervals: '+x.count+'.');"
if old not in out:raise SystemExit('STOP: v1.1 session display unexpected. No changes made.')
out=out.replace(old,new)
old="summary.textContent='Original peak: '+f(res.originalPeak)+' kW\\nRevised peak: '+f(res.newPeak)+' kW\\nRevised half-hours above grid ceiling: '+res.over+' (baseline-only violations: '+res.baseOver+')\\nBattery charging requested: '+f(res.target)+' kWh\\nBattery charging feasible with starting SOC and 100% ceiling: '+f(res.placed)+' kWh\\nUnplaced charging: '+f(res.unplaced)+' kWh\\nSessions ending at 100% in this model: '+res.fullSessions+' / '+res.checks.length+'\\nCharge/discharge conflicts: '+res.conflicts+'\\n\\nWARNING: This is a feasibility stress test, not a verified operating schedule. Starting SOC values in the synthetic fixture may be inconsistent with previous intervals. Overnight sessions at the dataset boundaries may be incomplete. Half-hour readings cannot establish an instantaneous import guarantee. Unplaced charging must never be described as successfully scheduled.';"
new="summary.textContent='Original peak: '+f(res.originalPeak)+' kW\\nRevised peak: '+f(res.newPeak)+' kW\\nHalf-hours above provisional grid ceiling: '+res.over+' (baseline-only violations: '+res.baseOver+')\\nComplete overnight sessions: '+res.completeCount+' / '+res.checks.length+' (boundary sessions excluded from totals)\\nEnergy needed to reach 100%: '+f(res.required)+' kWh\\nFeasibly scheduled to 100%: '+f(res.placed)+' kWh\\nGENUINE charging shortfall: '+f(res.shortfall)+' kWh\\nSynthetic requests ABOVE physical SOC need: '+f(res.excessRequest)+' kWh (not a charging failure)\\nComplete sessions reaching 100%: '+res.fullSessions+' / '+res.completeCount+'\\nCharge/discharge conflicts: '+res.conflicts+'\\n\\nCAUTION: SOC starts from synthetic fixture values, not real measurements. EV windows remain synthetic; 30-minute modelling cannot guarantee instantaneous grid compliance. No inverter/Ohme controls and no production learning credit.';"
if old not in out:raise SystemExit('STOP: v1.1 summary unexpected. No changes made.')
out=out.replace(old,new)
out=out.replace("const host=document.getElementById('foxOptimisationV10')||document.querySelector('main');","const host=document.getElementById('foxBatteryAwareV11')||document.querySelector('main');")
target=Path('fox-battery-aware-v12.js')
tmp=Path('fox-battery-aware-v12.js.tmp')
tmp.write_text(out)
# Node check accepts .js extension
tmpjs=Path('fox-battery-aware-v12.syntax.js');tmpjs.write_text(out)
r=subprocess.run(['node','--check',str(tmpjs)],capture_output=True,text=True)
tmpjs.unlink(missing_ok=True)
if r.returncode:
 tmp.unlink(missing_ok=True);raise SystemExit('STOP: JavaScript syntax: '+r.stderr)
for f in html:
 if '</body>' not in f.read_text():raise SystemExit('STOP: missing body tag in '+str(f))
tmp.replace(target)
stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
for f in html:
 text=f.read_text()
 if 'fox-battery-aware-v12.js' in text:continue
 f.with_name(f.name+'.bak-v12-'+stamp).write_text(text)
 f.write_text(text.replace('</body>','<script src="fox-battery-aware-v12.js?v='+stamp+'"></script>\n</body>',1))
print('SUCCESS: v1.2 installed; syntax verified')
print('Complete overnight sessions only; distinguishes excess requests from genuine shortfalls')
print('Safe: read-only, synthetic-only; production learning, server and hardware unchanged')
print('Refresh preview-v2.html and run the v1.2 SOC target test')
PY
