#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/FOX-OPTIMISER
python3 - <<'PYINSTALL'
from pathlib import Path
import subprocess,datetime
html=[Path('index.html'),Path('preview-v2.html')]
if not all(p.is_file() for p in html):
    raise SystemExit('STOP: Missing index.html or preview-v2.html. No changes made.')
if any('</body>' not in p.read_text() for p in html):
    raise SystemExit('STOP: </body> not present in both HTML files. No changes made.')
js=r'''/* Fox Optimiser v2.0 – historical Agile backtesting, read only. */
(function (root) {
  'use strict';
  const VERSION = '2.0';
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
  function historicalSolar(slots, irradianceByHour,c) {
    return slots.map(s=>{
      const midpoint=s.at.getTime()+900000;
      const hourlyEnd=Math.ceil(midpoint/3600000)*3600000;
      const w=irradianceByHour.get(hourlyEnd);
      if (!Number.isFinite(w)||w<0)throw Error('Historical irradiance missing at '+new Date(hourlyEnd).toISOString()+'. Refusing to fill gaps.');
      const pvKW=Math.min(c.inverterKW, w/1000*c.pv*c.pr);
      return .5*pvKW*(1-c.derate/100);
    });
  }
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
  const api={version:VERSION,slotsFor,dayShift,dateGB,historicalSolar,simulate,compare,audit,demand,tariff,product};
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
    return historicalSolar(slots,hourlyMap,c);
  }
  function mount(){
    if(document.getElementById('foxHistoricalBacktestV20'))return;
    const main=document.querySelector('main');if(!main)return;
    const panel=el('section');panel.id='foxHistoricalBacktestV20';panel.className='panel';
    panel.style.cssText='margin:18px 0;padding:18px;border:1px solid #53769d;border-radius:14px';
    panel.append(el('h3','Historical profit backtesting · v2.0'));
    const intro=el('p','READ-ONLY RESEARCH · Real archived Octopus Outgoing Agile export prices and Open-Meteo historical solar irradiance; synthetic 300 W home demand and assumed 100% battery SOC at 05:30 each day. Historical weather reconstructed after the fact is NOT a historical day-ahead forecast. Results are hindsight illustrations, not real household earnings.');
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
    f.derate=field(form,'Historical solar stress reduction (%)',0,0,90);
    f.capacity=field(form,'Battery nominal (kWh)',10.24,1,50);
    f.soc=field(form,'SOC at 05:30 each day (%)',100,5,100);
    f.min=field(form,'Minimum SOC (%)',5,0,50);
    f.load=field(form,'Home baseline (kW)',.3,0,10);
    f.eff=field(form,'Battery charge / discharge efficiency (%)',95,1,100);
    f.chargeKW=field(form,'Max battery charge (kW)',5,.1,30);
    f.dischargeKW=field(form,'Max battery discharge (kW)',5,.1,30);
    f.exportKW=field(form,'DNO net export cap (kW)',3.5,.1,30);
    f.importP=field(form,'Avoided daytime import (p/kWh)',28,0,100);
    f.nightP=field(form,'Overnight recharge (p/kWh)',3.33,0,100);
    panel.append(form);
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
        const baseCosts=sum(results,r=>r.baselineCost),optCosts=sum(results,r=>r.optimisedCost),uplift=baseCosts-optCosts;
        const solarTotal=sum(results,r=>r.solar),forced=sum(results,r=>r.optimised.forced),baseExp=sum(results,r=>r.base.revenue),optExp=sum(results,r=>r.optimised.revenue);
        const importBase=sum(results,r=>r.base.grid),importOpt=sum(results,r=>r.optimised.grid);
        const min19=Math.min(...results.map(r=>r.optimised.at19/c.capacity*100));
        const auditWorst=Math.max(...results.map(r=>r.optimised.audit.worst),...results.map(r=>r.base.audit.worst));
        const positive=results.filter(r=>r.improvement>.005).length;
        const negativeRateSlots=rates.prices.filter(x=>x<0).length;
        const rowsPrice=rates.prices.length;
        status.textContent='COMPLETED · '+first+' to '+end+' · '+results.length+'/'+dCount+' feasible days · '+rowsPrice+' actual half-hour export prices ('+rates.rawRecords+' API rate records).';
        summary.textContent='HISTORICAL BACKTEST · RESULTS ARE NOT ACTUAL EARNINGS\n'+
          'Octopus tariff: '+tariff+' · West Midlands · actual historical rates inc. VAT\n'+
          'Archived weather-based solar estimate: '+fmt(solarTotal)+' kWh (110° orientation unless overridden)\n'+
          'Household load: SYNTHETIC '+fmt(c.load,2)+' kW ('+c.scenario+'); battery start: ASSUMED '+fmt(c.soc)+'% at 05:30 every day\n'+
          'Baseline: NO forced battery export; solar powers house / battery first\n'+
          'Baseline net variable energy cost: £'+fmt(baseCosts)+'\n'+
          'Optimised net variable energy cost: £'+fmt(optCosts)+'\n'+
          'MODELLED FINANCIAL IMPROVEMENT: '+(uplift<0?'-£'+fmt(-uplift):'+£'+fmt(uplift))+' across '+results.length+' days\n'+
          'Improvement per feasible day: £'+fmt(uplift/results.length)+'\n'+
          'Optimised forced battery export: '+fmt(forced)+' kWh · beneficial days: '+positive+'/'+results.length+'\n'+
          'Export revenue baseline / optimised: £'+fmt(baseExp)+' / £'+fmt(optExp)+'\n'+
          'Daytime grid import baseline / optimised: '+fmt(importBase)+' / '+fmt(importOpt)+' kWh\n'+
          'Lowest predicted 19:00 SOC: '+fmt(min19)+'% (target exactly 20%)\n'+
          'Worst energy-balance residual: '+fmt(auditWorst,6)+' kWh · negative-price half-hours: '+negativeRateSlots+'\n'+
          (bad.length?'INFEASIBLE / EXCLUDED DAYS: '+bad.map(x=>x.date).join(', ')+' (not counted in totals)\n':'')+
          '\nASSUMPTIONS: All days are independently initialised at the entered 05:30 SOC; overnight energy required to recharge to 100% is costed at the entered cheap import rate, assuming overnight charging is feasible. EV charging, household overnight load, battery degradation, standing charges are excluded. Avoided daytime import rate is an INPUT, not your verified bill.\n'+
          'HINDSIGHT WARNING: Open-Meteo archives approximate historical sunshine; they are NOT the forecasts that were available before each day. This backtest is therefore a hindsight scenario, not an achievable or verified profit forecast. Battery scheduling uses an approximate 0.05 kWh state grid and 0.10 kWh export actions; no proof of global optimality. Historical irradiation is NOT your actual PV production. No connection to Fox ESS, CT/Gen Load, Ohme or Home Assistant. No production learning or inverter control.';
        const t=el('table');t.style.cssText='width:100%;border-collapse:collapse;font-size:12px;min-width:670px';
        const header=el('tr');
        for(const name of ['UK date','Solar est. kWh','Forced export kWh','19:00 SOC %','23:30 SOC %','Baseline cost £','Optimised cost £','Improvement £']){
          const th=el('th',name);th.style.cssText='padding:7px;border-bottom:2px solid #53769d;text-align:left';header.append(th);
        }t.append(header);
        for(const r of results){
          const tr=el('tr');
          for(const v of [r.date,fmt(r.solar),fmt(r.optimised.forced),fmt(r.optimised.at19/c.capacity*100),fmt(r.optimised.end/c.capacity*100),fmt(r.baselineCost),fmt(r.optimisedCost),fmt(r.improvement)]){
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
'''
test=r''''use strict';
const assert=require('node:assert/strict');
const engine=require('./fox-backtest-v20.js');
const c={capacity:10.24,load:.3,chargeKW:5,dischargeKW:5,exportKW:3.5,pv:2.01,inverterKW:1.5,pr:.82,eff:.95,importP:28,nightP:3.33,min:5,target:20,soc:100,derate:0,tilt:35,bearing:110,scenario:'low'};
for(const date of ['2026-10-18','2026-10-25','2026-03-29']){
 const slots=engine.slotsFor(date);
 assert.equal(slots.length,36);
 assert.equal(slots[0].clock,5.5);
 assert.equal(slots[35].clock,23);
 for(let i=1;i<slots.length;i++)assert.equal(new Date(slots[i].utc)-new Date(slots[i-1].utc),1800000);
}
const s=engine.slotsFor('2026-10-18');
const prices=s.map(z=>z.clock>=16.5&&z.clock<18.5?38:8);
const radiance=s.map(z=>z.clock>=9&&z.clock<15?.1:0);
const trial=engine.compare(c,s,radiance,prices);
assert(trial.ok,JSON.stringify(trial));
assert(trial.improvement>=-0.01,'optimiser worse');
assert(trial.optimised.audit.worst<1e-6);
assert(trial.optimised.at19/c.capacity*100>=20-1e-6);
console.log('Standard day:',trial.improvement,trial.optimised.forced,trial.optimised.at19/c.capacity*100);
const neg=engine.compare(c,s,new Array(36).fill(0),new Array(36).fill(-10));
assert(neg.ok);
assert.equal(neg.optimised.forced,0);
assert.equal(neg.improvement,0);
const cloudy=engine.compare(c,s,new Array(36).fill(0),prices);
assert(cloudy.ok);
assert(cloudy.optimised.forced>=0);
assert(cloudy.optimised.audit.worst<1e-6);
const stressed=engine.compare({...c,scenario:'spike'},s,new Array(36).fill(0),prices);
assert(stressed.ok === false || stressed.optimised.audit.worst<1e-6);
console.log('High-load stress:',stressed.ok ? 'feasible' : stressed.reason);
const infeasible=engine.compare({...c,soc:20},s,new Array(36).fill(0),prices);
assert.equal(infeasible.ok,false);
assert.equal(engine.dayShift('2026-03-01',-1),'2026-02-28');
const irr=new Map();for(const z of s){const hourEnd=Math.ceil((z.at.getTime()+900000)/3600000)*3600000;irr.set(hourEnd,400)}
assert.equal(engine.historicalSolar(s,irr,c).length,36);
assert.throws(()=>engine.historicalSolar(s,new Map(),c),/missing/);
console.log('ALL TESTS PASS');
'''
temp=Path('fox-backtest-v20-check.js')
temp.write_text(js)
try:
    result=subprocess.run(['node','--check',str(temp)],capture_output=True,text=True)
    if result.returncode:
        raise SystemExit('STOP: JavaScript syntax failed: '+result.stderr)
    Path('fox-backtest-v20-selftest.js').write_text(test)
    # Test the exact script to be installed, via the normal final filename on completion.
    temp.replace('fox-backtest-v20.js')
    result=subprocess.run(['node','fox-backtest-v20-selftest.js'],capture_output=True,text=True)
    if result.returncode:
        raise SystemExit('STOP: Backtest model self-test failed. '+result.stdout+result.stderr)
    stamp=datetime.datetime.now().strftime('%Y%m%d-%H%M%S')
    for p in html:
        s=p.read_text()
        if 'fox-backtest-v20.js' in s:
            print('Already installed in '+str(p))
            continue
        p.with_name(p.name+'.bak-v20-'+stamp).write_text(s)
        s=s.replace('</body>', '<script src="fox-backtest-v20.js?v='+stamp+'"></script>\n</body>',1)
        p.write_text(s)
    print(result.stdout.strip())
    print('SUCCESS: v2.0 historical backtesting installed. Refresh preview-v2.html.')
    print('Read-only: no battery, Fox, Ohme, Home Assistant or production learning changes.')
finally:
    if temp.exists():temp.unlink()
PYINSTALL
