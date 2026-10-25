(() => {
'use strict';
const KEY='fox-charging-v06-settings';
const defaults={evPercent:15,evDeadline:'04:00',evCapacity:61.7,evKw:6.63,evEfficiency:90,gridKw:8.3,houseKw:0.4,batteryKw:5,batteryEfficiency:90};
let cfg={...defaults};try{cfg={...cfg,...JSON.parse(localStorage.getItem(KEY)||'{}')}}catch{}
const n=(v,d)=>Number.isFinite(+v)?+v:d;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const pad=x=>String(x).padStart(2,'0');
const localDate=d=>`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
const time=d=>`${pad(d.getHours())}:${pad(d.getMinutes())}`;
const dateKey=d=>`${localDate(d)}T${time(d)}`;
const isFree=t=>t==='happy'||t==='legacy'; // Only explicitly marked free sessions; Power Up is not assumed free.
const typeAt=d=>{const x=window.foxOctopusSessions?.getForDay?.(localDate(d));if(!x)return null;const key=dateKey(d);if(Array.isArray(x))return x.find(v=>v?.key===key||v?.start===key)?.type||null;if(typeof x==='object')return x[key]?.type||x[time(d)]?.type||null;return null};

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
 node.textContent=rows.join('\n');
}
async function refreshLearning(){
 try{const r=await fetch('/api/status',{cache:'no-store'});if(!r.ok)throw Error('offline');const data=await r.json();solarState.loggerOnline=true;solarState.learningDays=Number(data.valid_days)||0;solarState.learningComplete=data.learning_complete===true;}
 catch{solarState.loggerOnline=false;solarState.learningComplete=false;solarState.learningDays=0;}
 solarCard();
}

function render(){
 const now=new Date(), start=new Date(now);start.setHours(23,30,0,0);if(now>=start)start.setDate(start.getDate()+1);
 const end=new Date(start);end.setDate(end.getDate()+1);end.setHours(5,30,0,0);
 const deadline=new Date(start);deadline.setDate(deadline.getDate()+1);const [h,m]=cfg.evDeadline.split(':').map(Number);deadline.setHours(h,m,0,0);if(deadline<start)deadline.setDate(deadline.getDate()+1);
 const deadlineOutsideWindow=deadline>end;
  const evNeed=cfg.evCapacity*cfg.evPercent/100/(cfg.evEfficiency/100), batteryCapacity=n(document.querySelector('[name="capacity"]')?.value,9), soc=clamp(n(document.querySelector('[name="soc"]')?.value,50),0,100);
 const batteryNeed=Math.max(0,batteryCapacity*(100-soc)/100/(cfg.batteryEfficiency/100));
 let evLeft=evNeed,batLeft=batteryNeed,evDelivered=0,batDelivered=0,freeImport=0,paidImport=0,freeMinutes=0;
 const slots=[];for(let t=new Date(start);t<end;t=new Date(t.getTime()+1800000))slots.push(new Date(t));
 // Prioritise the EV against its deadline, then use remaining grid headroom for battery charging.
 // This is an advisory model; actual Ohme scheduling remains authoritative.
 const rows=slots.map((t,i)=>{
   const before=t<deadline;
   const remaining=slots.slice(i).filter(x=>x<deadline).length;
   const household=cfg.houseKw;
   const available=Math.max(0,cfg.gridKw-household);
   const minEv=before&&remaining>0?Math.min(cfg.evKw,evLeft*2,Math.max(0,evLeft*2-(remaining-1)*cfg.evKw)):0;
   const evPower=before?Math.min(cfg.evKw,available,Math.max(minEv,Math.min(cfg.evKw,evLeft*2))):0;
   const actualEv=Math.min(evLeft,evPower*0.5);evLeft=Math.max(0,evLeft-actualEv);evDelivered+=actualEv;
   const batteryPower=Math.min(cfg.batteryKw,Math.max(0,available-evPower),batLeft*2);
   const actualBattery=Math.min(batLeft,batteryPower*.5);batLeft=Math.max(0,batLeft-actualBattery);batDelivered+=actualBattery;
   const used=(household+evPower+batteryPower)*.5;
   const free=isFree(typeAt(t));if(free){freeImport+=used;freeMinutes+=30}else paidImport+=used;
   return {at:time(t),ev:evPower,bat:batteryPower,grid:household+evPower+batteryPower,free};
 });
 const fmt=x=>x.toFixed(2);
 const status=document.getElementById('foxChargeStatus');
 const evOK=evLeft<.05,batOK=batLeft<.05;
  if(deadlineOutsideWindow) { status.title='EV deadline is after 05:30. This simulation only models the 23:30–05:30 overnight window.'; } else { status.removeAttribute('title'); }
 status.textContent=`EV: ${fmt(evDelivered)} / ${fmt(evNeed)} kWh from mains by ${cfg.evDeadline} (${evOK?'feasible':'SHORT '+fmt(evLeft)+' kWh'}). Battery: ${fmt(batDelivered)} / ${fmt(batteryNeed)} kWh from mains (${batOK?'target feasible':'SHORT '+fmt(batLeft)+' kWh'}). Grid import cap: ${cfg.gridKw.toFixed(1)} kW (provisional).`;
 const tbody=document.getElementById('foxChargeRows');tbody.replaceChildren();
 for(const r of rows){const tr=document.createElement('tr');for(const x of [r.at,fmt(r.ev),fmt(r.bat),fmt(r.grid),r.free?'Booked free session*':'Intelligent Go · cheap']){const td=document.createElement('td');td.textContent=x;td.style.padding='7px 5px';tr.append(td)}tbody.append(tr)}
 document.getElementById('foxChargeFoot').textContent=`Estimated scheduled import: ${fmt(freeImport)} kWh in marked free slots and ${fmt(paidImport)} kWh in other slots. *The 23:30–05:30 period is shown as Intelligent Octopus Go cheap-rate unless a booked free session is explicitly marked. Free import is subject to Octopus eligibility, booked-hour allowances and actual metering. This is a planning estimate, not a bill or live Ohme reading.`;
}
function setup(){
 if(document.getElementById('foxChargingV06'))return;
 const host=document.querySelector('#v4Calendar')?.closest('section')||document.querySelector('main');if(!host)return;
 const panel=document.createElement('section');panel.className='panel';panel.id='foxChargingV06';
 panel.innerHTML=`<h3>EV + home battery charging planner</h3><p class="note">Read-only simulation · EV windows are estimates, NOT Ohme's actual schedule · Recalculates every 30 seconds</p><div id="foxChargeInputs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:10px"></div><p id="foxChargeStatus" aria-live="polite"></p><div style="overflow-x:auto"><table style="width:100%;font-size:13px;border-collapse:collapse"><thead><tr><th>Time</th><th>EV kW</th><th>Battery kW</th><th>Grid kW</th><th>Tariff</th></tr></thead><tbody id="foxChargeRows"></tbody></table></div><p id="foxChargeFoot" class="note"></p><p class="note">Battery target 100% during learning. Solar is not assumed overnight. House demand and grid headroom are provisional. Ohme's real schedule and Octopus Charge Pack remain in control. No live data or hardware commands.</p>`;
 host.insertAdjacentElement('afterend',panel);

const solarPanel=document.createElement('section');
solarPanel.className='panel';
solarPanel.id='foxSolarAwareV08Panel';
solarPanel.innerHTML='<h3>Solar-aware overnight battery planning · v0.8</h3><p class="note">Forecast scenario only. Active battery target remains 100% during learning.</p><div id="foxSolarAwareV08" style="white-space:pre-line;line-height:1.8"></div>';
panel.insertAdjacentElement('afterend',solarPanel);

 const fields=[['evPercent','EV top-up (%)',1,100,1],['evDeadline','EV ready by (HH:MM)',null,null,null],['gridKw','Shared grid import cap (kW)',1,30,.1],['houseKw','House demand (kW)',0,15,.1],['evKw','EV charging power (kW)',0,22,.1],['batteryKw','Battery max charging power (kW)',0,20,.1],['evCapacity','EV usable capacity (kWh)',1,150,.1],['evEfficiency','EV charging efficiency (%)',50,100,1],['batteryEfficiency','Battery charging efficiency (%)',50,100,1]];
 const wrap=panel.querySelector('#foxChargeInputs');
 for(const [key,label,min,max,step] of fields){const lab=document.createElement('label');lab.textContent=label;const input=document.createElement('input');input.dataset.key=key;input.type=key==='evDeadline'?'time':'number';input.value=cfg[key];if(min!==null){input.min=min;input.max=max;input.step=step}input.addEventListener('change',()=>{if(key==='evDeadline'){cfg[key]=/^\d{2}:\d{2}$/.test(input.value)?input.value:'04:00'}else{cfg[key]=clamp(n(input.value,defaults[key]),min,max)}input.value=cfg[key];localStorage.setItem(KEY,JSON.stringify(cfg));render()});lab.append(input);wrap.append(lab)}
 render();solarCard();refreshLearning();setInterval(()=>{render();solarCard()},30000);setInterval(refreshLearning,60000);
 document.querySelector('[name="soc"]')?.addEventListener('change',render);
 document.querySelector('[name="capacity"]')?.addEventListener('change',render);
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
window.foxChargingPlannerV06={refresh:render};
window.foxSolarAwareRefreshV08=solarCard;
})();
