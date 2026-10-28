/* Presentation only: keep panels and event handlers in place. */
(function(){
'use strict';
function setup(){
 const main=document.querySelector('main');if(!main||document.getElementById('foxDashboardNav'))return;
 const nav=document.createElement('nav');nav.id='foxDashboardNav';nav.setAttribute('aria-label','Dashboard sections');
 const intro=document.createElement('div');intro.id='foxDashboardIntro';
 const groups={actual:['Daily costs','Your electricity finances','Actual grid import, export, battery savings and your monthly calendar. Figures stay unavailable until measured readings are connected.'],planning:['Planning','Your battery plan','Explore public Agile prices and clearly labelled forecast scenarios. These are not live battery instructions.'],settings:['Settings','Your home setup','Manage planning assumptions, solar location and charging scenarios.'],tools:['Advanced','Research and testing','Optional historical simulations, demo finances and technical diagnostics.']};
 let active='actual';const buttons={};
 for(const [key,[label]] of Object.entries(groups)){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.className='secondary';
  button.addEventListener('click',()=>select(key));nav.append(button);buttons[key]=button;
 }
 main.prepend(intro);main.prepend(nav);
 function category(panel){
  if(['foxActualCosts','v4Calendar','foxBatteryPayback'].includes(panel.id))return 'actual';
  if(panel.matches('.hero,.metrics')||panel.querySelector('#priceChart,#schedule')||['foxSolarAwareV08Panel','foxDayTimeline','foxStressPanel'].includes(panel.id))return 'planning';
  if(panel.querySelector('#settings,#sampleBtn')||['solarV3Panel','foxChargingV06','foxChargeScenarioPanel','foxSessionsV3','exportPowerExplanation','foxSetupGuide'].includes(panel.id))return 'settings';
  return 'tools';
 }
 function refresh(){
  for(const panel of main.children){if(panel===nav||panel===intro)continue;panel.dataset.dashboardGroup=category(panel);panel.hidden=panel.dataset.dashboardGroup!==active;}
 }
 function select(key){
  active=key;
  for(const [name,button] of Object.entries(buttons)){button.setAttribute('aria-pressed',String(name===key));}
  intro.replaceChildren();const heading=document.createElement('h2');heading.textContent=groups[key][1];
  const copy=document.createElement('p');copy.textContent=groups[key][2];intro.append(heading,copy);
  const summary=document.createElement('div');summary.id='foxDashboardSummary';summary.className='fox-summary';
  const entries=key==='actual'?
   [['Recorded readings','Awaiting connections','No fabricated profit or loss'],
    ['Battery investment','£4,800 target','Payback requires verified history'],
    ['Monthly calendar','Daily net P&L','Includes EV import when recorded']]:
   key==='planning'?
   [['Battery reserve','20% at 19:00','Scenario target, not live SOC'],
    ['Net grid export','3.5 kW maximum','Instantaneous DNO limit'],
    ['Cheap import','23:30–05:30','Account eligibility must be confirmed']]:
   key==='settings'?
   [['Fox ESS EVO10','Not connected','No inverter commands'],
    ['Octopus / Ohme','Not connected','Current Charge Pack untouched'],
    ['Home Assistant','Not connected','Hardware and access required']]:
   [['Simulation only','No live dispatch','Test results are not real earnings'],
    ['Data integrity','Missing stays missing','No unverified actuals'],
    ['Safety','Installer validation needed','No physical fail-safe in browser']];
  for(const [name,value,note] of entries){
   const tile=document.createElement('div');tile.className='fox-summary-tile';
   const label=document.createElement('small');label.textContent=name;
   const strong=document.createElement('strong');strong.textContent=value;
   const detail=document.createElement('span');detail.textContent=note;
   tile.append(label,strong,detail);summary.append(tile);
  }
  intro.append(summary);
  if(key==='actual'||key==='planning'){
   const action=document.createElement('button');action.type='button';
   action.className='secondary fox-dashboard-shortcut';
   action.textContent=key==='actual'?'Explore battery planning':'View daily finances';
   action.addEventListener('click',()=>select(key==='actual'?'planning':'actual'));
   intro.append(action);
  }
  refresh();
 }
 const actual=document.getElementById('foxActualCosts');
 if(actual){
  actual.querySelector('h2').textContent='Daily electricity report';
  // Connection instructions are available on demand, not repeated above every total.
  const heading=Array.from(actual.querySelectorAll('h3')).find(x=>x.textContent==='Connections');
  if(heading){
   const details=document.createElement('details');details.className='foxDisclosure';
   const summary=document.createElement('summary');summary.textContent='Connections & tariff details · waiting for setup';details.append(summary);
   const nodes=[];let item=heading.nextElementSibling;
   // Stop before the always-visible financial cards or technical disclosures.
   while(item&&!['DIV','SECTION','DETAILS'].includes(item.tagName)){nodes.push(item);item=item.nextElementSibling;}
   heading.before(details);heading.remove();for(const node of nodes)details.append(node);
  }
 }
 const brand=document.querySelector('.brand p');if(brand)brand.textContent='Energy costs & planning';
 select(active);
 // Only direct panel additions need regrouping; table updates do not trigger this observer.
 new MutationObserver(refresh).observe(main,{childList:true});
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else if(document.readyState==='interactive')document.addEventListener('DOMContentLoaded',setup);else setup();
})();
