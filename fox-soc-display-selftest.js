
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app.js','utf8');
const start=source.indexOf('function renderForecastSocV330(');
const end=source.indexOf('function renderEmpty()',start);
assert(start>=0&&end>start);
const nodes={};
function node(tag){
 return {
  tag,style:{},textContent:'',children:[],
  append(...items){this.children.push(...items);},
  replaceChildren(...items){this.children=items;this.textContent='';},
  insertAdjacentElement(position,item){nodes[item.id]=item;}
 };
}
nodes.priceChart=node('canvas');
const formatter=new Intl.DateTimeFormat('en-GB',{
 timeZone:'Europe/London',hour:'2-digit',minute:'2-digit',hourCycle:'h23'
});
const time=t=>formatter.format(new Date(t));
const c={
 document:{
  getElementById:id=>nodes[id],
  createElement:node
 },
 settings:{soc:80},
 date:t=>new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/London',day:'2-digit',month:'short'
 }).format(new Date(t)),
 time,
 hour:t=>Number(time(t).split(':')[0]),
 mins:t=>Number(time(t).split(':')[1])
};
vm.createContext(c);
vm.runInContext(source.slice(start,end),c);
function text(n){
 return n.textContent+' '+n.children.map(text).join(' ');
}
function check(utc,soc,expected){
 c.renderForecastSocV330([{start:Date.parse(utc),socEnd:soc}]);
 const content=text(nodes.forecastSocPanel);
 assert.match(content,/SIMULATED/);
 assert.match(content,/manual|Starting assumption/);
 assert.match(content,/19:00/);
 assert.match(content,expected);
 assert.match(content,new RegExp(soc.toFixed(2).replace('.','\\.')+'%'));
}
// Winter and summer UTC offsets must both identify UK 19:00.
check('2026-10-27T18:30:00Z',20,/Target met in simulation/);
check('2026-07-01T17:30:00Z',19.5,/WARNING: below target/);
c.renderForecastSocV330([{
 start:Date.parse('2026-10-27T12:00:00Z'),socEnd:50
}]);
assert.match(text(nodes.forecastSocPanel),/19:00 prediction unavailable/);
assert.match(text(nodes.forecastSocPanel),/12:30/);
c.renderForecastSocV330([]);
assert.match(text(nodes.forecastSocPanel),/Forecast SOC unavailable/);
assert(!text(nodes.forecastSocPanel).includes('50.00%'));
assert(source.includes('function render(){renderForecastSocV330(lastPlan);'));
assert(source.includes('function renderEmpty(){renderForecastSocV330([]);'));
console.log('SOC DISPLAY PASS: half-hour end times, UK summer/winter 19:00, target warnings and expired-plan clearing');
