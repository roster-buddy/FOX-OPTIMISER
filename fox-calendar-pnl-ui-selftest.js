'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const dates=require('./fox-actual-costs.js');
const nodes={};
function el(tag){return {tagName:tag.toUpperCase(),children:[],dataset:{},attrs:{},textContent:'',className:'',append(...x){this.children.push(...x);},replaceChildren(...x){this.children=x;},setAttribute(k,v){this.attrs[k]=v;},before(x){if(x.id)nodes[x.id]=x;},after(){},remove(){}};}
const heading=el('h3'),calendar=el('section'),grid=el('div');
calendar.querySelector=()=>heading;calendar.children=[];
nodes.v4Calendar=calendar;nodes.v4CalendarGrid=grid;
let opened=0;
for(let i=0;i<42;i++){const cell=el('div');cell.children=[el('div'),el('div')];cell.onclick=()=>opened++;grid.children.push(cell);}
let baseRenders=0;
const ctx={Date,Map,Number,Array,String,document:{readyState:'complete',getElementById:id=>nodes[id],createElement:el},v4CalendarMonth:new Date('2026-10-01T12:00Z'),v4RenderCalendar(){baseRenders++;},window:{FoxActualReport:require('./fox-actual-report.js')}};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('fox-calendar-pnl.js','utf8'),ctx);
const offset=3,index=7+offset+25-1,cell=grid.children[index],handler=cell.onclick;
assert.equal(cell.dataset.pnl,'missing');
const w=dates.windowFor('2026-10-25');
const stream=value=>Array.from({length:(w.end-w.start)/1800000},(_,i)=>({start:w.start+i*1800000,end:w.start+(i+1)*1800000,source:'octopus',measured:true,value}));
const input={streams:{gridImport:stream(.1),gridExport:stream(.5)},tariffs:{import:[{...w,pence:10,confirmed:true}],export:[{...w,pence:20,confirmed:true}]}};
ctx.window.FoxCalendarPnl.recordDay('2026-10-25',input,w.end);
assert.equal(cell.dataset.pnl,'profit');assert.equal(cell.children[1].textContent,'£4.50');
assert.equal(cell.onclick,handler);cell.onclick();assert.equal(opened,1,'Happy Hour date handler remains attached');
assert.match(nodes.foxCalendarMonthPnl.children[0].textContent,/Recorded-day subtotal/);
assert.match(nodes.foxCalendarMonthPnl.children[1].textContent,/1 of 31 days/);
input.streams.gridExport=stream(0);
ctx.window.FoxCalendarPnl.recordDay('2026-10-25',input,w.end);assert.equal(cell.dataset.pnl,'loss');
ctx.v4CalendarMonth=new Date('2026-11-01T12:00Z');ctx.v4RenderCalendar();
assert.equal(baseRenders,1);assert.match(nodes.foxCalendarMonthPnl.children[0].textContent,/awaiting/);
console.log('CALENDAR UI PASS: green/red results, partial month, month navigation and preserved booking handler');
