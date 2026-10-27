
'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('app.js', 'utf8');

function extract(marker) {
  const start = source.indexOf(marker);
  assert(start >= 0, 'Missing function: ' + marker);
  const end = source.indexOf('\n}\n', start);
  assert(end > start, 'Missing function end');
  return source.slice(start, end + 3);
}
const helper = extract('function validateSolarHoursV310(');
const loader = extract('async function loadSolarForecastV3()');

const now = Date.parse('2026-10-27T12:15:00Z');
const begin = Math.floor(now / 3600000) * 3600000;
const times = Array.from({length: 26}, (_, i) =>
  new Date(begin + i * 3600000).toISOString().slice(0,16));
const zeros = times.map(() => 0);
const context = vm.createContext({});
vm.runInContext(helper, context);
const validate = context.validateSolarHoursV310;

assert.equal(validate(times, zeros, now).size, 26);
for (const bad of [null, undefined, NaN, Infinity, -1, '0', false]) {
  const values = [...zeros];
  values[3] = bad;
  assert.throws(() => validate(times, values, now));
}
assert.throws(() => validate([...times, times[0]], [...zeros, 0], now));
assert.throws(() => validate(times.slice(1), zeros.slice(1), now));
assert.throws(() => validate(times.slice(0,24), zeros.slice(0,24), now));
assert.throws(() => validate(times, [], now));
assert.throws(() => validate([], [], now));
const invalidTimes = [...times];
invalidTimes[0] = '2026-02-30T12:00';
assert.throws(() => validate(invalidTimes, zeros, now));
const gapTimes = times.filter((_, i) => i !== 8);
assert.throws(() => validate(gapTimes, gapTimes.map(() => 0), now));
// At an exact hour, 24 hourly entries cover all 48 half-hours.
assert.equal(validate(times.slice(0,24), zeros.slice(0,24), begin).size, 24);

async function checkLoader(valid) {
  const elements = {
    solarLatitude: {value:'52'},
    solarLongitude: {value:'-2'},
    solarForecastStatus: {textContent:''},
    solarForecastButton: {disabled:false}
  };
  const values = [...zeros];
  if (!valid) values[4] = null;
  let replans = 0;
  class Clock extends Date {
    static now() { return now; }
  }
  const ctx = vm.createContext({
    Date: Clock, Map, URLSearchParams, AbortController,
    setTimeout: () => 1, clearTimeout: () => {},
    document: {getElementById: id => elements[id]},
    localStorage: {setItem() {}},
    SOLAR_V3: {tilt:35, azimuth:-70},
    solarForecastActive: true,
    solarForecastHours: new Map([[begin, 100]]),
    v4LastSolarCheck: 123,
    v4UpdateRefreshStatus() {},
    solarKwh: () => 0,
    plan: () => { replans++; },
    window: {},
    fetch: async () => ({
      ok:true,
      json: async () => ({hourly:{
        time:times, global_tilted_irradiance:values
      }})
    })
  });
  vm.runInContext(helper + '\n' + loader, ctx);
  await ctx.loadSolarForecastV3();
  assert.equal(ctx.solarForecastActive, valid);
  assert.equal(ctx.v4LastSolarCheck, valid ? now : 123);
  assert.equal(ctx.solarForecastHours.size, valid ? 26 : 0);
  assert.equal(elements.solarForecastButton.disabled, false);
  assert.equal(replans, 1);
  assert.match(elements.solarForecastStatus.textContent,
    valid ? /0\.00 kWh/ : /Using estimated solar curve/);
}

(async () => {
  await checkLoader(false);
  await checkLoader(true);
  console.log('SOLAR INPUT PASS: zero accepted; invalid values, duplicates and coverage gaps rejected; fallback and timestamps verified');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
