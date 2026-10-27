
(function(){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const forecast=node?require('./fox-forecast-v23.js'):window.FoxForecastResearch;
const checks=node?require('./fox-data-checks-v24.js'):window.FoxDataResearch;

function test(kind){
 if(!forecast||!checks)throw Error('Required research modules missing');
 const result=forecast.run('adaptive',1,1,x=>{
  const now=100000000+x.clock*3600000;
  const outage=x.clock>=16&&x.clock<17;
  let readings={
   soc:{value:x.soc,at:now},
   solarKW:{value:0,at:now},
   homeKW:{value:.3,at:now}
  };
  if(outage&&kind==='missing')readings.soc=null;
  if(outage&&kind==='stale')readings.soc.at=now-180000;
  return checks.gate(now,readings,x.requestedKW);
 });
 const outage=result.trace.filter(x=>x.clock>=16&&x.clock<17);
 const after=result.trace.filter(x=>x.clock>=17&&x.clock<19);
 return {
  ...result,
  outageExport:outage.reduce((n,x)=>n+x.forced,0),
  recoveredExport:after.reduce((n,x)=>n+x.forced,0),
  blocked:outage.filter(x=>x.reason!=='Data checks passed').length
 };
}

if(node){module.exports={test};return;}
const panel=document.createElement('section');
panel.className='panel';
panel.style.cssText='padding:20px;margin:20px 0;border:1px solid #52718c;border-radius:16px';
panel.innerHTML=`
<h3>Replanning with data outages · v2.5</h3>
<p>SYNTHETIC INTEGRATION TEST. Missing or stale battery readings
from 16:00–17:00 block forced exports. Fresh simulated readings
return at 17:00. No live data or hardware commands.</p>
<button type="button">Run integrated outage tests</button>
<div aria-live="polite"></div>
<p>This tests export gating at half-hour boundaries. Simulated
battery state and forecasts remain available to the research
planner. Delayed-state estimation, continuous watchdog protection
and physical inverter behaviour are not tested.</p>`;
(document.querySelector('main')||document.body).append(panel);
panel.querySelector('button').onclick=()=>{
 const out=panel.querySelector('[aria-live]');
 out.replaceChildren();
 for(const kind of ['missing','stale']){
  const r=test(kind),p=document.createElement('p');
  const ok=r.blocked===2&&r.outageExport===0&&r.recoveredExport>0;
  p.textContent=kind+': '+(ok?'PASS':'FAIL')+
   ' — blocked intervals '+r.blocked+
   '; forced export during outage '+r.outageExport.toFixed(4)+
   ' kWh; forced export after recovery '+r.recoveredExport.toFixed(2)+
   ' kWh; 19:00 SOC '+r.at19.toFixed(2)+'% ('+
   (r.pass?'reserve PASS':'reserve MISS')+').';
  out.append(p);
 }
};
})();
