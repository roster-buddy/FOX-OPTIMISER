
'use strict';
const assert=require('node:assert/strict');
const ev=require('./fox-ev-schedule-core.js');
const overnight=require('./fox-overnight-core.js');
const at=s=>Date.parse('2026-10-'+s+'Z');
const now=at('27T18:00:00');
const cfg={
 evPercent:15,evCapacity:61.7,evKw:6.63,evEfficiency:90,
 gridKw:8.3,houseKw:.4,batteryKw:5,batteryEfficiency:90,
 capacity:10,soc:5,target:100,
 evConnect:'23:30',evDeadline:'05:30'
};
const schedule=[
 {start:at('28T00:45:00'),end:at('28T01:15:00'),kw:6.63},
 {start:at('28T03:00:00'),end:at('28T03:30:00'),kw:6.63}
];
const result=overnight.simulate({...cfg,evSchedule:schedule},now);
assert(result.suppliedEVSchedule);
assert.equal(result.rows[0].ev,0);
assert.equal(result.rows[0].bat,5);
assert(Math.abs(result.evDelivered-6.63)<1e-7);
assert(result.evShort>0,'Do not invent extra EV slots to meet demand');
const segments=result.rows.flatMap(x=>x.segments);
for(const s of segments){
 const expected=ev.powerAt(schedule,s.at);
 assert.equal(s.evKW,expected,'Preserve supplied EV power and intervals');
 assert(s.gridKW<=cfg.gridKw+1e-7);
}
assert(segments.some(s=>s.at===at('28T00:45:00')&&s.evKW===6.63));
assert(segments.some(s=>s.at===at('28T01:15:00')&&s.evKW===0));

const empty=overnight.simulate({...cfg,evSchedule:[]},now);
assert.equal(empty.evDelivered,0);
assert(empty.evShort>0);

const overloaded=overnight.simulate({
 ...cfg,gridKw:6,
 evSchedule:[{start:at('27T23:30:00'),end:at('28T00:00:00'),kw:6.63}]
},now);
assert(overloaded.gridExceeded);
assert.equal(overloaded.rows[0].segments[0].evKW,6.63);
assert.equal(overloaded.rows[0].segments[0].batteryKW,0);

assert.throws(()=>ev.validate([
 schedule[0],{...schedule[0],start:at('28T01:00:00')}
],6.63),/Overlapping/);
assert.throws(()=>ev.validate([{...schedule[0],kw:8}],6.63));
assert.throws(()=>ev.validate([{
 start:'2026-10-28T01:00:00',end:'2026-10-28T02:00:00',kw:6
}],6.63),/timezone/);
console.log('EV SCHEDULE PASS: fixed intervals, gaps, partial half-hours, no invented charging and explicit grid conflicts');
