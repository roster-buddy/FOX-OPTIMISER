(() => {
'use strict';
const ID='foxAgileV14';
const el=(tag,text)=>{const x=document.createElement(tag);if(text!==undefined)x.textContent=text;return x};
const fmt=n=>Number(n).toFixed(2);
const ukParts=d=>{const p=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(d);return Object.fromEntries(p.map(x=>[x.type,x.value]))};
function init(){
 if(document.getElementById(ID))return;
 const main=document.querySelector('main');if(!main)return;
 const box=el('section');box.id=ID;box.className='panel';box.style.cssText='margin:18px 0;padding:18px;border:1px solid #5278aa;border-radius:14px';
 box.append(el('h3','Outgoing Agile half-hour export planner · v1.4'));
 const intro=el('p','READ-ONLY financial scenario. Uses published Octopus prices when available; battery SOC and home use are manual estimates, NOT measurements. No Fox, Ohme, Home Assistant or inverter control.');intro.className='note';box.append(intro);
 const fields=el('div');fields.style.cssText='display:flex;gap:10px;flex-wrap:wrap';const cfg={};
 for(const [k,label,v,min,max] of [['soc','Estimated battery SOC (%)',100,5,100],['capacity','Usable battery (kWh)',9,1,100],['reserve','Energy to preserve (kWh)',2,0,100],['home','Expected house use until 23:30 (kWh)',2,0,100],['limit','Net export cap (kW)',3.5,0,50],['eff','Discharge efficiency (%)',95,1,100],['peak','Avoided import (p/kWh)',28,0,100]]){
  const l=el('label',label);l.style.cssText='display:flex;flex-direction:column;gap:4px;font-size:12px';const i=el('input');i.type='number';i.min=min;i.max=max;i.step='.01';i.value=v;i.style.cssText='width:140px;padding:8px';l.append(i);fields.append(l);cfg[k]=i;
 }box.append(fields);
 const controls=el('div');controls.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:12px 0';
 const live=el('button','Load published Agile prices');const sample=el('button','Run clearly labelled sample prices');live.type=sample.type='button';controls.append(live,sample);box.append(controls);
 const status=el('p','No price data loaded.');status.setAttribute('aria-live','polite');box.append(status);
 const result=el('div');result.style.cssText='white-space:pre-line;line-height:1.7';box.append(result);
 const table=el('div');table.style.cssText='overflow-x:auto';box.append(table);
 main.append(box);
 function plan(data,source){
  const c=Object.fromEntries(Object.entries(cfg).map(([k,x])=>[k,Number(x.value)]));
  if(Object.values(c).some(x=>!Number.isFinite(x)||x<0)||c.soc>100||c.eff<=0||c.eff>100||c.reserve>c.capacity)throw Error('Invalid battery, reserve or efficiency values.');
  const stored=c.capacity*c.soc/100;
  // Protect physical reserve AND estimated evening household use; neither is a real forecast.
  let exportable=Math.max(0,stored-c.reserve-c.home);
  const initial=exportable;
  const eligible=data.filter(r=>{const p=ukParts(new Date(r.from));const h=+p.hour,m=+p.minute;return h>=16&&h<19&&[0,30].includes(m)}).sort((a,b)=>b.price-a.price);
  const chosen=[];let gross=0;
  for(const r of eligible){
   if(exportable<=.00001)break;
   // 30-minute price interval, instantaneous export cap, battery-side efficiency.
   const delivered=Math.min(exportable*c.eff/100,c.limit*.5);
   if(delivered<=0)break;
   const fromBattery=delivered/(c.eff/100);
   exportable-=fromBattery;
   gross+=delivered*r.price/100;
   chosen.push({...r,delivered,fromBattery});
  }
  const retained=stored-chosen.reduce((a,r)=>a+r.fromBattery,0);
  const selfUseValue=chosen.reduce((a,r)=>a+r.fromBattery*c.eff/100*c.peak/100,0);
  const net=gross-selfUseValue;
  status.textContent=source+' · '+data.length+' price intervals available · '+eligible.length+' eligible 16:00–19:00 intervals.';
  result.textContent='SIMULATION ONLY · No physical export scheduled\n'+
    'Estimated stored battery energy: '+fmt(stored)+' kWh\n'+
    'Protected physical reserve: '+fmt(c.reserve)+' kWh\n'+
    'Protected estimated household energy: '+fmt(c.home)+' kWh\n'+
    'Battery energy available for possible export: '+fmt(initial)+' kWh\n'+
    'Modelled grid export: '+fmt(chosen.reduce((a,r)=>a+r.delivered,0))+' kWh\n'+
    'Modelled export revenue: £'+fmt(gross)+'\n'+
    'Illustrative self-use opportunity value: £'+fmt(selfUseValue)+'\n'+
    'Export revenue less self-use opportunity value: £'+fmt(net)+'\n'+
    'Battery energy remaining: '+fmt(retained)+' kWh\n'+
    (net<0?'At the entered avoided-import price, retaining this energy may be better than exporting.':'Export may be attractive under these assumptions.')+'\n'+
    'IMPORTANT: Candidate slots are price-ranked, not a validated sequential SOC dispatch. No forced export at or after 19:00. 3.5 kW is an instantaneous net-export cap, not a daily energy limit. Prices may be missing or unpublished; household use, losses and future import are estimates. Does not include degradation or standing charges.';
  const t=el('table');t.style.cssText='width:100%;font-size:13px;border-collapse:collapse';const head=el('tr');for(const x of ['UK time','Agile p/kWh','Export kWh','Revenue'])head.append(el('th',x));t.append(head);
  for(const r of chosen.sort((a,b)=>a.from.localeCompare(b.from))){const p=ukParts(new Date(r.from));const tr=el('tr');for(const x of [p.day+'/'+p.month+' '+p.hour+':'+p.minute,fmt(r.price),fmt(r.delivered),'£'+fmt(r.delivered*r.price/100)]){const td=el('td',x);td.style.padding='7px';td.style.borderTop='1px solid #52627a';tr.append(td)}t.append(tr)}
  table.replaceChildren(t);
 }
 function run(data,source){try{plan(data,source)}catch(e){status.textContent='Cannot calculate: '+e.message}}
 sample.addEventListener('click',()=>{
  const d=new Date();const p=ukParts(d);const day=p.year+'-'+p.month+'-'+p.day;
  const rates=[5,8,16,32,21,9];const data=rates.map((price,i)=>({from:day+'T'+String(16+Math.floor(i/2)).padStart(2,'0')+':'+(i%2?'30':'00')+':00Z',price}));
  // Convert each local UK clock slot to UTC using date formatting, preserving BST/GMT correctly.
  const parsed=data.map((r,i)=>{const hour=16+Math.floor(i/2),minute=i%2?30:0;let d=new Date(day+'T'+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0')+':00Z');for(let j=0;j<3;j++){const u=ukParts(d),offset=(hour-(+u.hour))*60+minute-(+u.minute);if(!offset)break;d=new Date(d.getTime()+offset*60000)}return {from:d.toISOString(),price:r.price}});
  run(parsed,'SAMPLE PRICES ONLY (invented, not live)');
 });
 live.addEventListener('click',async()=>{
  live.disabled=true;status.textContent='Loading public Octopus rates…';
  try{
   const saved=JSON.parse(localStorage.getItem('fox-settings')||'{}');const tariff=String(saved.tariff||'E-1R-AGILE-OUTGOING-19-05-13-E');
   if(!/^E-1R-AGILE-OUTGOING-[A-Z0-9-]+$/.test(tariff))throw Error('Unexpected Outgoing Agile tariff code in app settings.');
   const product=tariff.replace(/^E-1R-/,'').replace(/-[A-H]$/,'');
   const now=new Date();const end=new Date(now.getTime()+48*3600000);
   const url='https://api.octopus.energy/v1/products/'+encodeURIComponent(product)+'/electricity-tariffs/'+encodeURIComponent(tariff)+'/standard-unit-rates/?period_from='+encodeURIComponent(now.toISOString())+'&period_to='+encodeURIComponent(end.toISOString())+'&page_size=250';
   const ctrl=new AbortController();const timeout=setTimeout(()=>ctrl.abort(),18000);
   let res;try{res=await fetch(url,{signal:ctrl.signal})}finally{clearTimeout(timeout)}
   if(!res.ok)throw Error('Octopus returned HTTP '+res.status);
   const j=await res.json();if(!Array.isArray(j.results)||!j.results.length)throw Error('No published intervals yet.');
   const data=j.results.filter(x=>x.valid_from&&Number.isFinite(Number(x.value_inc_vat))).map(x=>({from:x.valid_from,price:Number(x.value_inc_vat)}));
   run(data,'PUBLISHED OCTOPUS RATES (not a bill or live meter)');
  }catch(e){status.textContent='Live price request unavailable: '+e.message+'. Try sample mode; no prices have been invented as live.'}
  finally{live.disabled=false}
 });
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();