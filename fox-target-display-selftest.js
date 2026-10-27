
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('fox-charging-v08.js','utf8');
const a=source.indexOf('function renderTargetResearchV380(');
const b=source.indexOf('function compareTargetsV360()',a);
assert(a>=0&&b>a);
const nodes={};
function node(tag){
 return {
  tag,textContent:'',children:[],style:{},
  append(...items){this.children.push(...items);},
  replaceChildren(...items){this.children=items;this.textContent='';},
  insertAdjacentElement(position,item){nodes[item.id]=item;}
 };
}
nodes.foxTargetResultV360=node('p');
const ctx={
 document:{getElementById:id=>nodes[id],createElement:node}
};
vm.createContext(ctx);
vm.runInContext(source.slice(a,b),ctx);
const candidate={
 target:60,socAt0530:60,overnightKWh:5,at19:20,cost:1,
 result:{steps:[{
  utc:'2026-10-28T18:30:00Z',price:40,forced:1,
  solarStored:0,ending:2,checkpoint:true
 }]}
};
const full={...candidate,target:100,cost:1.25};
ctx.renderTargetResearchV380({
 best:candidate,full,candidates:[candidate,full],capacity:10
});
const text=n=>n.textContent+' '+n.children.map(text).join(' ');
let content=text(nodes.foxTargetTablesV380);
assert.match(content,/£0.25/);
assert.match(content,/20.00% · 19:00 checkpoint/);
assert.match(content,/60% overnight target/);
assert.match(content,/not the active dashboard export plan/);
assert.match(content,/18:30/);
const ledger=require('./fox-cost-ledger.js').summarise(
 {capacity:9,eff:1,refillP:7,wearP:0},
 [{utc:'2026-10-28T05:30:00Z',house:2,ev:1,solarHome:1,
   batteryHome:1,forced:1,naturalExport:0,chargeGrid:0,solarStored:0,
   importP:28,price:50,grid:1,ending:2}],
 {start:Date.parse('2026-10-27T23:30:00Z'),batDelivered:2,
  rows:[{segments:[{hours:.5,batteryKW:4,evKW:2,gridKW:7}]}]},2,1
);
ctx.renderTargetResearchV380({best:candidate,full,
 candidates:[candidate,full],capacity:10,ledger});
content=text(nodes.foxTargetTablesV380);
assert.match(content,/Your electricity costs, exports and savings/);
assert.match(content,/Overnight battery grid charging/);
assert.match(content,/EV grid charging, whole forecast period/);
assert.match(content,/Direct solar export/);
assert.match(content,/Battery export \(including stored solar\)/);
assert.match(content,/House and EV: energy supplied and savings/);
assert.match(content,/Cost if all demand came from grid/);
assert.match(content,/not meter readings or a bill/);
assert.match(content,/do not add them together/);
ctx.renderTargetResearchV380(null);
assert.equal(nodes.foxTargetTablesV380.children.length,0);
console.log('TARGET DISPLAY PASS: candidate benefit, selected schedule, SOC units, UK times and previous-result clearing');
