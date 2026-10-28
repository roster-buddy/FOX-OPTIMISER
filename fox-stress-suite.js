/* v37: Synthetic stress scenarios; no hardware readings or dispatch. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const planner=node?require('./fox-prehardware-planner.js'):root.FoxPrehardwarePlanner;
const overnight=node?require('./fox-overnight-core.js'):root.FoxOvernightCore;
const ukClock=new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'});
function inputFor(day,houseKwh,price){
 let start=Date.parse(day+'T05:30:00Z');
 if(ukClock.format(new Date(start))!=='05:30')start-=3600000;
 const slots=Array.from({length:27},(_,i)=>({
  start:start+i*1800000,end:start+(i+1)*1800000,
  houseKwh,exportPence:i>=15&&i<19?price:10,headroomKw:3.5
 }));
 return {slots,capacityKwh:10,socPct:95,dischargeEfficiency:.9,
  forecastQuality:'SCENARIO_VALIDATED',peakImportPence:23.3,
  cheapImportPence:3.5,wearPence:5,solarOpportunityPence:12,
  batteryPowerKw:5,solarOriginVerified:true,
  tariffApplicableVerified:true,instantaneousHeadroomVerified:true};
}
function run(){
 const scenarios=[
  {name:'Summer · low house demand',input:inputFor('2026-06-15',.08,45)},
  {name:'Winter · high house demand',input:inputFor('2026-12-15',.26,45)},
  {name:'Unexpected household demand',input:inputFor('2026-10-28',.38,45)},
  {name:'Export headroom unavailable',input:inputFor('2026-10-28',.1,45)},
  {name:'Missing forecast interval',input:inputFor('2026-10-28',.1,45)}
 ];
 scenarios[3].input.slots.forEach(s=>s.headroomKw=0);
 scenarios[4].input.slots.splice(8,1);
 const results=scenarios.map(({name,input})=>{
  const r=planner.planDay(input);
  return {name,feasible:r.ok,reason:r.reason||null,
   simulatedExportKwh:r.ok?r.exportKwh:null,
   at19Pct:r.ok?100*r.at19Kwh/input.capacityKwh:null,
   dispatchApproved:false,accountingApproved:false};
 });
 const settings={evPercent:100,evCapacity:61.7,evKw:6.63,evEfficiency:90,
  gridKw:8.3,houseKw:.4,batteryKw:5,batteryEfficiency:90,
  capacity:10,soc:5,target:100,evConnect:'23:30',evDeadline:'05:30'};
 const night=overnight.simulate(settings,Date.parse('2026-10-28T18:00:00Z'));
 results.push({name:'Heavy EV and battery refill overnight',
  feasible:!night.gridExceeded&&!night.householdExceedsCap&&night.batteryShort<=1e-6&&night.evShort<=1e-6,
  reason:night.evShort>0||night.batteryShort>0?'Charging demand exceeds available cheap window':'Scenario feasible',
  simulatedExportKwh:null,at19Pct:null,dispatchApproved:false,accountingApproved:false});
 return results;
}
function setup(){
 const main=document.querySelector('main');if(!main||document.getElementById('foxStressPanel'))return;
 const panel=document.createElement('section');panel.className='panel';panel.id='foxStressPanel';
 const title=document.createElement('h3');title.textContent='Stress-test your future plan';
 const description=document.createElement('p');description.className='note';
 description.textContent='Six fictional test cases: seasonal demand, unexpected household use, lost export headroom, missing readings and competing EV charging. No live readings or battery commands.';
 const button=document.createElement('button');button.type='button';button.className='secondary';button.textContent='Run fictional stress tests';
 const output=document.createElement('div');output.id='foxStressResults';output.setAttribute('aria-live','polite');
 button.addEventListener('click',()=>{
  output.replaceChildren();
  for(const result of run()){
   const line=document.createElement('p');line.className='fox-stress-line';
   const strong=document.createElement('strong');strong.textContent=result.name+': ';
   line.append(strong,document.createTextNode(result.feasible?
    'Scenario feasible · '+(result.at19Pct===null?'overnight charge check':result.at19Pct.toFixed(1)+'% at 19:00 · '+result.simulatedExportKwh.toFixed(2)+' kWh hypothetical export'):
    'Blocked · '+(result.reason||'Insufficient forecast battery energy')));
   output.append(line);
  }
  const caution=document.createElement('p');caution.className='note';
  caution.textContent='PASS means only that the synthetic scenario passes its modelled constraints. It does not validate real forecasts, instantaneous DNO limits or physical fail-safe behaviour.';
  output.append(caution);
 });
 panel.append(title,description,button,output);main.append(panel);
}
const api={inputFor,run};
if(node)module.exports=api;else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})(typeof window!=='undefined'?window:globalThis);
