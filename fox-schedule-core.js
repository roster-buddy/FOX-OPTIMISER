
/* Approximate half-hour scheduler:
   0.05 kWh state buckets and 0.10 kWh export actions.
   No device commands or claim of a global continuous optimum. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const energy=node?require('./fox-energy-core.js'):root.FoxEnergyCore;
const finance=node?require('./fox-finance-core.js'):root.FoxFinanceCore;

function validate(c,slots){
 if(!slots.length||
    ![c.initial,c.target,c.forcedFloor,c.refillP,c.wearP].every(Number.isFinite)||
    c.initial<0||c.initial>c.capacity||
    c.target<c.min||c.target>c.capacity)
  throw Error('Invalid schedule configuration');
 for(let i=0;i<slots.length;i++){
  const s=slots[i];
  if(![s.solar,s.house,s.price,s.importP].every(Number.isFinite)||
     s.solar<0||s.house<0)
   throw Error('Missing or invalid schedule inputs');
  if(!Number.isFinite(Date.parse(s.utc)))
   throw Error('Invalid interval timestamp');
  if(i&&Date.parse(s.utc)-Date.parse(slots[i-1].utc)!==1800000)
   throw Error('Price horizon has gaps or duplicate intervals');
 }
}

function prepare(c,s,e,request){
 const f=energy.flow(
  {...c,dischargeKW:s.cheap?0:c.dischargeKW},
  e,s.solar,s.house,
  !s.cheap&&s.allowExport&&s.price>0?request:0,
  c.forcedFloor
 );
 let chargeGrid=0;
 if(s.cheap){
  chargeGrid=Math.min(
   Math.max(0,c.chargeKW*.5-f.charge),
   Math.max(0,(c.capacity-f.end)/c.eff)
  );
  f.end+=chargeGrid*c.eff;
  f.afterSolar=f.end;
 }
 return {
  clock:s.clock,utc:s.utc,solar:s.solar,house:s.house,price:s.price,
  solarHome:f.solarHome,solarStored:f.solarStored,
  naturalExport:f.natural,curtailed:f.curtail,
  batteryHome:f.batteryHome,grid:f.grid+chargeGrid,
  chargeGrid,forced:f.forced,ending:f.end,afterSolar:f.afterSolar,
  importP:s.importP,cheap:!!s.cheap,checkpoint:!!s.checkpoint
 };
}

function finish(c,steps){
 const sum=fn=>steps.reduce((a,s)=>a+fn(s),0);
 const revenue=sum(s=>(s.naturalExport+s.forced)*s.price/100);
 const importCost=sum(s=>s.grid*s.importP/100);
 const dischargeStored=sum(s=>(s.batteryHome+s.forced)/c.eff);
 const end=steps.at(-1).ending;
 const financial=finance.settle(
  {revenue,importCost,dischargeStored,end},c
 );
 const checkpoints=steps.filter(s=>s.checkpoint);
 return {
  ok:true,steps,end,revenue,importCost,dischargeStored,financial,
  grid:sum(s=>s.grid),forced:sum(s=>s.forced),
  score:revenue-importCost,
  reached19:checkpoints.length>0,
  at19:checkpoints[0]?.ending,
  valid:checkpoints.every(s=>s.ending>=c.target-1e-7)
 };
}

function replay(c,slots,requests=[]){
 validate(c,slots);
 let e=c.initial;
 const steps=[];
 for(let i=0;i<slots.length;i++){
  const s=prepare(c,slots[i],e,requests[i]||0);
  steps.push(s);
  e=s.ending;
 }
 return finish(c,steps);
}

function solve(c,slots,allowForced=true){
 validate(c,slots);
 if(!allowForced){
  const r=replay(c,slots);
  return r.valid?r:{
   ok:false,reason:'Self-use forecast misses 20% at 19:00'
  };
 }
 if(!slots.some(s=>s.checkpoint))return replay(c,slots);

 const quantum=.05,action=.1;
 const credit=c.refillP/(100*c.eff);
 const history=[];
 let states=new Map([
  [Math.round(c.initial/quantum),
   {energy:c.initial,utility:0,prev:null}]
 ]);

 for(const slot of slots){
  const next=new Map();
  for(const [oldKey,st] of states){
   const f=prepare(c,slot,st.energy,Number.MAX_VALUE);
   const n=Math.ceil(f.forced/action);
   for(let j=0;j<=n;j++){
    const forced=Math.min(f.forced,j*action);
    const after=f.afterSolar-forced/c.eff;
    if(slot.checkpoint&&after<c.target-1e-7)continue;

    const income=(f.naturalExport+forced)*slot.price/100;
    const utility=st.utility+income-f.grid*slot.importP/100-
     (f.batteryHome+forced)/c.eff*c.wearP/100;
    const key=Math.round(after/quantum);
    const prior=next.get(key);
    if(!prior||
       utility+after*credit>prior.utility+prior.energy*credit){
     next.set(key,{
      energy:after,utility,prev:oldKey,
      step:{...f,forced,ending:after}
     });
    }
   }
  }
  if(!next.size)return {
   ok:false,reason:'No feasible schedule meets 20% at 19:00'
  };
  history.push(next);
  states=next;
 }

 let best=null,key;
 for(const [k,s] of states){
  if(!best||
     s.utility+s.energy*credit>best.utility+best.energy*credit){
   best=s;
   key=k;
  }
 }
 const steps=[];
 for(let i=history.length-1;i>=0;i--){
  const s=history[i].get(key);
  steps.push(s.step);
  key=s.prev;
 }
 return finish(c,steps.reverse());
}

const api={solve,replay};
if(node)module.exports=api;
else root.FoxScheduleCore=api;
})(typeof window!=='undefined'?window:globalThis);
