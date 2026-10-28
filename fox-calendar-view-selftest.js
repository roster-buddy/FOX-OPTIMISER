'use strict';
const assert=require('node:assert/strict');
const {setView}=require('./fox-calendar-view.js');
const nodes={};
function node(id){return nodes[id]={id,hidden:false};}
const toolbar=node('monthToolbar');
nodes.v4PreviousMonth={parentElement:toolbar};
node('foxCalendarExplanation');
node('foxCalendarMonthPnl');
node('foxCalendarLegend');
const booking=node('foxSessionDay'),calendar=node('v4CalendarGrid');
const doc={getElementById:id=>nodes[id]||null};
assert.equal(setView(doc,'day'),true);
for(const id of ['monthToolbar','foxCalendarExplanation','foxCalendarMonthPnl','foxCalendarLegend'])
 assert.equal(nodes[id].hidden,true,'Day view should hide '+id);
assert.equal(booking.hidden,false,'Bookings must not be hidden by the month-only display controller');
assert.equal(calendar.hidden,false,'Existing calendar controls own grid visibility');
assert.equal(setView(doc,'month'),true);
for(const id of ['monthToolbar','foxCalendarExplanation','foxCalendarMonthPnl','foxCalendarLegend'])
 assert.equal(nodes[id].hidden,false,'Month view should restore '+id);
assert.equal(setView(doc,'invalid'),false);
assert.equal(setView(null,'day'),false);
assert.equal(setView({getElementById:()=>null},'day'),true,'Missing optional nodes do not crash');
console.log('CALENDAR FOCUS PASS: mode switching hides only month content, preserves booking and calendar controls');
