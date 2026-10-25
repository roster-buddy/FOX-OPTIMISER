(() => {
'use strict';
const ID='foxTestModeV09';
const fmt=(n,d=2)=>Number(n).toFixed(d);
const kwh=(items,key)=>items.reduce((a,r)=>a+Number(r[key]||0)*.5,0);
const el=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e;};
function setup(){
 if(document.getElementById(ID))return;
 const host=document.querySelector('main')||document.body;
 const panel=el('section');panel.id=ID;panel.className='panel';
 panel.style.cssText='margin:18px 0;padding:18px;border:1px solid #5278aa;border-radius:14px;';
 const title=el('h3','Test Mode · Historical simulation v0.9');
 const desc=el('p','Isolated synthetic test data. No real Fox readings, no API writes, no battery commands, and NO production learning credit.');
 desc.className='note';
 const btn=el('button','Load 10-day test data');
 btn.type='button';btn.style.cssText='padding:10px 15px;border-radius:8px;cursor:pointer;';
 const status=el('p','Test data not loaded.');status.setAttribute('aria-live','polite');
 const summary=el('div');summary.style.cssText='white-space:pre-line;line-height:1.75;';
 const select=el('select');select.setAttribute('aria-label','Test day');select.style.cssText='padding:8px;margin:8px 0;display:none;';
 const table=el('div');table.style.cssText='overflow-x:auto;max-height:360px;overflow-y:auto;';
 panel.append(title,desc,btn,status,summary,select,table);
 host.append(panel);
 let entries=[];
 function showDay(){
   const day=select.value, subset=entries.filter(r=>r.timestamp_local.slice(0,10)===day);
   const heading=el('p',day+' · 48 half-hour test intervals');
   const t=el('table');t.style.cssText='width:100%;font-size:12px;border-collapse:collapse;';
   const thead=el('thead'),tr=el('tr');
   ['Time','House kW','Solar kW','EV kW','Battery in kW','Battery out kW','Grid import kW','SOC %'].forEach(x=>{const th=el('th',x);th.style.cssText='padding:6px;white-space:nowrap;';tr.append(th);});
   thead.append(tr);t.append(thead);
   const body=el('tbody');
   subset.forEach(r=>{
      const tr=el('tr');
      [r.timestamp_local.slice(11),r.house_kw,r.solar_kw,r.ev_kw,r.battery_charge_kw,r.battery_discharge_kw,r.grid_import_kw,r.battery_soc_pct].forEach((x,i)=>{
        const td=el('td',String(x));td.style.cssText='padding:5px;border-top:1px solid #52627a;';
        if(i===6&&Number(x)>8.3){td.style.color='#ff9b82';td.style.fontWeight='bold';}
        tr.append(td);
      });body.append(tr);
   });
   t.append(body);table.replaceChildren(heading,t);
 }
 select.addEventListener('change',showDay);
 btn.addEventListener('click',async()=>{
   btn.disabled=true;status.textContent='Loading isolated test fixture…';
   try{
     const r=await fetch('fox-test-v09-data.json',{cache:'no-store'});
     if(!r.ok)throw Error('Fixture HTTP '+r.status);
     const payload=await r.json();
     if(payload.dataset_type!=='synthetic_test'||payload.learning_eligible!==false||payload.production_import_allowed!==false||!Array.isArray(payload.entries)||payload.entries.length!==480||!payload.entries.every(x=>x.source==='SYNTHETIC_TEST_ONLY'&&x.learning_eligible===false)){
       throw Error('Fixture safety/format validation failed');
     }
     entries=payload.entries;
     const days=[...new Set(entries.map(x=>x.timestamp_local.slice(0,10)))];
     if(days.length!==10||days.some(d=>entries.filter(x=>x.timestamp_local.startsWith(d)).length!==48))throw Error('Incomplete day coverage');
     const importKwh=kwh(entries,'grid_import_kw'),exportKwh=kwh(entries,'grid_export_kw');
     const solarKwh=kwh(entries,'solar_kw'),evKwh=kwh(entries,'ev_kw');
     const maxGrid=Math.max(...entries.map(x=>Number(x.grid_import_kw)));
     const overload=entries.filter(x=>Number(x.grid_import_kw)>8.3).length;
     status.textContent='TEST MODE ACTIVE · 480 synthetic intervals validated · Production learning remains 0 days from this test.';
     summary.textContent='Grid import: '+fmt(importKwh)+' kWh · Export: '+fmt(exportKwh)+' kWh\nSolar: '+fmt(solarKwh)+' kWh · EV: '+fmt(evKwh)+' kWh\nHighest simulated grid import: '+fmt(maxGrid)+' kW · Above provisional 8.3 kW: '+overload+' half-hour intervals\nThese are fixture calculations only, not measured energy or validated optimiser recommendations.';
     select.replaceChildren(...days.map(d=>{const opt=el('option',d);opt.value=d;return opt;}));
     select.style.display='block';showDay();
   }catch(e){status.textContent='Test not loaded: '+e.message;}
   finally{btn.disabled=false;}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
