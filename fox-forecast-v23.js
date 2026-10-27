/* Synthetic research only. No network or hardware commands. */
(function(){
'use strict';

function run(mode,solarFactor,loadFactor){
 const capacity=10.24,eff=.95,min=capacity*.05,target=capacity*.20;
 const clocks=Array.from({length:36},(_,i)=>5.5+i*.5);
 const solar=clocks.map(t=>Math.max(0,Math.sin((t-7)/11*Math.PI))*(t<18?.32:0));
 const prices=clocks.map(t=>t>=16&&t<19?35:8);
 let energy=capacity,scale=1,loadScale=1,at19=null;
 let grid=0,cancelled=0,residual=0;
 let actualForced=0,actualNatural=0;
 let shortfallIntervals=0,exportDuringShortfall=0;

 function step(e,pv,h,request){
  const solarHome=Math.min(pv,h);
  const deficit=h-solarHome,surplus=pv-solarHome;
  const batteryHome=Math.min(deficit,2.5*eff,Math.max(0,(e-min)*eff));
  const afterHome=e-batteryHome/eff;
  const charge=Math.min(surplus,2.5,Math.max(0,(capacity-afterHome)/eff));
  const natural=Math.min(1.75,surplus-charge);
  const curtail=surplus-charge-natural;
  const forced=charge>1e-9?0:Math.min(
   request,1.75-natural,
   Math.max(0,(2.5-batteryHome/eff)*eff),
   Math.max(0,(afterHome-min)*eff)
  );
  return {
   end:afterHome+charge*eff-forced/eff,
   batteryHome,charge,natural,curtail,forced,
   grid:deficit-batteryHome,solarHome
  };
 }

 function plan(start,e,pv,home){
  const actions=Array(36).fill(0);
  const order=clocks.map((_,i)=>i)
   .filter(i=>i>=start&&clocks[i]<19)
   .sort((a,b)=>prices[b]-prices[a]||a-b);
  function feasible(a){
   let x=e,checkpoint=null;
   for(let j=start;j<36;j++){
    x=step(x,pv[j],home[j],a[j]).end;
    if(clocks[j]===18.5)checkpoint=x;
   }
   return checkpoint===null||checkpoint>=target-1e-8;
  }
  // If even zero forced export misses the target,
  // request no further forced exports.
  if(!feasible(actions)){
   actions.infeasible=true;
   return actions;
  }
  for(const i of order){
   for(let q=0;q<18;q++){
    actions[i]+=.1;
    if(!feasible(actions)){
     actions[i]-=.1;
     break;
    }
   }
  }
  return actions;
 }

 const initial=plan(0,energy,solar,clocks.map(()=>.15));
 for(let i=0;i<36;i++){
  const actualPV=solar[i]*(clocks[i]>=12?solarFactor:1);
  const actualHome=.15*(clocks[i]>=12?loadFactor:1);
  // Replanning uses completed observations only, never future actual data.
  const remaining=mode==='adaptive'
   ?plan(i,energy,solar.map(x=>x*scale),clocks.map(()=>.15*loadScale))
   :initial;
  const z=step(energy,actualPV,actualHome,remaining[i]);
  if(remaining.infeasible){
   shortfallIntervals++;
   exportDuringShortfall+=z.forced;
  }
  cancelled+=Math.max(0,initial[i]-remaining[i]);
  residual=Math.max(
   residual,
   Math.abs(energy+z.charge*eff-(z.batteryHome+z.forced)/eff-z.end),
   Math.abs(actualPV-z.solarHome-z.charge-z.natural-z.curtail),
   Math.abs(actualHome-z.solarHome-z.batteryHome-z.grid)
  );
  actualForced+=z.forced;
  actualNatural+=z.natural;
  energy=z.end;
  grid+=z.grid;
  if(clocks[i]===18.5)at19=energy/capacity*100;
  if(solar[i]>.001)scale=actualPV/solar[i];
  loadScale=actualHome/.15;
 }
 return {
  at19,end:energy,grid,cancelled,residual,actualForced,actualNatural,shortfallIntervals,exportDuringShortfall,
  pass:at19>=20-1e-7
 };
}

if(typeof module!=='undefined')module.exports={run};
if(typeof document==='undefined')return;

const section=document.createElement('section');
section.id='foxForecastV23';
section.style.cssText='padding:20px;margin:20px 0;border:1px solid #52718c;border-radius:16px;background:#101d30;color:#e5edf7';
section.innerHTML=`
<h3>Forecast errors & replanning · v2.3.3</h3>
<p>SYNTHETIC RESEARCH ONLY. Uses hypothetical prices and solar,
not historical results or live readings. At noon, solar or household
use changes unexpectedly. Adaptive mode updates its forecast from
completed half-hours. Target: 20% SOC at 19:00, no extra buffer.
No hardware commands.</p>
<button type="button">Run forecast-error comparisons</button>
<div aria-live="polite"></div>
<p>This half-hour model uses a 3.5 kW net export cap, 5 kW battery
charge/discharge limits and 5% minimum SOC. It does not test physical
instantaneous enforcement. Financial benefit, wear and overnight
charging are outside this test.</p>`;

(document.querySelector('main')||document.body).append(section);

section.querySelector('button').onclick=()=>{
 const out=section.querySelector('[aria-live]');
 out.replaceChildren();
 const scenarios=[
  ['Forecast matches',1,1],
  ['Solar falls 50% at noon',.5,1],
  ['Home demand doubles at noon',1,2],
  ['Both changes at noon',.5,2],
  ['Extreme: no solar and 5x home demand from noon',0,5]
 ];
 for(const [name,pv,h] of scenarios){
  const a=run('fixed',pv,h),b=run('adaptive',pv,h);
  const p=document.createElement('p');
  p.textContent=name+
   ': fixed 19:00 SOC '+a.at19.toFixed(2)+'% ('+
   (a.pass?'PASS':'MISS')+'); adaptive '+
   b.at19.toFixed(2)+'% ('+(b.pass?'PASS':'MISS')+
   '). Adaptive grid use '+b.grid.toFixed(2)+
   ' kWh. Actual forced battery export: fixed '+
   a.actualForced.toFixed(2)+' kWh; adaptive '+
   b.actualForced.toFixed(2)+' kWh. Net reduction '+
   (a.actualForced-b.actualForced).toFixed(2)+
   ' kWh (negative means adaptive exports more). '+
   'Adaptive solar surplus export '+
   b.actualNatural.toFixed(2)+' kWh. Reserve-shortfall intervals '+b.shortfallIntervals+'; forced export during those intervals '+b.exportDuringShortfall.toFixed(4)+' kWh. Energy residual '+
   b.residual.toFixed(8)+' kWh.';
  out.append(p);
 }
};
})();
