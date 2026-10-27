
/* Read-only overnight simulation.
Powers are assumed constant within each segment.
EV connection and deadline are user assumptions.
All clock times use Europe/London.
No hardware commands. */
(function(root){
'use strict';

const half = 1800000;
const formatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/London',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

const clock = t => formatter.format(new Date(t));

function windowFor(now) {
  if (!Number.isFinite(now)) {
    throw Error('Invalid planning time');
  }

  const starts = [];
  const origin = Math.floor(now / half) * half;

  for (
    let t = origin - 86400000;
    t <= origin + 86400000;
    t += half
  ) {
    if (clock(t) === '23:30') starts.push(t);
  }

  for (const start of starts) {
    let end = start + half;

    while (
      end < start + 9 * 3600000 &&
      clock(end) !== '05:30'
    ) {
      end += half;
    }

    if (clock(end) !== '05:30') {
      throw Error('Cheap window end not found');
    }

    if (end > now) return {start, end};
  }

  throw Error('Cheap window not found');
}

function eventAt(start, label) {
  if (
    !/^\d{2}:\d{2}$/.test(label) ||
    Number(label.slice(0, 2)) > 23 ||
    Number(label.slice(3)) > 59
  ) {
    throw Error('Invalid UK clock time');
  }

  for (
    let t = start;
    t <= start + 27 * 3600000;
    t += 60000
  ) {
    if (clock(t) === label) return t;
  }

  throw Error('UK event time not found');
}

function simulate(c, now) {
  const numbers = [
    'evPercent', 'evCapacity', 'evKw', 'evEfficiency',
    'gridKw', 'houseKw', 'batteryKw', 'batteryEfficiency',
    'capacity', 'soc', 'target'
  ];

  if (
    !numbers.every(k => Number.isFinite(c[k])) ||
    c.evPercent < 0 || c.evPercent > 100 ||
    c.evCapacity <= 0 || c.evKw < 0 ||
    c.gridKw <= 0 || c.houseKw < 0 ||
    c.batteryKw < 0 ||
    c.evEfficiency <= 0 || c.evEfficiency > 100 ||
    c.batteryEfficiency <= 0 || c.batteryEfficiency > 100 ||
    c.capacity <= 0 || c.soc < 0 || c.soc > 100 ||
    c.target < 5 || c.target > 100
  ) {
    throw Error('Invalid overnight assumptions');
  }

  const {start, end} = windowFor(now);
  const connect = eventAt(start, c.evConnect);
  const deadline = eventAt(start, c.evDeadline);

  const evNeed =
    c.evCapacity * c.evPercent / 100 /
    (c.evEfficiency / 100);

  const batteryNeed =
    c.capacity * Math.max(0, c.target - c.soc) / 100 /
    (c.batteryEfficiency / 100);

  let evLeft = evNeed;
  let batLeft = batteryNeed;
  const rows = [];

  for (let t = start; t < end; t += half) {
    const finish = Math.min(end, t + half);
    const cuts = [
      t,
      ...[connect, deadline].filter(x => x > t && x < finish),
      finish
    ].sort((a, b) => a - b);

    let ev = 0;
    let bat = 0;
    const segments = [];

    for (let i = 0; i < cuts.length - 1; i++) {
      const at = cuts[i];
      const hours = (cuts[i + 1] - at) / 3600000;
      const available = Math.max(0, c.gridKw - c.houseKw);

      const evKW = at >= connect && at < deadline
        ? Math.min(c.evKw, available, evLeft / hours)
        : 0;

      const batteryKW = Math.min(
        c.batteryKw,
        Math.max(0, available - evKW),
        batLeft / hours
      );

      const evKWh = evKW * hours;
      const batteryKWh = batteryKW * hours;

      evLeft = Math.max(0, evLeft - evKWh);
      batLeft = Math.max(0, batLeft - batteryKWh);

      ev += evKWh;
      bat += batteryKWh;

      segments.push({
        at,
        hours,
        evKW,
        batteryKW,
        gridKW: c.houseKw + evKW + batteryKW
      });
    }

    const hours = (finish - t) / 3600000;

    rows.push({
      start: t,
      at: clock(t),
      ev: ev / hours,
      bat: bat / hours,
      grid: c.houseKw + (ev + bat) / hours,
      segments
    });
  }

  return {
    start,
    end,
    connect,
    deadline,
    rows,
    evNeed,
    batteryNeed,
    evDelivered: evNeed - evLeft,
    batDelivered: batteryNeed - batLeft,
    evShort: evLeft,
    batteryShort: batLeft,
    target: c.target,
    deadlineOutsideWindow: deadline > end,
    householdExceedsCap: c.houseKw > c.gridKw,
    predictedSoc:
      c.soc +
      (batteryNeed - batLeft) *
      (c.batteryEfficiency / 100) /
      c.capacity * 100
  };
}

const api = {windowFor, eventAt, simulate};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else {
  root.FoxOvernightCore = api;
}

})(typeof window !== 'undefined' ? window : globalThis);
