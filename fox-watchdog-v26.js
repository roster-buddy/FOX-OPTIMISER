
(function(){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const gate=node
 ?require('./fox-data-checks-v24.js').gate
 :window.FoxDataResearch?.gate;

function createWatchdog(){
 let activeId=null,lastTime=null;
 const invalidated=new Set();
 function stop(reason){
  if(activeId!==null)invalidated.add(activeId);
  activeId=null;
  return {kw:0,reason};
 }
 return {
  tick(now,readings,plan){
   if(!Number.isFinite(now))return stop('Invalid clock');
   if(lastTime!==null&&now<lastTime)
    return stop('Clock moved backwards');
   lastTime=now;
   if(!plan||typeof plan.id!=='string'||!plan.id.trim())
    return stop('No valid plan');
   if(!Number.isFinite(plan.createdAt)||
      !Number.isFinite(plan.expiresAt)||
      plan.createdAt>now||plan.expiresAt<=now||
      plan.expiresAt<=plan.createdAt){
    invalidated.add(plan.id);
    return stop('Plan expired or invalid');
   }
   if(invalidated.has(plan.id))
    return stop('New plan required after interruption');
   if(typeof gate!=='function')
    return stop('Data checker unavailable');
   const result=gate(now,readings,plan.kw);
   if(result.kw<=0){
    invalidated.add(plan.id);
    return stop(result.reason);
   }
   activeId=plan.id;
   return {kw:result.kw,reason:'Recommendation active'};
  }
 };
}

function demonstration(){
 const w=createWatchdog(),start=1000000;
 const readings=at=>({
  soc:{value:80,at},
  solarKW:{value:0,at},
  homeKW:{value:.3,at}
 });
 const p={id:'plan-A',kw:2,createdAt:start,expiresAt:start+600000};
 const rows=[];
 function add(name,now,data,plan,expected){
  const result=w.tick(now,data,plan);
  rows.push({name,...result,expected,pass:result.kw===expected});
 }
 add('Fresh readings',start,readings(start),p,2);
 add('Readings exactly two minutes old',
     start+120000,readings(start),p,2);
 add('Readings exceed freshness limit',
     start+121000,readings(start),p,0);
 add('Fresh readings return, old plan retained',
     start+122000,readings(start+122000),p,0);
 const next={
  id:'plan-B',kw:2,createdAt:start+123000,
  expiresAt:start+180000
 };
 add('Fresh readings and new plan',
     start+123000,readings(start+123000),next,2);
 add('Plan expires despite fresh readings',
     start+180000,readings(start+180000),next,0);
 return rows;
}

if(node){module.exports={createWatchdog,demonstration};return;}

const section=document.createElement('section');
section.className='panel';
section.style.cssText='padding:20px;margin:20px 0;border:1px solid #52718c;border-radius:16px';
section.innerHTML=`
<h3>Export watchdog simulation · v2.6</h3>
<p>SYNTHETIC STATE-MACHINE TEST. Checks freshness and plan expiry
on each simulated tick. An interrupted plan cannot resume until
a new plan ID is supplied.</p>
<button type="button">Run watchdog simulation</button>
<div aria-live="polite"></div>
<p>No live watchdog or inverter commands. These are simulated
recommendations, not confirmation that physical export stopped.
A real controller still needs independent scheduling, command
acknowledgements and verified inverter feedback.</p>`;
(document.querySelector('main')||document.body).append(section);
section.querySelector('button').onclick=()=>{
 const out=section.querySelector('[aria-live]');
 out.replaceChildren();
 for(const r of demonstration()){
  const p=document.createElement('p');
  p.textContent=r.name+': '+(r.pass?'PASS':'FAIL')+
   ' — '+r.kw.toFixed(2)+' kW. '+r.reason;
  out.append(p);
 }
};
})();
