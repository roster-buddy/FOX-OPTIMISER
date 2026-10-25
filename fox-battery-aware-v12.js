(() => {
'use strict';
const ID='foxBatteryAwareV12', FIX='fox-test-v09-data.json';
const E=(tag,s)=>{const e=document.createElement(tag);if(s!==undefined)e.textContent=s;return e};
const n=x=>Number(x)||0, f=x=>n(x).toFixed(2);
const clock=r=>r.timestamp_local.slice(11,16), day=r=>r.timestamp_local.slice(0,10);
const overnight=r=>clock(r)>='23:30'||clock(r)<'05:30';
const session=r=>clock(r)>='23:30'?day(r):new Date(Date.parse(day(r)+'T12:00:00Z')-86400000).toISOString().slice(0,10);
const sum=(a,fn)=>a.reduce((x,r)=>x+fn(r),0);
function run(rows,limit,capacity,eff,maxCharge){
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
function setup(){
 if(document.getElementById(ID))return;
 const host=document.getElementById('foxBatteryAwareV11')||document.querySelector('main');
 if(!host)return;
 const panel=E('section');panel.id=ID;panel.className='panel';
 panel.style.cssText='padding:18px;margin:18px 0;border:1px solid #5278aa;border-radius:14px';
 panel.append(E('h3','SOC-target charging test · v1.2'));
 const note=E('p','Synthetic test only. Checks SOC capacity, charging efficiency, charging-power limits, and the provisional instantaneous grid ceiling at each modelled half-hour. Does NOT guarantee sub-half-hour peaks, actual Ohme slots, or real battery behaviour.');
 note.className='note';panel.append(note);
 const controls=E('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:12px';
 const inputs={};
 for(const [key,label,val,min,max] of [['limit','Grid ceiling (kW)',8.3,1,30],['capacity','Usable battery (kWh)',9,1,40],['eff','Charge efficiency (%)',90,50,100],['power','Max battery charge (kW)',5,0.1,20]]){
  const l=E('label',label+' '),v=E('input');v.type='number';v.value=val;v.min=min;v.max=max;v.step='.1';v.style.cssText='width:72px;margin:6px';l.append(v);controls.append(l);inputs[key]=v;
 }
 panel.append(controls);
 const button=E('button','Run 10-day SOC target test');button.type='button';
 button.style.cssText='padding:10px 14px;cursor:pointer';panel.append(button);
 const status=E('p','Not yet run.'),summary=E('div');summary.style.whiteSpace='pre-line';summary.style.lineHeight='1.8';
 const select=E('select');select.style.cssText='display:none;margin:12px 0;padding:8px';
 const table=E('div');table.style.cssText='overflow:auto;max-height:400px';
 panel.append(status,summary,select,table);
 host.insertAdjacentElement('afterend',panel);
 let rows=[],res;
 function show(){
  const selected=select.value;
  const sessions=res.checks.filter(x=>x.key===selected);
  table.replaceChildren();
  for(const x of sessions){
   const line=E('p','Session '+x.key+(x.complete?' (complete)':' (INCOMPLETE — excluded from headline)')+': starting SOC '+f(x.initial)+'%, ending SOC '+f(x.final)+'%; energy needed for 100% '+f(x.need)+' kWh; scheduled '+f(x.got)+' kWh; GENUINE shortfall '+f(x.shortfall)+' kWh; synthetic request above SOC need '+f(x.excess)+' kWh. Intervals: '+x.count+'.');
   table.append(line);
  }
  const t=E('table');t.style.cssText='width:100%;font-size:12px;border-collapse:collapse';
  const tr=E('tr');
  ['Time','EV kW','House kW','Battery charge kW','Grid import kW','Discharge kW'].forEach(x=>tr.append(E('th',x)));
  const h=E('thead');h.append(tr);t.append(h);
  const b=E('tbody');
  rows.forEach((r,i)=>{if(session(r)!==selected||!overnight(r))return;
   const line=E('tr');
   [r.timestamp_local.slice(0,16),f(r.ev_kw),f(r.house_kw),f(res.battery[i]),f(res.revised[i]),f(r.battery_discharge_kw)].forEach(x=>{const td=E('td',x);td.style.cssText='padding:6px;border-top:1px solid #52627a;white-space:nowrap';line.append(td)});
   b.append(line);
  });
  t.append(b);table.append(t);
 }
 select.addEventListener('change',show);
 button.addEventListener('click',async()=>{
  button.disabled=true;status.textContent='Checking fixture…';
  try{
   const r=await fetch(FIX,{cache:'no-store'});if(!r.ok)throw Error('Fixture unavailable');
   const payload=await r.json();
   if(payload.dataset_type!=='synthetic_test'||payload.learning_eligible!==false||payload.production_import_allowed!==false||!Array.isArray(payload.entries)||payload.entries.length!==480||!payload.entries.every(x=>x.source==='SYNTHETIC_TEST_ONLY'&&x.learning_eligible===false))throw Error('Fixture safety validation failed');
   rows=payload.entries.slice().sort((a,b)=>a.timestamp_local.localeCompare(b.timestamp_local));
   const values=Object.fromEntries(Object.entries(inputs).map(([k,v])=>[k,Number(v.value)]));
   if(!Object.entries(inputs).every(([k,v])=>Number.isFinite(values[k])&&values[k]>=Number(v.min)&&values[k]<=Number(v.max)))throw Error('Invalid limits');
   res=run(rows,values.limit,values.capacity,values.eff/100,values.power);
   status.textContent='TEST ONLY · 480 synthetic intervals · Production learning unchanged';
   summary.textContent='Original peak: '+f(res.originalPeak)+' kW\nRevised peak: '+f(res.newPeak)+' kW\nHalf-hours above provisional grid ceiling: '+res.over+' (baseline-only violations: '+res.baseOver+')\nComplete overnight sessions: '+res.completeCount+' / '+res.checks.length+' (boundary sessions excluded from totals)\nEnergy needed to reach 100%: '+f(res.required)+' kWh\nFeasibly scheduled to 100%: '+f(res.placed)+' kWh\nGENUINE charging shortfall: '+f(res.shortfall)+' kWh\nSynthetic requests ABOVE physical SOC need: '+f(res.excessRequest)+' kWh (not a charging failure)\nComplete sessions reaching 100%: '+res.fullSessions+' / '+res.completeCount+'\nCharge/discharge conflicts: '+res.conflicts+'\n\nCAUTION: SOC starts from synthetic fixture values, not real measurements. EV windows remain synthetic; 30-minute modelling cannot guarantee instantaneous grid compliance. No inverter/Ohme controls and no production learning credit.';
   select.replaceChildren(...res.checks.map(x=>{const o=E('option',x.key);o.value=x.key;return o}));
   select.style.display='block';show();
  }catch(err){status.textContent='Test stopped: '+err.message;summary.textContent='';table.replaceChildren();}
  finally{button.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();