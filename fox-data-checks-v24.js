
(function(){
'use strict';
function gate(now,data,requestedKW){
 if(!Number.isFinite(now)||
    !Number.isFinite(requestedKW)||requestedKW<0)
  return {kw:0,reason:'Invalid request or clock'};
 for(const key of ['soc','solarKW','homeKW']){
  const x=data?.[key];
  if(!x||!Number.isFinite(x.value)||!Number.isFinite(x.at))
   return {kw:0,reason:'Missing or invalid '+key};
  const age=now-x.at;
  if(age<0||age>120000)
   return {kw:0,reason:'Stale or future-dated '+key};
  if(x.value<0||(key==='soc'&&x.value>100))
   return {kw:0,reason:'Out-of-range '+key};
 }
 return {kw:Math.min(requestedKW,3.5),reason:'Data checks passed'};
}

function cases(){
 const now=1000000;
 const fresh={
  soc:{value:80,at:now},
  solarKW:{value:0,at:now},
  homeKW:{value:.3,at:now}
 };
 return [
  ['Fresh readings',gate(now,fresh,2),2],
  ['Fresh readings, excessive request',gate(now,fresh,5),3.5],
  ['Readings three minutes old',gate(now+180000,fresh,2),0],
  ['Missing battery reading',gate(now,{...fresh,soc:null},2),0],
  ['Invalid solar reading',gate(now,{
   ...fresh,solarKW:{value:NaN,at:now}
  },2),0],
  ['Future-dated household reading',gate(now,{
   ...fresh,homeKW:{value:.3,at:now+1000}
  },2),0],
  ['Readings recover',gate(now,fresh,2),2]
 ];
}

if(typeof module!=='undefined')module.exports={gate,cases};
if(typeof window!=='undefined')window.FoxDataResearch={gate};
if(typeof document==='undefined')return;
const section=document.createElement('section');
section.style.cssText=
 'padding:20px;margin:20px 0;border:1px solid #52718c;'+
 'border-radius:16px;background:#101d30;color:#e5edf7';
section.innerHTML=`
<h3>Missing & stale data checks · v2.4</h3>
<p>SYNTHETIC UNIT DEMONSTRATION. No live readings or hardware commands.
Battery SOC, solar power and household power must all be valid and no
more than two minutes old. This provisional threshold is for testing.</p>
<button type="button">Run data checks</button>
<div aria-live="polite"></div>
<p>Passing these checks alone does not authorise export. Reserve,
price, inverter and net grid power checks are still required.
This gate is not yet integrated into the replanning simulation or
a live controller. The 3.5 kW request cap alone cannot enforce the
total instantaneous grid export limit.</p>`;
(document.querySelector('main')||document.body).append(section);
section.querySelector('button').onclick=()=>{
 const out=section.querySelector('[aria-live]');
 out.replaceChildren();
 for(const [name,r,expected] of cases()){
  const p=document.createElement('p');
  p.textContent=name+': '+(r.kw===expected?'PASS':'FAIL')+
   ' — export recommendation '+r.kw.toFixed(2)+
   ' kW. '+r.reason;
  out.append(p);
 }
};
})();
