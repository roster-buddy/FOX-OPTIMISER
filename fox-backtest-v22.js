/* Fox Optimiser v2.2 – historical Agile backtesting, night feasibility + wear, read only. */
(function (root) {
  'use strict';
  const VERSION = '2.2';
  const TOL = 1e-7;
  const GB = 'Europe/London';
  const product = 'AGILE-OUTGOING-19-05-13';
  const tariff = 'E-1R-AGILE-OUTGOING-19-05-13-E';
  const timeFormat = new Intl.DateTimeFormat('en-GB', {
    timeZone: GB, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  });
  const parts = d => Object.fromEntries(timeFormat.formatToParts(d).map(p => [p.type,p.value]));
  const dateGB = d => { const p=parts(d); return `${p.year}-${p.month}-${p.day}`; };
  const fmt = (v,n=2) => Number(v).toFixed(n);
  const sum = (arr,fn=x=>x) => arr.reduce((a,x)=>a+fn(x),0);
  function dayShift(s,n) {
    const d = new Date(s+'T12:00:00Z');
    if (!Number.isFinite(d.getTime())) throw Error('Invalid date');
    d.setUTCDate(d.getUTCDate()+n);
    return d.toISOString().slice(0,10);
  }
  // Use UTC instants for all price and irradiance joins, including UK clock changes.
  function slotsFor(s) {
    const target=new Date(s+'T00:00:00Z').getTime(),result=[];
    for(let t=target-86400000;t<target+2*86400000;t+=1800000) {
      const at=new Date(t),p=parts(at);
      if (`${p.year}-${p.month}-${p.day}`!==s)continue;
      const clock=Number(p.hour)+Number(p.minute)/60;
      if (clock>=5.5&&clock<23.5)result.push({at,utc:at.toISOString(),clock,local:p.hour+':'+p.minute,date:s});
    }
    if (result.length!==36 || result[0].clock!==5.5 || result.at(-1).clock!==23)
      throw Error('Unexpected UK daytime intervals for '+s+': '+result.length);
    return result;
  }
  function valid(c){
    const positive=['capacity','load','chargeKW','dischargeKW','exportKW','pv','inverterKW','pr','eff','importP','nightP'];
    for(const k of positive)if(!Number.isFinite(c[k])||c[k]<0)throw Error('Invalid '+k+' input.');
    if(c.capacity<=0||c.chargeKW<=0||c.dischargeKW<=0||c.exportKW<=0||c.pv<=0||c.inverterKW<=0||c.eff<=0||c.eff>1||c.pr<=0||c.pr>1||c.min<0||c.target!==20||c.soc<5||c.soc>100||c.min>=c.target||c.soc<c.min||c.derate<0||c.derate>=100||c.tilt<0||c.tilt>90||c.bearing<0||c.bearing>360)
      throw Error('Check battery, SOC, solar, charge/discharge and tariff inputs. The 19:00 target stays 20%.');
  }
  function demand(c,clock){
    let extra=0;
    if(c.scenario==='wfh')extra=(clock>=12&&clock<13?.25:0)+(clock>=18&&clock<19?.55:0);
    if(c.scenario==='spike')extra=(clock>=7.5&&clock<8.5?1.2:0)+(clock>=12&&clock<13?1:0)+(clock>=17.5&&clock<19?1.8:0)+(clock>=20&&clock<21?1.2:0);
    return (c.load+extra)*.5;
  }
  /* Hour-ending irradiance mapped to the two 30-minute slots whose midpoints
     belong to that hour. This is an archived irradiance reconstruction, NOT
     measured site production, and does not reproduce half-hour cloud variation.
     Performance ratio already represents broad DC-to-AC losses. Avoid double
     counting inverter efficiency. Derate before AC clipping. */
  function solarAudit(slots,irradianceByHour,c){
    const solar=[],detail=[];
    for(const s of slots){
      const midpoint=s.at.getTime()+900000;
      const hourlyEnd=Math.ceil(midpoint/3600000)*3600000;
      const w=irradianceByHour.get(hourlyEnd);
      if(!Number.isFinite(w)||w<0)throw Error('Historical irradiance missing at '+new Date(hourlyEnd).toISOString()+'. Refusing to fill gaps.');
      const dcKW=w/1000*c.pv*c.pr*(1-c.derate/100);
      const acKW=Math.min(c.inverterKW,dcKW);
      const clipKW=Math.max(0,dcKW-acKW);
      solar.push(acKW*.5);
      detail.push({utc:s.utc,irradiance:w,dcKW,acKW,clipKW,energy:acKW*.5});
    }
    const energy=sum(detail,z=>z.energy);
    return {solar,detail,energy,clippedKWh:sum(detail,z=>z.clipKW*.5),
      acPeakKW:Math.max(0,...detail.map(z=>z.acKW)),
      dcPeakKW:Math.max(0,...detail.map(z=>z.dcKW)),
      irradiationKWhM2:sum(detail,z=>z.irradiance*.5/1000),
      specificYield:energy/c.pv,
      assumptions:'Hourly archived global tilted irradiance replicated into two half-hours; fixed performance ratio and inverter clipping; no measured site output.'};
  }
  function historicalSolar(slots,irradianceByHour,c){return solarAudit(slots,irradianceByHour,c).solar;}
  function audit(plan,c){
    const rows=plan.steps;
    const solar=sum(rows,z=>z.solar),house=sum(rows,z=>z.house),solarHouse=sum(rows,z=>z.solarHome);
    const stored=sum(rows,z=>z.solarStored),natural=sum(rows,z=>z.naturalExport),curtail=sum(rows,z=>z.curtailed);
    const batteryHome=sum(rows,z=>z.batteryHome),grid=sum(rows,z=>z.grid),forced=sum(rows,z=>z.forced);
    const residualSolar=solar-solarHouse-stored/c.eff-natural-curtail;
    const residualHouse=house-solarHouse-batteryHome-grid;
    const residualBattery=c.capacity*c.soc/100+stored-batteryHome/c.eff-forced/c.eff-plan.end;
    const worst=Math.max(Math.abs(residualSolar),Math.abs(residualHouse),Math.abs(residualBattery));
    return {solar,house,solarHouse,stored,natural,curtail,batteryHome,grid,forced,
      chargeLoss:stored/c.eff-stored,
      dischargeLoss:(batteryHome+forced)/c.eff-(batteryHome+forced),
      residualSolar,residualHouse,residualBattery,worst};
  }
  function simulate(c,slots,solar,prices,allowForced){
    valid(c);
    if(slots.length!==36||solar.length!==36||prices.length!==36)throw Error('Invalid 36-slot day inputs.');
    if(prices.some(x=>!Number.isFinite(x)))throw Error('Published prices missing; refusing to invent prices.');
    if(solar.some(x=>!Number.isFinite(x)||x<0))throw Error('Solar input invalid.');
    const quantum=.05,actionStep=.10,min=c.capacity*c.min/100,target=c.capacity*.20,initial=c.capacity*c.soc/100;
    const credit=c.nightP/(100*c.eff);
    let states=new Map([[Math.round(initial/quantum),{energy:initial,score:0,revenue:0,grid:0,forced:0,prev:null}]]);
    const history=[];
    for(let i=0;i<36;i++){
      const clock=slots[i].clock,solarKWh=solar[i],house=demand(c,clock),p=prices[i];
      const next=new Map();
      for(const [oldKey,st] of states){
        const solarHome=Math.min(solarKWh,house),deficit=house-solarHome,surplus=solarKWh-solarHome;
        const batteryHome=Math.min(deficit,c.dischargeKW*.5*c.eff,Math.max(0,(st.energy-min)*c.eff));
        const grid=deficit-batteryHome;
        const afterHome=st.energy-batteryHome/c.eff;
        const pvToBattery=Math.min(surplus,c.chargeKW*.5,Math.max(0,(c.capacity-afterHome)/c.eff));
        const solarStored=pvToBattery*c.eff,afterSolar=afterHome+solarStored;
        const naturalExport=Math.min(c.exportKW*.5,surplus-pvToBattery);
        const curtailed=Math.max(0,surplus-pvToBattery-naturalExport);
        const availableDischarge=Math.max(0,c.dischargeKW*.5-batteryHome/c.eff)*c.eff;
        // Do not model charging and forced discharging in the same interval.
        const maxForced=(allowForced&&clock<19&&p>0&&solarStored<TOL)
          ?Math.min(Math.max(0,c.exportKW*.5-naturalExport),availableDischarge,Math.max(0,(afterSolar-min)*c.eff)):0;
        const n=Math.ceil(maxForced/actionStep);
        for(let j=0;j<=n;j++){
          const forced=Math.min(maxForced,j*actionStep);
          const after=afterSolar-forced/c.eff;
          if(after<min-TOL)continue;
          if(clock===18.5 && after<target-TOL)continue;
          const nextKey=Math.round(after/quantum);
          const income=(naturalExport+forced)*p/100;
          const score=st.score+income-grid*c.importP/100;
          const prior=next.get(nextKey);
          if(!prior||score+after*credit>prior.score+prior.energy*credit){
            next.set(nextKey,{energy:after,score,revenue:st.revenue+income,grid:st.grid+grid,forced:st.forced+forced,prev:oldKey,
              step:{clock,utc:slots[i].utc,solar:solarKWh,house,price:p,solarHome,solarStored,naturalExport,curtailed,batteryHome,grid,forced,ending:after}});
          }
        }
      }
      if(!next.size)return {ok:false,reason:'No feasible schedule meets exactly 20% SOC at 19:00 with this starting SOC and modelled demand.'};
      history.push(next);states=next;
    }
    let best=null,key=null;
    for(const [k,s] of states){if(!best||s.score+s.energy*credit>best.score+best.energy*credit){best=s;key=k}}
    const steps=[];
    for(let i=history.length-1;i>=0;i--){const s=history[i].get(key);if(!s)throw Error('Path reconstruction failed');steps.push(s.step);key=s.prev;}
    steps.reverse();
    const at19=steps.find(s=>s.clock===18.5)?.ending;
    if(!Number.isFinite(at19))throw Error('19:00 checkpoint missing.');
    const plan={ok:true,steps,at19,end:best.energy,score:best.score,revenue:best.revenue,grid:best.grid,forced:best.forced};
    plan.audit=audit(plan,c);
    if(plan.audit.worst>1e-6)throw Error('Energy accounting failed: '+plan.audit.worst);
    if(at19+1e-7<target||best.energy+1e-7<min)throw Error('Battery SOC policy failed');
    for(const s of steps){
      if(s.forced+s.naturalExport>c.exportKW*.5+TOL)throw Error('Export interval cap failed');
      if(s.batteryHome/c.eff+s.forced/c.eff>c.dischargeKW*.5+TOL)throw Error('Battery discharge cap failed');
    }
    return plan;
  }
  function compare(c,slots,solar,prices){
    const base=simulate(c,slots,solar,prices,false);
    const optimised=simulate(c,slots,solar,prices,true);
    if(!base.ok||!optimised.ok)return {ok:false,reason:optimised.reason||base.reason};
    const terminalCredit=c.nightP/(100*c.eff);
    const baselineCost=-base.score+(c.capacity-base.end)*terminalCredit;
    const optimisedCost=-optimised.score+(c.capacity-optimised.end)*terminalCredit;
    const improvement=baselineCost-optimisedCost;
    return {ok:true,base,optimised,baselineCost,optimisedCost,improvement};
  }
  /* Night interval 23:30 local on the historical date through 05:30 next day.
   UTC iteration preserves 10/12/14 slots across spring/autumn time changes. */
function overnightSlotsFor(day){
  const next=dayShift(day,1),begin=Date.parse(day+'T19:00:00Z'),end=Date.parse(next+'T11:00:00Z'),out=[];
  for(let ms=begin;ms<end;ms+=1800000){
    const d=new Date(ms),p=parts(d),date=`${p.year}-${p.month}-${p.day}`,clock=Number(p.hour)+Number(p.minute)/60;
    if((date===day&&clock>=23.5)||(date===next&&clock<5.5))out.push({utc:d.toISOString(),clock,date});
  }
  if(![10,12,14].includes(out.length)||out[0]?.clock!==23.5||out.at(-1)?.clock!==5)
    throw Error('Unexpected night interval count '+out.length+' for '+day);
  return out;
}
/* User-selected hypothetical EV demand by local overnight START day.
   Day-of-week mapping uses UK date at noon UTC to avoid date ambiguity.
   All arrays are Sun..Sat. Nothing is fetched from Ohme. */
const EV_PROFILES={
  fixed13:[13,13,13,13,13,13,13],
  noEV:[0,0,0,0,0,0,0],
  light:[0,7,0,13,0,7,13],
  mixed:[0,12,0,12,0,12,14],
  heavy:[13,26,13,26,13,26,13]
};
function evForDate(day,profile,flat,custom){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(day))throw Error('Invalid overnight date');
  const dow=new Date(day+'T12:00:00Z').getUTCDay();
  if(profile==='fixed')return flat;
  let arr;
  if(profile==='custom'){
    arr=String(custom).split(',').map(x=>Number(x.trim()));
    if(arr.length!==7||arr.some(x=>!Number.isFinite(x)||x<0||x>90))throw Error('Custom EV pattern requires exactly 7 values from 0 to 90 kWh, Sunday through Saturday.');
  }else{
    arr=EV_PROFILES[profile];
    if(!arr)throw Error('Unknown EV charging profile.');
  }
  if(!Number.isFinite(arr[dow])||arr[dow]<0)return 0;
  return arr[dow];
}
/* Conservative fixed EV-first overnight schedule, not a live Ohme schedule.
   Grid draw = grid to house + grid to EV + grid to ESS in each slot. */
function overnightCharge(c,day,eveningEnd,settings){
  const slots=overnightSlotsFor(day),cap=c.capacity,target=cap*c.soc/100,eff=c.eff;
  if(!Number.isFinite(eveningEnd)||eveningEnd<cap*c.min/100-TOL||eveningEnd>cap+TOL)throw Error('Invalid evening SOC');
  for(const k of ['importKW','evKWh','evKW','nightHomeKW'])if(!Number.isFinite(settings[k])||settings[k]<0)throw Error('Invalid overnight '+k);
  if(settings.importKW<=0||settings.evKW<=0)throw Error('Overnight grid/EV limits must be positive.');
  let stored=eveningEnd,evRemaining=settings.evKWh,evDelivered=0,batteryGrid=0,homeGrid=0,peak=0,rows=[];
  for(const slot of slots){
    const household=Math.min(settings.nightHomeKW,settings.importKW);
    // Flat-rate conservative EV-first; we do not invent actual Ohme slots.
    const ev=Math.min(settings.evKW,Math.max(0,settings.importKW-household),evRemaining*2);
    const room=Math.max(0,settings.importKW-household-ev);
    const battery=Math.min(c.chargeKW,room,Math.max(0,target-stored)*2/eff);
    const grid=household+ev+battery;
    if(grid>settings.importKW+1e-9||battery>c.chargeKW+1e-9||ev>settings.evKW+1e-9)throw Error('Grid power constraint violation');
    stored=Math.min(target,stored+battery*.5*eff);evRemaining=Math.max(0,evRemaining-ev*.5);
    evDelivered+=ev*.5;batteryGrid+=battery*.5;homeGrid+=household*.5;peak=Math.max(peak,grid);
    rows.push({time:slot.utc,evKW:ev,batteryKW:battery,homeKW:household,gridKW:grid,soc:stored/cap*100});
  }
  const batteryOK=stored>=target-1e-6,evOK=evRemaining<=1e-6;
  return {ok:batteryOK&&evOK,batteryOK,evOK,rows,slots:slots.length,eveningEnd,target,final:stored,
    batteryGrid,evDelivered,evMissing:evRemaining,homeGrid,peak,
    batteryMissing:Math.max(0,(target-stored)/eff),
    cost:(batteryGrid+evDelivered+homeGrid)*c.nightP/100};
}
/* An explicitly adjustable hypothetical battery wear rate (not Fox warranty data).
   Count incremental energy removed from the battery store, not grid imports. */
function adjustedCompare(r,c,day,settings){
  if(!r.ok)return {ok:false,reason:r.reason};
  const base=overnightCharge(c,day,r.base.end,settings),opt=overnightCharge(c,day,r.optimised.end,settings);
  const wearStoredBase=(r.base.audit.batteryHome+r.base.audit.forced)/c.eff;
  const wearStoredOpt=(r.optimised.audit.batteryHome+r.optimised.audit.forced)/c.eff;
  const extraBatteryWear=Math.max(0,wearStoredOpt-wearStoredBase);
  const wearCost=extraBatteryWear*settings.wearP/100;
  if(!Number.isFinite(settings.wearP)||settings.wearP<0||settings.wearP>100)throw Error('Check battery wear sensitivity rate');
  const ok=base.ok&&opt.ok;
  // v2.0 compare ALREADY costs refill electricity at the overnight tariff.
  // Only EV and overnight household are newly included in the absolute cost.
  const commonNightCost=(base.evDelivered+base.homeGrid)*c.nightP/100;
  if(ok&&Math.abs((base.batteryGrid-(c.capacity-r.base.end)/c.eff))>1e-5)throw Error('Baseline overnight battery accounting does not match backtest');
  if(ok&&Math.abs((opt.batteryGrid-(c.capacity-r.optimised.end)/c.eff))>1e-5)throw Error('Optimised overnight battery accounting does not match backtest');
  return {ok,base,opt,extraBatteryWear,wearCost,gross:r.improvement,net:r.improvement-wearCost,
    baseFullCost:r.baselineCost+commonNightCost,optFullCost:r.optimisedCost+commonNightCost+wearCost,
    reason:!base.evOK||!opt.evOK?'EV charge request cannot be completed overnight under the grid ceiling.':
           !base.batteryOK||!opt.batteryOK?'Battery cannot reach the modelled 05:30 SOC alongside EV charging.':''};
}
const api={version:VERSION,slotsFor,dayShift,dateGB,historicalSolar,solarAudit,evForDate,EV_PROFILES,simulate,compare,audit,demand,tariff,product,overnightSlotsFor,overnightCharge,adjustedCompare};
  if (typeof module !== 'undefined' && module.exports)module.exports=api;
  if(typeof document==='undefined')return;
  const el=(tag,text)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;return n;};
  function field(parent,label,value,min,max,step='any'){
    const l=el('label',label),i=el('input');l.style.cssText='display:flex;flex-direction:column;gap:4px;font-size:12px';i.style.cssText='width:150px;min-height:32px;padding:6px';i.type='number';i.value=value;i.step=step;i.min=min;i.max=max;l.append(i);parent.append(l);return i;
  }
  async function getJSON(url,label,timeoutMs=25000){
    const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
    let response;
    try{response=await fetch(url,{cache:'no-store',signal:ctrl.signal});}
    catch(err){throw Error(label+' request blocked/offline: '+(err.name==='AbortError'?'timed out':err.message));}
    finally{clearTimeout(timer);}
    if(!response.ok)throw Error(label+' returned HTTP '+response.status);
    try{return await response.json();}catch(e){throw Error(label+' did not return readable JSON.');}
  }
  async function fetchRates(slots){
    const base='https://api.octopus.energy/v1/products/'+product+'/electricity-tariffs/'+tariff+'/standard-unit-rates/';
    let u=new URL(base),records=[];
    u.searchParams.set('period_from',slots[0].utc);
    u.searchParams.set('period_to',new Date(new Date(slots.at(-1).utc).getTime()+1800000).toISOString());
    u.searchParams.set('page_size','1500');
    let pages=0;
    while(u){
      if(++pages>5)throw Error('Octopus rate pagination limit reached.');
      if(u.origin!=='https://api.octopus.energy'||!u.pathname.startsWith('/v1/products/'))throw Error('Unexpected Octopus pagination URL.');
      const json=await getJSON(u.toString(),'Octopus Agile export prices');
      if(!Array.isArray(json.results))throw Error('Octopus response missing rates.');
      records.push(...json.results);
      u=json.next?new URL(json.next,u):null;
    }
    const byUTC=new Map();
    for(const r of records){
      if(typeof r.valid_from!=='string'||r.value_inc_vat===null||r.value_inc_vat===undefined||!Number.isFinite(Number(r.value_inc_vat)))continue;
      const ms=new Date(r.valid_from).getTime();if(!Number.isFinite(ms))continue;
      const k=new Date(ms).toISOString();
      if(byUTC.has(k)&&Math.abs(byUTC.get(k)-Number(r.value_inc_vat))>1e-5)throw Error('Conflicting Octopus rate at '+k);
      byUTC.set(k,Number(r.value_inc_vat));
    }
    const missing=slots.filter(s=>!byUTC.has(s.utc));
    if(missing.length)throw Error('Octopus has '+missing.length+' missing half-hourly export prices (first '+missing[0].utc+'). Choose an older date range; no sample rates will be substituted.');
    return {prices:slots.map(s=>byUTC.get(s.utc)),rawRecords:records.length};
  }
  async function fetchArchive(c,first,last,slots){
    const latStr=String(c.lat),lonStr=String(c.lon);
    const url=new URL('https://archive-api.open-meteo.com/v1/archive');
    // Buffer a day either side for preceding-hour mean joins.
    for(const [k,v] of Object.entries({latitude:latStr,longitude:lonStr,start_date:dayShift(first,-1),end_date:dayShift(last,1),
      hourly:'global_tilted_irradiance',tilt:c.tilt,azimuth:c.bearing-180,timezone:'UTC',timeformat:'unixtime'}))url.searchParams.set(k,String(v));
    const json=await getJSON(url.toString(),'Open-Meteo historical irradiance',45000);
    const hourly=json?.hourly;
    if(!Array.isArray(hourly?.time)||!Array.isArray(hourly?.global_tilted_irradiance)||hourly.time.length!==hourly.global_tilted_irradiance.length)
      throw Error('Open-Meteo historical irradiance incomplete; no synthetic weather will be substituted.');
    const hourlyMap=new Map();
    for(let i=0;i<hourly.time.length;i++){
      const sec=Number(hourly.time[i]),val=hourly.global_tilted_irradiance[i];
      if(Number.isFinite(sec)&&val!==null&&Number.isFinite(Number(val)))hourlyMap.set(sec*1000,Number(val));
    }
    if(!hourlyMap.size)throw Error('Open-Meteo returned no valid historical irradiance.');
    return solarAudit(slots,hourlyMap,c);
  }
  function mount(){
    if(document.getElementById('foxHistoricalBacktestV22'))return;
    const main=document.querySelector('main');if(!main)return;
    const panel=el('section');panel.id='foxHistoricalBacktestV22';panel.className='panel';
    panel.style.cssText='margin:18px 0;padding:18px;border:1px solid #53769d;border-radius:14px';
    panel.append(el('h3','Historical backtesting · v2.2 — solar audit + variable EV charging'));
    const intro=el('p','READ-ONLY RESEARCH · Real archived Octopus Outgoing Agile export prices and Open-Meteo historical solar irradiance; synthetic 300 W household demand, user-selected hypothetical EV charging nights and assumed 100% battery SOC at 05:30 each day. Historical weather reconstructed after the fact is NOT a historical day-ahead forecast. Results are hindsight illustrations, not real household earnings.');
    intro.className='note';panel.append(intro);
    const privacy=el('p','Privacy: On running the test, your locally saved solar-site coordinates are sent directly to Open-Meteo for archived irradiance only. They are not added to GitHub source files or shared with Octopus.');privacy.className='note';panel.append(privacy);
    const dateArea=el('div');dateArea.style.cssText='display:flex;gap:12px;flex-wrap:wrap;align-items:end';
    const lastSafe=dayShift(dateGB(new Date()),-7);
    const endLabel=el('label','Last historic day (UK)');endLabel.style.cssText='display:flex;flex-direction:column;gap:4px;font-size:12px';
    const endField=el('input');endField.type='date';endField.value=lastSafe;endField.max=lastSafe;endField.style.cssText='padding:8px;min-height:32px';endLabel.append(endField);dateArea.append(endLabel);
    const countLabel=el('label','Period');countLabel.style.cssText='display:flex;flex-direction:column;gap:4px;font-size:12px';const days=el('select');
    for(const [v,label] of [['7','7 complete days'],['14','14 complete days'],['28','28 complete days']]){const o=el('option',label);o.value=v;days.append(o)}
    days.value='7';days.style.cssText='padding:8px;min-height:32px';countLabel.append(days);dateArea.append(countLabel);
    panel.append(dateArea);
    const form=el('div');form.style.cssText='display:flex;gap:12px;flex-wrap:wrap;margin:12px 0';const f={};
    f.lat=field(form,'Saved solar latitude',readLS('fox-solar-lat'),-90,90);
    f.lon=field(form,'Saved solar longitude',readLS('fox-solar-lon'),-180,180);
    f.bearing=field(form,'Panel compass bearing (°)',readLS('fox-solar-bearing-confirmed')||110,0,360);
    f.tilt=field(form,'Panel slope (°)',35,0,90);
    f.pv=field(form,'Solar panels (kWp)',2.01,.1,30);
    f.inverterKW=field(form,'Solar inverter AC limit (kW)',1.5,.1,30);
    f.pr=field(form,'PV performance ratio (%)',82,1,100);
    f.derate=field(form,'Extra PV derate (%) · after PR, before inverter clipping',0,0,90);
    f.capacity=field(form,'Battery nominal (kWh)',10.24,1,50);
    f.soc=field(form,'SOC at 05:30 each day (%) · model assumes full overnight recharge',100,100,100);f.soc.readOnly=true;
    f.min=field(form,'Minimum SOC (%)',5,0,50);
    f.load=field(form,'Home baseline (kW)',.3,0,10);
    f.eff=field(form,'Battery charge / discharge efficiency (%)',95,1,100);
    f.chargeKW=field(form,'Max battery charge (kW)',5,.1,30);
    f.dischargeKW=field(form,'Max battery discharge (kW)',5,.1,30);
    f.exportKW=field(form,'DNO net export cap (kW)',3.5,.1,30);
    f.importP=field(form,'Avoided daytime import (p/kWh)',28,0,100);
    f.nightP=field(form,'Overnight recharge (p/kWh)',3.33,0,100);
    panel.append(form);
const nightFields=el('div');nightFields.style.cssText='display:flex;gap:12px;flex-wrap:wrap;margin:12px 0';
const overnightF={};
overnightF.importKW=field(nightFields,'Shared grid import ceiling (kW)',8.3,0.1,30);
overnightF.evKWh=field(nightFields,'Fixed-night EV energy (kWh; for fixed setting)',13,0,90);
overnightF.evKW=field(nightFields,'Assumed Ohme EV power (kW)',6.6,.1,30);
overnightF.nightHomeKW=field(nightFields,'Overnight household baseline (kW)',.3,0,15);
overnightF.wearP=field(nightFields,'Illustrative wear cost (p/kWh battery throughput)',5,0,100);
panel.append(el('h4','Overnight 23:30–05:30 · EV + battery charging feasibility'));
const nNote=el('p','Overnight EV demand and charging speed are hypothetical, not readings from Ohme. EV charging is modelled first, then battery charging using remaining instantaneous grid headroom. No fixed 13 kWh EV consumption is assumed to happen every night in real life. Wear cost defaults to an editable 5p/kWh sensitivity assumption, not a measured or Fox-certified cost.');nNote.className='note';panel.append(nNote);
panel.append(nightFields);
    const evControls=el('div');evControls.style.cssText='display:flex;flex-wrap:wrap;gap:14px;margin:10px 0';
    const evLab=el('label','EV charging model for each overnight period');evLab.style.cssText='display:flex;flex-direction:column;gap:5px;font-size:12px';
    const evSelect=el('select');evSelect.style.cssText='min-height:34px;padding:5px';
    for(const [value,label] of [
      ['mixed','Mixed nights (0 / 12 / 14 kWh) · illustrative'],
      ['light','Light EV use (0 / 7 / 13 kWh) · illustrative'],
      ['fixed','Every night same kWh · previous v2.1 assumption'],
      ['noEV','No EV charging during cheap window'],
      ['heavy','High EV use (13 / 26 kWh) · stress test'],
      ['custom','Custom weekly kWh pattern (Sun to Sat)']
    ]){const opt=el('option',label);opt.value=value;evSelect.append(opt)}
    evSelect.value='mixed';evLab.append(evSelect);evControls.append(evLab);
    const customLab=el('label','Custom Sun,Mon,Tue,Wed,Thu,Fri,Sat kWh');customLab.style.cssText='display:flex;flex-direction:column;gap:5px;font-size:12px';
    const customInput=el('input');customInput.type='text';customInput.value='0,12,0,12,0,12,14';customInput.style.cssText='min-height:34px;padding:5px;width:250px';
    customLab.append(customInput);evControls.append(customLab);
    panel.append(evControls);
    const evHelp=el('p','Charging profiles are TEST ASSUMPTIONS, not live Ohme schedules. The 8.3 kW limit applies to combined grid power at each modelled moment, not to a daily kWh amount. This 30-minute model cannot guarantee sub-interval protection.');evHelp.className='note';panel.append(evHelp);
    const scenarioLabel=el('label','Modelled household demand profile '),scenario=el('select');
    for(const [k,v] of [['low','Typical 300 W baseline'],['wfh','Working from home / cooking stress'],['spike','High-load stress test']]){const o=el('option',v);o.value=k;scenario.append(o)}
    scenarioLabel.append(scenario);panel.append(scenarioLabel);
    const p=el('p','20% SOC at 19:00 is fixed: no additional SOC buffer. If a scenario cannot meet 20%, that day fails rather than silently changing your requirement. All historical prices include VAT, matched by UTC instant to handle daylight saving. Region: E (West Midlands).');p.className='note';panel.append(p);
    const btn=el('button','Run historical backtest');btn.type='button';btn.style.cssText='padding:11px 16px;margin:12px 0;cursor:pointer';panel.append(btn);
    const status=el('p','No historical test run.');status.setAttribute('aria-live','polite');panel.append(status);
    const summary=el('div');summary.style.cssText='white-space:pre-line;line-height:1.75';panel.append(summary);
    const daily=el('div');daily.style.cssText='overflow-x:auto';panel.append(daily);
    main.append(panel);
    btn.addEventListener('click',async()=>{
      btn.disabled=true;summary.textContent='';daily.replaceChildren();status.textContent='Checking inputs…';
      try{
        const c=Object.fromEntries(Object.entries(f).map(([k,input])=>[k,Number(input.value)]));
        c.pr/=100;c.eff/=100;c.scenario=scenario.value;c.target=20;
        if(!String(f.lat.value).trim()||!String(f.lon.value).trim()||!Number.isFinite(c.lat)||!Number.isFinite(c.lon)||Math.abs(c.lat)>90||Math.abs(c.lon)>180)throw Error('Enter valid saved solar-site latitude and longitude. The project does not include these in source files.');
        if(!Number.isInteger(Number(days.value))||!endField.value||endField.value>lastSafe)throw Error('Choose a historic end date at least seven days before today so the weather archive can be available.');
valid(c);
// Keep exact solar coordinates in this browser only; never in GitHub source files.
try{localStorage.setItem('fox-solar-lat',f.lat.value.trim());localStorage.setItem('fox-solar-lon',f.lon.value.trim());}catch(e){}
if(c.soc!==100)throw Error('This v2.1 overnight test requires the assumed starting SOC of 100%.');
const night=Object.fromEntries(Object.entries(overnightF).map(([k,input])=>[k,Number(input.value)]));
for(const [k,input] of Object.entries(overnightF))if(!input.value.trim()||!Number.isFinite(night[k])||night[k]<0)throw Error('Invalid overnight setting: '+k);
if(night.importKW<night.nightHomeKW||night.evKW<=0||night.wearP>100)throw Error('Check shared grid limit, EV rate, wear sensitivity and overnight load.');
evForDate(endField.value,evSelect.value,night.evKWh,customInput.value);
 const dCount=Number(days.value),end=endField.value,first=dayShift(end,-dCount+1);
        const allDays=[],allSlots=[];
        for(let i=0;i<dCount;i++){const d=dayShift(first,i),s=slotsFor(d);allDays.push({date:d,slots:s});allSlots.push(...s);}
        status.textContent='Fetching actual Octopus half-hourly export prices and archived solar irradiance…';
        const [rates,solar]=await Promise.all([fetchRates(allSlots),fetchArchive(c,first,end,allSlots)]);
        if(rates.prices.length!==allSlots.length||solar.length!==allSlots.length)throw Error('Historical source lengths do not match.');
        status.textContent='Analysing '+dCount+' days with real prices and weather-based solar estimates…';
        const results=[],bad=[];
        for(let i=0;i<dCount;i++){
          const s=allDays[i].slots,pSlice=rates.prices.slice(i*36,(i+1)*36),pv=solar.slice(i*36,(i+1)*36);
          const r=compare(c,s,pv,pSlice);
          if(r.ok)results.push({date:allDays[i].date,solar:sum(pv),...r});
          else bad.push({date:allDays[i].date,reason:r.reason});
          if(i%3===2)await new Promise(resolve=>setTimeout(resolve,0));
        }
        if(!results.length)throw Error('No feasible days. '+(bad[0]?.reason||'')+' No financial result shown.');
const analysed=results.map(r=>{
   const evRequest=evForDate(r.date,evSelect.value,night.evKWh,customInput.value);
   return {...r,evRequest,overnight:adjustedCompare(r,c,r.date,{...night,evKWh:evRequest})};
 });
const nightFailed=analysed.filter(r=>!r.overnight.ok);
const nightPassed=analysed.filter(r=>r.overnight.ok);
const baseCosts=sum(results,r=>r.baselineCost),optCosts=sum(results,r=>r.optimisedCost),uplift=baseCosts-optCosts;
const totalWear=sum(analysed,r=>r.overnight.wearCost),totalExtraWear=sum(analysed,r=>r.overnight.extraBatteryWear),netUplift=uplift-totalWear;
const nightsEnergy=sum(analysed,r=>r.overnight.opt.batteryGrid),evEnergy=sum(analysed,r=>r.overnight.opt.evDelivered),
      nightHouseEnergy=sum(analysed,r=>r.overnight.opt.homeGrid),peakGrid=Math.max(...analysed.map(r=>r.overnight.opt.peak));
const adjustedValid=nightFailed.length===0 && bad.length===0;
const passNet=sum(nightPassed,r=>r.overnight.net);
const failures=nightFailed.map(r=>r.date+': '+r.overnight.reason);
const sampleNight=analysed[0].overnight.opt;
 const evRequested=sum(analysed,r=>r.evRequest);
 const evZeroNights=analysed.filter(r=>r.evRequest===0).length;
 const solarYield=pvAudit.energy/c.pv;
 const highSolarYield=pvAudit.energy/dCount/c.pv>5;
 const incomplete=bad.length||nightFailed.length;
        const solarTotal=sum(results,r=>r.solar),forced=sum(results,r=>r.optimised.forced),baseExp=sum(results,r=>r.base.revenue),optExp=sum(results,r=>r.optimised.revenue);
        const importBase=sum(results,r=>r.base.grid),importOpt=sum(results,r=>r.optimised.grid);
        const min19=Math.min(...results.map(r=>r.optimised.at19/c.capacity*100));
        const auditWorst=Math.max(...results.map(r=>r.optimised.audit.worst),...results.map(r=>r.base.audit.worst));
        const positive=results.filter(r=>r.improvement>.005).length;
        const negativeRateSlots=rates.prices.filter(x=>x<0).length;
        const rowsPrice=rates.prices.length;
        status.textContent=(adjustedValid?'COMPLETED ·':'OVERNIGHT FEASIBILITY WARNING ·')+' '+first+' to '+end+' · '+results.length+'/'+dCount+' daytime-feasible, '+nightPassed.length+'/'+dCount+' overnight-feasible · '+rowsPrice+' actual half-hour export prices ('+rates.rawRecords+' API rate records).';
        summary.textContent='HISTORICAL BACKTEST · RESULTS ARE NOT ACTUAL EARNINGS\n'+
          'Octopus tariff: '+tariff+' · West Midlands · actual historical rates inc. VAT\n'+
          'Archived solar AC estimate: '+fmt(solarTotal)+' kWh · '+fmt(solarTotal/dCount)+' kWh/day · '+fmt(solarYield)+' kWh per installed kWp over '+dCount+' days\n'+
          'Solar input: '+fmt(pvAudit.irradiationKWhM2)+' kWh/m² estimated tilted irradiation; AC inverter peak '+fmt(pvAudit.acPeakKW)+' kW (cap '+fmt(c.inverterKW)+' kW)\n'+
          'Estimated inverter clipping: '+fmt(pvAudit.clippedKWh)+' kWh (after assumed '+fmt(c.pr*100,1)+'% PR and '+fmt(c.derate)+'% extra PV derate)\n'+
          (highSolarYield?'SOLAR SANITY ADVISORY: Average estimated yield exceeds 5 kWh/kWp/day; check irradiance/time alignment and roof parameters before relying on revenue.\n':'')+
          'Household load: SYNTHETIC '+fmt(c.load,2)+' kW ('+c.scenario+'); battery start: ASSUMED '+fmt(c.soc)+'% at 05:30 every day\n'+
          'Baseline: NO forced battery export; solar powers house / battery first\n'+
          'Baseline net variable energy cost: £'+fmt(baseCosts)+'\n'+
          'Optimised net variable energy cost: £'+fmt(optCosts)+'\n'+
          'GROSS MODELLED IMPROVEMENT BEFORE WEAR: '+(uplift<0?'-£'+fmt(-uplift):'+£'+fmt(uplift))+' across '+results.length+' days\n'+
          'Illustrative additional battery wear at '+fmt(night.wearP)+' p/kWh: £'+fmt(totalWear)+'\n'+
'MODELLED IMPROVEMENT AFTER ASSUMED WEAR: '+(netUplift<0?'-£'+fmt(-netUplift):'+£'+fmt(netUplift))+' (ONLY CREDIBLE IF ALL NIGHTS FEASIBLE)\n'+
'Normalised illustration at 0 / 5 / 10 p per kWh wear: £'+fmt(uplift)+' / £'+fmt(uplift-totalExtraWear*.05)+' / £'+fmt(uplift-totalExtraWear*.10)+'\n'+
'Overnight battery grid charge: '+fmt(nightsEnergy)+' kWh · EV energy requested: '+fmt(evRequested)+' kWh · EV energy served: '+fmt(evEnergy)+' kWh · zero-EV nights: '+evZeroNights+' · overnight home: '+fmt(nightHouseEnergy)+' kWh\n'+
'EV pattern: '+evSelect.options[evSelect.selectedIndex].text+' (SYNTHETIC; not Ohme data)\n'+
'Peak modelled simultaneous overnight grid import (30-min slot approximation): '+fmt(peakGrid)+' kW (ceiling '+fmt(night.importKW)+' kW)\n'+
'Night intervals checked per date: '+sampleNight.slots+' on first day (10/12/14 possible across DST)\n'+
'Overnight feasible days: '+nightPassed.length+'/'+dCount+' · infeasible nights: '+nightFailed.length+'\n'+
(failures.length?'FAILED NIGHTLY RECHARGE — DO NOT USE AGGREGATE PROFIT: '+failures.join(' | ')+'\n':'')+
'Improvement per daytime-feasible day BEFORE wear: £'+fmt(uplift/results.length)+'\n'+
          'Optimised forced battery export: '+fmt(forced)+' kWh · beneficial days: '+positive+'/'+results.length+'\n'+
          'Export revenue baseline / optimised: £'+fmt(baseExp)+' / £'+fmt(optExp)+'\n'+
          'Daytime grid import baseline / optimised: '+fmt(importBase)+' / '+fmt(importOpt)+' kWh\n'+
          'Lowest predicted 19:00 SOC: '+fmt(min19)+'% (target exactly 20%)\n'+
          'Worst energy-balance residual: '+fmt(auditWorst,6)+' kWh · negative-price half-hours: '+negativeRateSlots+'\n'+
          (bad.length?'INFEASIBLE / EXCLUDED DAYS: '+bad.map(x=>x.date).join(', ')+' (not counted in totals)\n':'')+
          '\nASSUMPTIONS: Each day is independently initialised at 100% at 05:30. Overnight recharging for BOTH strategies is tested against a shared instantaneous grid ceiling with a hypothetical date-dependent EV-first charging pattern, constant overnight household baseline and flat 23:30–05:30 import rate. The actual Ohme smart-charge slots may extend outside these hours and are not modelled. Battery recharge electricity was already included in the v2.0 gross costs and is NOT charged twice. EV + overnight house electricity is common to both strategies and cancels from financial improvement; Charge Pack credits, battery capital costs, standing charges and actual Ohme schedules remain excluded. Battery wear is an editable sensitivity assumption, not a warranty-based cost. No price/irradiance prediction skill is measured.\n'+
          'HINDSIGHT WARNING: Open-Meteo archives approximate historical sunshine; they are NOT the forecasts that were available before each day. This backtest is therefore a hindsight scenario, not an achievable or verified profit forecast. Battery scheduling uses an approximate 0.05 kWh state grid and 0.10 kWh export actions; no proof of global optimality. Archived hourly irradiance is allocated evenly to two half-hours; AC PV output is estimated using PR and a 1.5 kW inverter cap, and is NOT measured production. Solar estimates are not yet validated against Gen Load/inverter readings. No connection to Fox ESS, CT/Gen Load, Ohme or Home Assistant. No production learning or inverter control.';
        const t=el('table');t.style.cssText='width:100%;border-collapse:collapse;font-size:12px;min-width:670px';
        const header=el('tr');
        for(const name of ['UK date','Solar est. kWh','Forced export kWh','19:00 SOC %','23:30 SOC %','Night recharge kWh','EV requested','EV served','Night feasible','Gross gain £','Wear £','Net gain £']){
          const th=el('th',name);th.style.cssText='padding:7px;border-bottom:2px solid #53769d;text-align:left';header.append(th);
        }t.append(header);
        for(const r of analysed){
          const tr=el('tr');
          for(const v of [r.date,fmt(r.solar),fmt(r.optimised.forced),fmt(r.optimised.at19/c.capacity*100),fmt(r.optimised.end/c.capacity*100),fmt(r.overnight.opt.batteryGrid),fmt(r.evRequest),fmt(r.overnight.opt.evDelivered),r.overnight.ok?'YES':'NO',fmt(r.improvement),fmt(r.overnight.wearCost),fmt(r.overnight.net)]){
            const td=el('td',v);td.style.cssText='padding:7px;border-bottom:1px solid #52627a';tr.append(td);
          }t.append(tr);
        }daily.replaceChildren(t);
      }catch(err){status.textContent='BACKTEST NOT COMPLETED: '+(err?.message||String(err));summary.textContent='No financial result calculated. No invented prices, solar readings, or live hardware data have been substituted.';daily.replaceChildren();}
      finally{btn.disabled=false;}
    });
  }
  function readLS(k){try{return localStorage.getItem(k)||''}catch(e){return ''}}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount);else mount();
})(typeof window!=='undefined'?window:globalThis);
