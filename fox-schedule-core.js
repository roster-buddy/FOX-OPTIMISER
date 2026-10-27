
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

function prepare(c,s,e,request,gridRequest=0){
 const ev=s.ev===undefined?0:s.ev;
 const headroom=s.gridHeadroomKWh===undefined?
  Infinity:s.gridHeadroomKWh;
 if(!Number.isFinite(ev)||ev<0||
    !(headroom===Infinity||Number.isFinite(headroom)&&headroom>=0)||
    !Number.isFinite(gridRequest)||gridRequest<0)
  throw Error('Invalid EV energy or charging request');
 const hold=!!(s.cheap||s.hold||s.flexCharge||ev>0);
 const f=energy.flow(
  {...c,dischargeKW:hold?0:c.dischargeKW},
  e,s.solar,s.house+ev,
  !hold&&s.allowExport&&s.price>0?request:0,
  c.forcedFloor
 );
 const maximum=Math.min(
  Math.max(0,c.chargeKW*.5-f.charge),
  Math.max(0,(c.capacity-f.end)/c.eff),
  headroom
 );
 // Regular cheap slots fill early; flexible Smart slots use
 // the explicit selected request, including zero for hold.
 const chargeGrid=s.flexCharge?
  Math.min(maximum,gridRequest):s.cheap?maximum:0;
 f.end+=chargeGrid*c.eff;
 f.afterSolar+=chargeGrid*c.eff;
 return {
  clock:s.clock,utc:s.utc,solar:s.solar,house:s.house,price:s.price,
  solarHome:f.solarHome,solarStored:f.solarStored,
  naturalExport:f.natural,curtailed:f.curtail,
  batteryHome:f.batteryHome,grid:f.grid+chargeGrid,
  ev,hold,flexCharge:!!s.flexCharge,
  gridConflict:!!s.gridConflict,
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
  gridConflict:steps.some(s=>s.gridConflict),
  valid:!steps.some(s=>s.gridConflict)&&
   checkpoints.every(s=>s.ending>=c.target-1e-7)
 };
}

function replay(c,slots,requests=[],gridRequests=[]){
 validate(c,slots);
 let e=c.initial;
 const steps=[];
 for(let i=0;i<slots.length;i++){
  const s=prepare(c,slots[i],e,requests[i]||0,gridRequests[i]??0);
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
 if(!slots.some(s=>s.checkpoint)&&!slots.some(s=>s.flexCharge))
  return replay(c,slots);

 const quantum=.05,action=.1;
 const credit=c.refillP/(100*c.eff);
 const history=[];
 let states=new Map([
  [Math.round(c.initial/quantum),
   {energy:c.initial,utility:0,gridBought:0,prev:null}]
 ]);

 for(const slot of slots){
  const next=new Map();
  for(const [oldKey,st] of states){
   const maximum=slot.flexCharge?
    prepare(c,slot,st.energy,0,Number.MAX_VALUE).chargeGrid:0;
   const gridActions=[0];
   for(let k=1;k<=Math.ceil(maximum/action);k++)
    gridActions.push(Math.min(maximum,k*action));
   for(const gridRequest of gridActions){
    const f=prepare(c,slot,st.energy,Number.MAX_VALUE,gridRequest);
    if(f.gridConflict)continue;
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
     const gridBought=st.gridBought+f.chargeGrid;
     const merit=utility+after*credit;
     const previousMerit=prior?
      prior.utility+prior.energy*credit:-Infinity;
     if(!prior||merit>previousMerit+1e-10||
        (Math.abs(merit-previousMerit)<=1e-10&&
         gridBought<prior.gridBought-1e-10)){
      next.set(key,{
       energy:after,utility,gridBought,prev:oldKey,
       step:{...f,forced,ending:after}
      });
     }
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
  const merit=s.utility+s.energy*credit;
  const bestMerit=best?best.utility+best.energy*credit:-Infinity;
  if(!best||merit>bestMerit+1e-10||
     (Math.abs(merit-bestMerit)<=1e-10&&
      s.gridBought<best.gridBought-1e-10)){
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
