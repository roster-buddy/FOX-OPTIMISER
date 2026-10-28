'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const markup=fs.readFileSync('fox-actual-costs.js','utf8');
const layout=fs.readFileSync('fox-dashboard-layout.js','utf8');
const screens=['index.html','preview-v2.html'];
const find=(needle)=>{const n=markup.indexOf(needle);assert(n>=0,'Missing '+needle);return n;};
const house=find('<section id="foxHouseBenefit"');
const battery=find('<details id="foxDischargeDetails"');
const batteryEnd=markup.indexOf('</details>',battery);
const houseEnd=markup.indexOf('</section>',house);
const ledger=find('<details id="foxActualReportDetails"');
const ledgerEnd=markup.indexOf('</details>',ledger);
const costs=find('id="foxActualRows"');
const reconciliation=find('id="foxActualReconciliation"');
assert(house<battery&&battery<batteryEnd&&batteryEnd<houseEnd,'Battery details remain nested inside visible financial summary');
assert(houseEnd<ledger&&ledger<costs&&costs<reconciliation&&reconciliation<ledgerEnd,'Full report is collapsed after key savings');
assert(!markup.slice(battery,battery+80).includes(' open'),'Technical disclosures start closed');
assert(!markup.slice(ledger,ledger+80).includes(' open'),'Ledger disclosure starts closed');
for(const id of ['foxHouseBaseline','foxHouseActual','foxHouseSaving','foxForcedEarned'])
 assert(markup.slice(house,houseEnd).includes('id="'+id+'"'),id+' stays in visible savings panel');
for(const id of ['foxDischargeDC','foxDischargeAC','foxDischargeLoss'])
 assert(markup.slice(battery,batteryEnd).includes('id="'+id+'"'),id+' stays accessible in expanded details');
assert(layout.includes("['DIV','SECTION','DETAILS'].includes(item.tagName)"),'Connections fold must not swallow the summary or technical details');
for(const name of screens){
 const html=fs.readFileSync(name,'utf8');
 assert(html.includes('Fox Optimiser · Read-only development preview · 28 Oct 2026'),name+' must not advertise v0.1');
 assert(!html.includes('Prototype v0.1'),name+' still displays stale prototype label');
 assert(html.includes('fox-actual-costs.js?v=473'),name+' must refresh costs UI');
 assert(html.includes('fox-dashboard-layout.js?v=473'),name+' must refresh layout');
 assert(html.includes('fox-dashboard-layout.css?v=473'),name+' must refresh CSS');
}
console.log('COMPACT DAILY COSTS PASS: visible savings, closed technical details, intact data targets and updated footer');
