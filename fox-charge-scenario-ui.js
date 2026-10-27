/* Session-only simulations. No live connection or device commands. */
(()=>{
'use strict';
function setup(){
 const host=document.getElementById('foxChargingV06');
 if(!host)return;
 const panel=document.createElement('section');
 panel.className='panel';
 panel.innerHTML=`
 <h3>Smart / Max Charge simulation</h3>
 <p>Supplied intervals are simulations, not a live Ohme schedule.
 Regular 23:30–05:30 cheap charging applies independently.</p>
 <label>Mode <select data-mode>
 <option value="unknown">Unknown</option>
 <option value="smart">Smart Charge</option>
 <option value="max">Max Charge</option></select></label>
 <label><input type="checkbox" data-confirm>
 I confirm Smart Charge tariff eligibility for marked cheap windows</label>
 <div data-rows></div>
 <button type="button" data-add>Add interval</button>
 <button type="button" data-apply>Apply simulation</button>
 <button type="button" data-clear>Clear simulation</button>
 <p data-status role="status">No supplied scenario applied.</p>
 <p>Max Charge grants no extra cheap windows. EV power can be zero
 for a cheap window without car demand. Partial EV intervals use
 conservative whole-half-hour battery protection and charging headroom.
 Actual battery protection requires inverter charge/hold mode.
 These estimates cannot enforce instantaneous limits.</p>`;
 host.insertAdjacentElement('beforebegin',panel);
 const rows=panel.querySelector('[data-rows]');
 const status=panel.querySelector('[data-status]');
 function add(){
  const row=document.createElement('fieldset');
  row.innerHTML=`
   <legend>Supplied interval</legend>
   <label>Start <input type="datetime-local" data-start step="60"></label>
   <label>End <input type="datetime-local" data-end step="60"></label>
   <label>UTC offset for both times <select data-offset>
   <option value="+00:00">GMT (+00:00)</option>
   <option value="+01:00">BST (+01:00)</option></select></label>
   <label>EV power (kW) <input type="number" data-kw
    min="0" max="22" step="0.01" value="0"></label>
   <label><input type="checkbox" data-cheap>
    Confirmed extra Smart cheap window (half-hour boundaries)</label>
   <button type="button" data-remove>Remove</button>`;
  row.querySelector('[data-remove]').onclick=()=>row.remove();
  rows.append(row);
 }
 function refresh(){
  window.foxReplanChargingV430?.();
  window.foxChargingPlannerV06?.refresh();
 }
 panel.querySelector('[data-add]').onclick=add;
 panel.querySelector('[data-apply]').onclick=()=>{
  try{
   const scenario={
    mode:panel.querySelector('[data-mode]').value,
    confirmed:panel.querySelector('[data-confirm]').checked,
    evSchedule:[],smartWindows:[]
   };
   if(!rows.children.length)throw Error('Add an interval first.');
   for(const row of rows.children){
    const a=row.querySelector('[data-start]').value;
    const b=row.querySelector('[data-end]').value;
    const offset=row.querySelector('[data-offset]').value;
    const value=row.querySelector('[data-kw]').value;
    if(!a||!b||value.trim()==='')throw Error('Complete every interval.');
    const start=a+offset,end=b+offset,kw=Number(value);
    if(!Number.isFinite(Date.parse(start))||
       !Number.isFinite(Date.parse(end))||
       Date.parse(end)<=Date.parse(start)||
       !Number.isFinite(kw)||kw<0)
     throw Error('Invalid times or EV power.');
    if(kw>0)scenario.evSchedule.push({start,end,kw});
    if(row.querySelector('[data-cheap]').checked)
     scenario.smartWindows.push({start,end});
   }
   let cfg={};
   try{cfg=JSON.parse(localStorage.getItem('fox-charging-v06-settings')||'{}')||{}}catch{}
   window.FoxSmartChargeCore.segments(0,1800000,{
    ...scenario,cheapP:0,peakP:0,houseKW:0,
    gridKW:cfg.gridKw??8.3,evMaxKW:cfg.evKw??6.63
   });
   window.foxChargingScenarioV420=scenario;
   refresh();
   status.textContent='SIMULATION APPLIED · '+
    scenario.evSchedule.length+' EV intervals; '+
    scenario.smartWindows.length+' extra Smart windows. '+
    'Session only. Active overnight target remains 100%.';
  }catch(error){status.textContent='Not applied: '+error.message}
 };
 panel.querySelector('[data-clear]').onclick=()=>{
  delete window.foxChargingScenarioV420;
  refresh();
  status.textContent='Scenario cleared. Overnight EV estimates apply again.';
 };
 add();
}
if(document.readyState==='loading')
 document.addEventListener('DOMContentLoaded',setup);
else setup();
})();
