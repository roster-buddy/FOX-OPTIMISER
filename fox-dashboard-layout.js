/* Presentation only: keep panels and event handlers in place. */
(function(){
'use strict';
function setup(){
 const main=document.querySelector('main');if(!main||document.getElementById('foxDashboardNav'))return;
 const nav=document.createElement('nav');nav.id='foxDashboardNav';nav.setAttribute('aria-label','Dashboard sections');
 const intro=document.createElement('div');intro.id='foxDashboardIntro';
 const groups={actual:['Daily costs','Your recorded electricity day','Actual costs, exports and savings for 23:30–23:30.'],planning:['Planning','Plan the next day','Forecasts and Agile export scenarios. These are separate from your actual costs.'],settings:['Settings','Your setup','Battery assumptions, solar location and charging inputs.'],tools:['Advanced','Research and checks','Historical simulations, learning logs and development checks.']};
 let active='actual';const buttons={};
 for(const [key,[label]] of Object.entries(groups)){
  const button=document.createElement('button');button.type='button';button.textContent=label;button.className='secondary';
  button.addEventListener('click',()=>select(key));nav.append(button);buttons[key]=button;
 }
 main.prepend(intro);main.prepend(nav);
 function category(panel){
  if(['foxActualCosts','v4Calendar'].includes(panel.id))return 'actual';
  if(panel.matches('.hero,.metrics')||panel.querySelector('#priceChart,#schedule')||panel.id==='foxSolarAwareV08Panel')return 'planning';
  if(panel.querySelector('#settings,#sampleBtn')||['solarV3Panel','foxChargingV06','foxChargeScenarioPanel','foxSessionsV3','exportPowerExplanation'].includes(panel.id))return 'settings';
  return 'tools';
 }
 function refresh(){
  for(const panel of main.children){if(panel===nav||panel===intro)continue;panel.dataset.dashboardGroup=category(panel);panel.hidden=panel.dataset.dashboardGroup!==active;}
 }
 function select(key){
  active=key;
  for(const [name,button] of Object.entries(buttons)){button.setAttribute('aria-pressed',String(name===key));}
  intro.replaceChildren();const heading=document.createElement('h2');heading.textContent=groups[key][1];
  const copy=document.createElement('p');copy.textContent=groups[key][2];intro.append(heading,copy);refresh();
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
