'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const all=[];
function el(tag,id='',selectors=[]){const n={tag,id,children:[],dataset:{},attrs:{},textContent:'',hidden:false,selectors,
 setAttribute(k,v){this.attrs[k]=v;},append(...xs){this.children.push(...xs);},prepend(x){this.children.unshift(x);},replaceChildren(...xs){this.children=xs;},
 addEventListener(k,fn){this[k]=fn;},matches(s){return this.selectors.some(x=>s.split(',').includes(x));},
 querySelector(s){if(s==='h2')return this.title;return this.selectors.some(x=>s.split(',').includes(x))?{}:null;},querySelectorAll(){return [];}};all.push(n);return n;}
const main=el('main'),actual=el('section','foxActualCosts');actual.title=el('h2');
const payback=el('section','foxBatteryPayback');
const chart=el('section','',['#priceChart']),metrics=el('section','',['.metrics']),settings=el('section','',['#settings']),advanced=el('section','legacy');
main.children=[actual,payback,chart,metrics,settings,advanced];
let observer;
const context={document:{readyState:'complete',querySelector:s=>s==='main'?main:null,getElementById:id=>all.find(n=>n.id===id),createElement:tag=>el(tag)},MutationObserver:class{constructor(fn){observer=fn;}observe(node,options){assert.equal(node,main);assert.deepEqual(options,{childList:true});}}};
vm.createContext(context);
// Cross-realm option object: compare its properties, not prototypes.
context.MutationObserver=class{constructor(fn){observer=fn;}observe(node,options){assert.equal(node,main);assert.equal(options.childList,true);assert.equal(options.subtree,undefined);}};
vm.runInContext(fs.readFileSync('fox-dashboard-layout.js','utf8'),context);
const nav=all.find(n=>n.id==='foxDashboardNav');assert(nav);
assert(!actual.hidden&&!payback.hidden&&chart.hidden&&settings.hidden&&advanced.hidden);
const intro=all.find(n=>n.id==='foxDashboardIntro');
assert(intro.children.some(n=>n.id==='foxDashboardSummary'));
const summary=all.find(n=>n.id==='foxDashboardSummary');
assert(summary.children.some(n=>n.children.some(c=>c.textContent==='Awaiting connections')));
assert(summary.children.some(n=>n.children.some(c=>c.textContent==='£4,800 target')));
const select=label=>nav.children.find(n=>n.textContent===label).click();
select('Planning');assert(actual.hidden&&payback.hidden&&!chart.hidden&&!metrics.hidden);
const shortcut=intro.children.find(n=>n.textContent==='View daily finances');
assert(shortcut);shortcut.click();assert(!actual.hidden&&!payback.hidden);
select('Planning');
select('Settings');assert(!settings.hidden&&chart.hidden);
select('Advanced');assert(!advanced.hidden&&settings.hidden);
const late=el('section','foxChargeScenarioPanel');main.children.push(late);observer();assert(late.hidden);
select('Settings');assert(!late.hidden);assert(main.children.includes(chart),'Keep original chart node and handlers');
select('Daily costs');assert.equal(nav.children[0].attrs['aria-pressed'],'true');
const count=main.children.length;vm.runInContext(fs.readFileSync('fox-dashboard-layout.js','utf8'),context);assert.equal(main.children.length,count);
console.log('DASHBOARD LAYOUT PASS: view switching, dynamic panels, original nodes and repeat setup');
