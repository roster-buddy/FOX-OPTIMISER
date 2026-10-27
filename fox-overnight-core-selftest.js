
'use strict';

const assert = require('node:assert/strict');
const core = require('./fox-overnight-core.js');

const cfg = {
  evPercent:50,
  evCapacity:61.7,
  evKw:6.63,
  evEfficiency:90,
  gridKw:8.3,
  houseKw:.4,
  batteryKw:5,
  batteryEfficiency:90,
  capacity:10,
  soc:5,
  target:100,
  evConnect:'01:00',
  evDeadline:'05:30'
};

const now = Date.parse('2026-10-27T18:00:00Z');
const r = core.simulate(cfg, now);

assert.equal(
  new Date(r.start).toISOString(),
  '2026-10-27T23:30:00.000Z'
);
assert.equal(r.rows[0].ev, 0);
assert.equal(r.rows[0].bat, 5);

const after = r.rows.find(x => x.at === '01:00');
assert.equal(after.ev, 6.63);
assert(after.bat <= 1.27 + 1e-7);

for (const row of r.rows) {
  for (const segment of row.segments) {
    assert(segment.gridKW <= cfg.gridKw + 1e-7);
  }
}

assert(r.evShort > 0, 'Report infeasible EV requirement');

const constrained = core.simulate({
  ...cfg,
  evPercent:100,
  evConnect:'23:30'
}, now);

assert(
  constrained.batteryShort > 0,
  'Report battery shortfall when EV occupies the whole window'
);

const full = core.simulate({...cfg, evPercent:0}, now);
assert(Math.abs(full.predictedSoc - 100) < 1e-7);
assert.equal(
  full.rows.at(-1).bat,
  0,
  'Battery charging must not wait until the last slot'
);

const partial = core.simulate({
  ...cfg,
  evConnect:'00:45'
}, now);

const split = partial.rows.find(x => x.at === '00:30');
assert.equal(split.segments.length, 2);
assert.equal(split.segments[0].evKW, 0);
assert(split.segments[1].evKW > 0);

assert.equal(
  core.windowFor(Date.parse('2026-10-28T02:00:00Z')).start,
  r.start,
  'Retain the active cheap window after midnight'
);

for (const [day, count] of [
  ['2026-03-28T18:00:00Z', 10],
  ['2026-10-24T18:00:00Z', 14],
  ['2026-07-01T18:00:00Z', 12]
]) {
  const result = core.simulate({
    ...cfg,
    evPercent:0
  }, Date.parse(day));
  assert.equal(result.rows.length, count);
}

const summer = core.windowFor(
  Date.parse('2026-07-01T18:00:00Z')
);
assert.equal(new Date(summer.start).getUTCHours(), 22);

assert.throws(() => core.simulate({
  ...cfg,
  evConnect:'25:00'
}, now));

console.log(
  'OVERNIGHT PASS: early battery charging, later EV priority, ' +
  'segment import ceiling, shortfalls and UK DST windows'
);
