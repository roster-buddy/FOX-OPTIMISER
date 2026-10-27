/* Session-only simulations. No live connection or device commands. */
(()=>{
'use strict';
function setup(){
 const host=document.getElementById('foxChargingV06');
 if(!host)return;
 const panel=document.createElement('section');
 panel.className='panel';
 panel.id='foxChargeScenarioPanel';
 panel.innerHTML=`
 <style>
 #foxChargeScenarioPanel { line-height:1.5 }
 #foxChargeScenarioPanel label {
   display:flex;flex-direction:column;gap:6px;margin:10px 0;
   min-width:0;
 }
 #foxChargeScenarioPanel label:has(input[type="checkbox"]) {
   flex-direction:row;align-items:flex-start;gap:10px;
 }
 #foxChargeScenarioPanel fieldset {
   display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));
   gap:12px;padding:16px;margin:16px 0;
   border:1px solid #334861;border-radius:12px;min-width:0;
 }
 #foxChargeScenarioPanel input:not([type="checkbox"]),
 #foxChargeScenarioPanel select {
   box-sizing:border-box;width:100%;min-width:0;min-height:46px;
   padding:10px;font-size:16px;border:1px solid #49617e;
   border-radius:8px;background:#18283e;color:#edf3ff;
   color-scheme:dark;
 }
 #foxChargeScenarioPanel input[type="checkbox"] {
   width:22px;height:22px;flex-shrink:0;margin-top:2px;
 }
 #foxChargeScenarioPanel button { margin:6px 6px 6px 0 }
 #foxChargeScenarioPanel [data-status] { margin-top:14px }

 /* FOX_IPAD_DATE_FIX_451 */
 #foxChargeScenarioPanel fieldset {
   grid-template-columns:repeat(2,minmax(0,1fr));
   align-items:start;
 }
 #foxChargeScenarioPanel fieldset > label {
   min-width:0;overflow:hidden;
 }
 #foxChargeScenarioPanel input:not([type="checkbox"]),
 #foxChargeScenarioPanel select {
   display:block;width:100%;max-width:100%;min-width:0;
 }
 #foxChargeScenarioPanel input[type="datetime-local"] {
   min-height:50px;overflow:hidden;
 }
 #foxChargeScenarioPanel input::-webkit-date-and-time-value {
   text-align:left;min-width:0;
 }
 #foxChargeScenarioPanel fieldset > button {
   justify-self:start;align-self:center;
   min-height:44px;padding:10px 20px;
 }
 @media(max-width:600px) {
   #foxChargeScenarioPanel fieldset {
     grid-template-columns:minmax(0,1fr);
   }
 }

 </style>

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
  // Editable example times use the displayed GMT offset.
  // Creating a row does not apply a charging scenario.
  const next=Math.ceil(Date.now()/1800000)*1800000;
  row.querySelector('[data-start]').value=
   new Date(next).toISOString().slice(0,16);
  row.querySelector('[data-end]').value=
   new Date(next+1800000).toISOString().slice(0,16);
  // FOX_AUTO_END_452
  row.querySelector('[data-start]').addEventListener('change',()=>{
   const value=row.querySelector('[data-start]').value;
   if(!value)return;
   // Add 30 minutes to the entered clock time, including date rollover.
   const at=Date.parse(value+'Z');
   if(Number.isFinite(at))
    row.querySelector('[data-end]').value=
     new Date(at+1800000).toISOString().slice(0,16);
  });
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
  rows.replaceChildren();
  add();
  panel.querySelector('[data-mode]').value='unknown';
  panel.querySelector('[data-confirm]').checked=false;
  refresh();
  status.textContent='Scenario cleared. Overnight EV estimates apply again.';
 };
 add();
}
if(document.readyState==='loading')
 document.addEventListener('DOMContentLoaded',setup);
else setup();
})();
