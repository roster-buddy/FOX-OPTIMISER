'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ui=fs.readFileSync('fox-financial-demo-ui.js','utf8');
const css=fs.readFileSync('fox-dashboard-layout.css','utf8');
const ids=['foxDemoBaseline','foxDemoHouseCost','foxDemoHouseSaved','foxDemoForcedIncome',
 'foxDemoDaySolarGain','foxDemoDayDirectSolar','foxDemoHouseFlow','foxDemoBatteryFlow','foxDemoDetail'];
for(const id of ids){
 assert(ui.includes('id="'+id+'"'),'Must preserve existing daily figure '+id);
 assert(ui.includes("'"+id+"'"),'Must continue updating '+id);
}
assert(ui.includes('fox-demo-primary-stats'));
assert(ui.includes('fox-demo-cash-line'));
assert(ui.includes('Compare household costs and energy flows'));
assert(ui.includes('Technical export, discharge costs and meter balance'));
assert(ui.includes('How this fictional payback calculation works'));
assert(ui.includes('detail.replaceChildren()'),'Day switching must clear stale technical values');
for(const label of ['Solar-attributed battery electricity reaching grid',
 'Foregone direct export at 12p','Additional stored-solar export gain',
 'Margin before foregone alternatives','Grid cash balance','EV charging cost'])
 assert(ui.includes(label),'Technical calculation must retain '+label);
assert(ui.includes('DEMO · SIMULATED DATA ONLY'));
assert(ui.includes('Gross export earnings are already included in grid cash balance'));
assert(css.includes('.fox-demo-detail-list'));
assert(css.includes('.fox-demo-primary-stats'));
for(const page of ['index.html','preview-v2.html']){
 const html=fs.readFileSync(page,'utf8');
 assert(html.includes('fox-financial-demo-ui.js?v=486'),page+' must refresh demo UI');
 assert(html.includes('fox-dashboard-layout.css?v=487'),page+' must load updated CSS');
}
console.log('DEMO DAILY LAYOUT PASS: financial metrics retained, cash separated, technical disclosure accessible and refreshed');
