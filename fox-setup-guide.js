/* v38: Guided commissioning preparation only; no credentials or connections. */
(function(root){
'use strict';
const node=typeof module!=='undefined'&&module.exports;
const items=Object.freeze([
 ['Home Assistant','Choose and install supported always-on hardware; confirm local network access'],
 ['Fox ESS EVO10','Confirm inverter integration compatibility, supported sensors and safe read-only access'],
 ['Octopus Energy','Obtain account-specific import/export tariff access without disrupting Charge Pack'],
 ['Ohme Pro','Identify authorised EV charging data and avoid double-counting grid imports'],
 ['Energy meters','Validate CT clamp polarity, Gen Load solar meaning and meter reconciliation'],
 ['Battery and site','Confirm usable battery capacity, SOC, 3.5 kW instantaneous export and provisional 8.3 kW simultaneous import limits'],
 ['Safety','Have a competent installer verify local fail-safe stop, watchdog and inverter acknowledgement'],
 ['Commissioning','Prove lost connection prevents restart; enable live control only in a separately reviewed implementation']
]);
function readiness(input){
 const completed=Array.isArray(input)?input.filter((x,i)=>x===true&&i<items.length).length:0;
 return {total:items.length,prepared:completed,hardwareConnected:false,
  liveControlApproved:false,accountingApproved:false,credentialsCollected:false,
  message:'Preparation checklist only. Tick marks are user notes, not independent verification.'};
}
function setup(){
 const main=document.querySelector('main');if(!main||document.getElementById('foxSetupGuide'))return;
 const panel=document.createElement('section');panel.className='panel';panel.id='foxSetupGuide';
 const heading=document.createElement('h3');heading.textContent='Home Assistant connection guide';
 const warning=document.createElement('p');warning.className='note';
 warning.textContent='Pre-hardware checklist only. Do not enter API keys or passwords in this public website. No connectors are active and your existing Octopus Charge Pack is unchanged.';
 const status=document.createElement('p');status.id='foxSetupGuideStatus';status.setAttribute('aria-live','polite');
 const list=document.createElement('div');list.className='fox-setup-list';
 const selected=new Array(items.length).fill(false);
 const boxes=[];
 for(const [i,[name,description]] of items.entries()){
  const label=document.createElement('label');label.className='fox-setup-item';
  const box=document.createElement('input');box.type='checkbox';boxes.push(box);
  const text=document.createElement('span');const title=document.createElement('strong');title.textContent=name;
  const detail=document.createElement('small');detail.textContent=description;text.append(title,detail);
  label.append(box,text);list.append(label);
  box.addEventListener('change',()=>{selected[i]=box.checked;update();});
 }
 function update(){
  const r=readiness(selected);
  status.textContent=r.prepared+' / '+r.total+' preparation notes ticked · Not connected · Live control disabled';
 }
 const reset=document.createElement('button');reset.type='button';reset.className='secondary';reset.textContent='Clear checklist';
 reset.addEventListener('click',()=>{selected.fill(false);boxes.forEach(b=>b.checked=false);update();});
 const footer=document.createElement('p');footer.className='note';
 footer.textContent='Ticked notes last only until this page is reloaded. This is deliberately not a hardware readiness certificate, secure credential store or physical safety check.';
 panel.append(heading,warning,status,list,reset,footer);main.append(panel);update();
}
const api={items,readiness};
if(node)module.exports=api;else if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
})(typeof window!=='undefined'?window:globalThis);
