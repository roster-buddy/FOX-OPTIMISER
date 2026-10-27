#!/usr/bin/env bash
set -euo pipefail

python3 - <<'PY'
from pathlib import Path
from datetime import datetime
import re, subprocess, shutil

root = Path.cwd()
app = root / 'app.js'
index = root / 'index.html'
sessions = root / 'fox-free-sessions.js'

if not app.is_file() or not index.is_file():
    raise SystemExit('ERROR: Open a terminal in the FOX-OPTIMISER repository first.')
if 'FOX OPTIMISER V0.4 FOUNDATION' not in app.read_text():
    raise SystemExit('ERROR: Expected Fox Optimiser v0.4+ foundation not found. No changes made.')

js = r'''"use strict";
// FOX OCTOPUS SESSIONS V3 - Apple Calendar-inspired month/day editor
// Browser-local bookings only. No automatic Octopus opt-in or inverter commands.
(() => {
  if (document.getElementById('foxSessionsV3')) return;
  const STORE = 'fox-octopus-sessions-v1';
  const OVERRIDES = 'fox-octopus-sessions-overrides-v1';
  const LABELS = {
    happy: 'Weekend Happy Hour',
    powerup: 'Power Up reward',
    legacy: 'Earlier Free Electricity'
  };
  const free = kind => kind === 'happy' || kind === 'legacy';
  const pad = n => String(n).padStart(2, '0');
  const validDay = d => /^\d{4}-\d{2}-\d{2}$/.test(d) &&
    !Number.isNaN(Date.parse(d + 'T12:00:00Z')) &&
    new Date(d + 'T12:00:00Z').toISOString().slice(0, 10) === d;
  const validSlot = k => /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):(?:00|30)$/.test(k) && validDay(k.slice(0, 10));
  const clock = n => n === 48 ? '24:00' : `${pad(Math.floor(n / 2))}:${n % 2 ? '30' : '00'}`;
  const slot = (day, n) => `${day}T${clock(n)}`;

  const localDay = () => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit'
    }).formatToParts(new Date()).map(v => [v.type, v.value]));
    return `${p.year}-${p.month}-${p.day}`;
  };
  const decode = name => {
    try {
      const x = JSON.parse(localStorage.getItem(name) || '{}');
      return x && typeof x === 'object' && !Array.isArray(x) ? x : {};
    } catch { return {}; }
  };

  let saved = Object.fromEntries(Object.entries(decode(STORE)).filter(([k, v]) =>
    validSlot(k) && v && Object.hasOwn(LABELS, v.type)));
  let overrides = Object.fromEntries(Object.entries(decode(OVERRIDES)).filter(([k, v]) =>
    validDay(k) && v === true));
  let selected = localDay();
  let mode = 'month';

  const countFree = (day, entries = saved) => Object.entries(entries)
    .filter(([k, v]) => k.startsWith(day + 'T') && free(v.type)).length;
  const countAll = (day, entries = saved) => Object.keys(entries)
    .filter(k => k.startsWith(day + 'T')).length;
  const message = text => {
    const el = document.getElementById('foxSessionMessage');
    if (el) el.textContent = text;
  };
  const persist = (next, nextOverrides) => {
    // localStorage changes are atomic per key, and no existing records are removed on installation.
    localStorage.setItem(STORE, JSON.stringify(next));
    localStorage.setItem(OVERRIDES, JSON.stringify(nextOverrides));
    saved = next;
    overrides = nextOverrides;
  };
  const displayDate = day => new Date(day + 'T12:00:00Z').toLocaleDateString('en-GB', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  function updateSlots(indices, isChecked, type) {
    const next = { ...saved };
    const previous = countFree(selected);
    const clashes = indices.some(i => isChecked && next[slot(selected, i)] &&
      next[slot(selected, i)].type !== type);
    if (clashes && !confirm('These hours contain another session type. Replace those entries?')) {
      drawHours();
      return;
    }
    for (const i of indices) {
      if (isChecked) next[slot(selected, i)] = { type };
      else if (type === 'powerup') {
        // Unchecking a Power Up box does not delete a different type of session.
        if (next[slot(selected, i)]?.type === 'powerup') delete next[slot(selected, i)];
      } else {
        // A full-hour checkbox applies to one free session type only.
        if (next[slot(selected, i)]?.type === type) delete next[slot(selected, i)];
      }
    }
    const nextCount = countFree(selected, next);
    const nextOverrides = { ...overrides };
    if (nextCount > 4 && nextCount > previous && !overrides[selected]) {
      const approval = confirm(
        `Free electricity limit warning\n\nThe normal limit is 2 hours per day.\n` +
        `This would record ${(nextCount / 2).toFixed(1)} free hours on ${selected}.\n\n` +
        'Press OK to override this date, or Cancel to keep your original selections.'
      );
      if (!approval) { drawHours(); return; }
      nextOverrides[selected] = true;
    }
    if (nextCount <= 4) delete nextOverrides[selected];
    try {
      persist(next, nextOverrides);
      message(nextCount > 4 ? 'Two-hour limit overridden for this date.' : 'Session saved on this iPad.');
    } catch (error) {
      message('Could not save: ' + error.message + '. Download a backup.');
    }
    drawHours();
    decorateMonth();
  }

  function check(labelText, checked, partial, action) {
    const wrap = document.createElement('label');
    wrap.className = 'fox-session-checkbox';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = checked;
    box.indeterminate = partial;
    box.addEventListener('change', () => action(box.checked));
    wrap.append(box, document.createTextNode(labelText));
    return wrap;
  }

  function drawHours() {
    const rows = document.getElementById('foxSessionHours');
    if (!rows) return;
    rows.replaceChildren();
    const type = document.getElementById('foxSessionType').value;
    document.getElementById('foxSessionDayTitle').textContent = displayDate(selected);
    document.getElementById('foxSessionType').value = type;

    for (let h = 0; h < 24; h++) {
      const a = h * 2, b = a + 1;
      const currentA = saved[slot(selected, a)]?.type;
      const currentB = saved[slot(selected, b)]?.type;
      const row = document.createElement('div');
      row.className = 'fox-session-hour';
      const hour = document.createElement('strong');
      hour.textContent = `${clock(a)}–${clock(b + 1)}`;
      row.append(hour);

      if (type === 'powerup') {
        // Power Up can use half-hour periods; Happy Hour never shows half-hour checkboxes.
        for (const i of [a, b]) {
          row.append(check(`${clock(i)}–${clock(i + 1)}`,
            saved[slot(selected, i)]?.type === 'powerup', false,
            yes => updateSlots([i], yes, 'powerup')));
        }
      } else {
        const selectedCount = Number(currentA === type) + Number(currentB === type);
        row.append(check('Select whole hour', selectedCount === 2, selectedCount === 1,
          yes => updateSlots([a, b], yes, type)));
        if (selectedCount === 1) {
          const partial = document.createElement('small');
          partial.textContent = 'Previously saved half-hour; tick to complete the full hour';
          partial.className = 'fox-session-detail';
          row.append(partial);
        }
      }
      const present = [...new Set([currentA, currentB].filter(Boolean))];
      if (present.length) {
        const detail = document.createElement('span');
        detail.className = 'fox-session-detail';
        detail.textContent = present.map(t => LABELS[t]).join(' / ');
        row.append(detail);
        row.classList.add('fox-session-booked');
      }
      rows.append(row);
    }

    const n = countFree(selected);
    document.getElementById('foxSessionTally').textContent =
      `Free electricity: ${(n / 2).toFixed(1)} / 2 hours` +
      (n > 4 ? ' · OVERRIDE ACTIVE' : '') +
      ` · Total selected: ${(countAll(selected) / 2).toFixed(1)} hours`;

    const summary = document.getElementById('foxSessionSummary');
    summary.replaceChildren();
    let any = false;
    for (let i = 0; i < 48;) {
      const current = saved[slot(selected, i)];
      if (!current) { i++; continue; }
      let end = i + 1;
      while (end < 48 && saved[slot(selected, end)]?.type === current.type) end++;
      const pill = document.createElement('div');
      pill.className = 'fox-session-summary-line';
      pill.textContent = `${clock(i)}–${clock(end)}  ·  ${LABELS[current.type]}`;
      summary.append(pill);
      any = true;
      i = end;
    }
    if (!any) summary.textContent = 'No sessions recorded for this date.';
  }

  function monthDayString(year, month, day) {
    return `${year}-${pad(month + 1)}-${pad(day)}`;
  }

  function decorateMonth() {
    const grid = document.getElementById('v4CalendarGrid');
    if (!grid) return;
    const y = v4CalendarMonth.getFullYear(), m = v4CalendarMonth.getMonth();
    const offset = (new Date(y, m, 1).getDay() + 6) % 7;
    const days = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= days; d++) {
      const cell = grid.children[7 + offset + d - 1];
      if (!cell) continue;
      const day = monthDayString(y, m, d);
      cell.classList.add('fox-session-calendar-cell');
      cell.setAttribute('role', 'button');
      cell.setAttribute('aria-label', `Open ${day} sessions`);
      cell.tabIndex = 0;
      cell.onclick = () => openDay(day);
      cell.onkeydown = event => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          openDay(day);
        }
      };
      let badge = cell.querySelector('.fox-session-badge');
      const n = countAll(day);
      if (n > 0) {
        if (!badge) {
          badge = document.createElement('div');
          badge.className = 'fox-session-badge';
          cell.append(badge);
        }
        badge.textContent = `${(n / 2).toFixed(1)}h Octopus`;
      } else if (badge) badge.remove();
    }
  }

  function setMode(next) {
    mode = next;
    const monthGrid = document.getElementById('v4CalendarGrid');
    const dayPanel = document.getElementById('foxSessionDay');
    const monthHead = document.getElementById('foxSessionMonthHint');
    monthGrid.hidden = next !== 'month';
    dayPanel.hidden = next !== 'day';
    monthHead.hidden = next !== 'month';
    document.getElementById('foxMonthMode').setAttribute('aria-pressed', String(next === 'month'));
    document.getElementById('foxDayMode').setAttribute('aria-pressed', String(next === 'day'));
    if (next === 'day') drawHours();
    else decorateMonth();
  }

  function openDay(day) {
    if (!validDay(day)) return;
    selected = day;
    const y = +day.slice(0, 4), m = +day.slice(5, 7) - 1;
    if (v4CalendarMonth.getFullYear() !== y || v4CalendarMonth.getMonth() !== m) {
      v4CalendarMonth.setFullYear(y, m, 1);
      v4RenderCalendar();
    }
    setMode('day');
    message('');
    document.getElementById('foxSessionDayTitle').scrollIntoView({block: 'nearest'});
  }

  function moveDay(delta) {
    const d = new Date(selected + 'T12:00:00Z');
    d.setUTCDate(d.getUTCDate() + delta);
    openDay(d.toISOString().slice(0, 10));
  }

  function download() {
    const blob = new Blob([JSON.stringify({
      format: STORE, exported: new Date().toISOString(), sessions: saved, overrides
    }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'fox-octopus-sessions.json';
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    message('Sessions backup downloaded.');
  }

  async function restore(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 1000000) throw Error('Backup too large');
      const data = JSON.parse(await file.text());
      if (data.format !== STORE || !data.sessions ||
          typeof data.sessions !== 'object' || Array.isArray(data.sessions))
        throw Error('Incorrect backup format');
      const next = Object.fromEntries(Object.entries(data.sessions).filter(([k, v]) =>
        validSlot(k) && v && Object.hasOwn(LABELS, v.type)));
      if (Object.keys(next).length > 16000) throw Error('Too many entries');
      const nextOverrides = Object.fromEntries(Object.entries(data.overrides || {}).filter(([k, v]) =>
        validDay(k) && v === true));
      const days = [...new Set(Object.keys(next).map(k => k.slice(0, 10)))];
      const overLimit = days.filter(d => countFree(d, next) > 4 && !nextOverrides[d]);
      if (overLimit.length) {
        if (!confirm(`Backup has ${overLimit.length} date(s) above 2 free hours. Allow overrides?`)) return;
        for (const d of overLimit) nextOverrides[d] = true;
      }
      if (!confirm('Replace your saved Octopus sessions with this backup?')) return;
      persist(next, nextOverrides);
      drawHours();
      decorateMonth();
      message('Sessions restored successfully.');
    } catch (error) { message('Restore failed: ' + error.message); }
    finally { event.target.value = ''; }
  }

  function setup() {
    const calendar = document.getElementById('v4Calendar');
    const grid = document.getElementById('v4CalendarGrid');
    if (!calendar || !grid || typeof v4RenderCalendar !== 'function') {
      console.error('Fox Optimiser: savings calendar not ready.');
      return;
    }
    const css = document.createElement('style');
    css.textContent = `
      #v4CalendarGrid[hidden], #foxSessionDay[hidden], #foxSessionMonthHint[hidden] { display:none!important }
      #v4CalendarGrid .fox-session-calendar-cell { cursor:pointer; min-height:68px; text-align:left!important; padding:7px!important; }
      #v4CalendarGrid .fox-session-calendar-cell:hover { border-color:#65d5b2!important; }
      #v4CalendarGrid .fox-session-calendar-cell:focus-visible { outline:2px solid #7bdfc1; }
      .fox-session-badge { display:inline-block; color:#87f0ca; font-size:11px; margin-top:5px; line-height:1.2; }
      .fox-session-toolbar { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:center; gap:10px; margin:16px 0; }
      .fox-session-mode { display:flex; gap:6px; }
      .fox-session-mode button[aria-pressed="true"] { outline:2px solid #6ee7c0; }
      #foxSessionDay h3 { margin-bottom:12px; }
      .fox-session-day-toolbar { display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin:12px 0; }
      .fox-session-day-toolbar strong { flex:1; min-width:180px; }
      .fox-session-select { width:100%; max-width:500px; color:#eef5ff; color-scheme:dark; background:#0c1424; border:1px solid #405678; border-radius:8px; padding:12px; margin:12px 0; }
      .fox-session-hour { display:flex; flex-wrap:wrap; align-items:center; gap:12px; border-bottom:1px solid #32415b; padding:11px 6px; min-height:53px; }
      .fox-session-hour strong { min-width:115px; }
      .fox-session-booked { background:rgba(55,163,134,.09); }
      .fox-session-checkbox { display:inline-flex; align-items:center; gap:7px; cursor:pointer; font-size:13px; }
      .fox-session-checkbox input { height:20px; width:20px; accent-color:#5ee0b3; }
      .fox-session-detail { color:#96adc9; font-size:12px; }
      #foxSessionTally { font-weight:700; padding:12px; background:#182c42; border-radius:8px; margin:12px 0; }
      .fox-session-summary-line { padding:7px 0; border-bottom:1px solid #32415b; }
      .fox-session-actions { display:flex; gap:10px; flex-wrap:wrap; margin:15px 0; }
      #foxSessionMonthHint { color:#a8bed9; margin:8px 0; }
      @media(max-width:650px){ #v4CalendarGrid .fox-session-calendar-cell { min-height:55px; padding:3px!important; } .fox-session-badge { font-size:9px; } }
    `;
    document.head.append(css);

    const panel = document.createElement('div');
    panel.id = 'foxSessionsV3';
    panel.innerHTML = `
      <hr style="border:0;border-top:1px solid #334765;margin:24px 0">
      <div class="fox-session-toolbar">
        <h3 style="margin:0">Octopus Sessions</h3>
        <div class="fox-session-mode">
          <button type="button" class="secondary" id="foxMonthMode" aria-pressed="true">Month</button>
          <button type="button" class="secondary" id="foxDayMode" aria-pressed="false">Day</button>
        </div>
      </div>
      <p id="foxSessionMonthHint">Tap a calendar date above to see its hourly sessions and tick any you've opted into through Octopus.</p>
      <div id="foxSessionDay" hidden>
        <div class="fox-session-day-toolbar">
          <button type="button" class="secondary" id="foxBackToMonth">‹ Month</button>
          <button type="button" class="secondary" id="foxPreviousDay">‹</button>
          <strong id="foxSessionDayTitle"></strong>
          <button type="button" class="secondary" id="foxNextDay">›</button>
        </div>
        <label for="foxSessionType">Session type to select</label>
        <select id="foxSessionType" class="fox-session-select">
          <option value="happy">Weekend Happy Hour — full hours</option>
          <option value="powerup">Power Up reward — half-hour periods</option>
          <option value="legacy">Earlier Free Electricity — full hours</option>
        </select>
        <p class="note">Only tick sessions you've joined in Octopus. Happy Hours use whole-hour checkboxes. Two free hours per date is the default; extra hours require your confirmation.</p>
        <div id="foxSessionTally"></div>
        <div id="foxSessionHours"></div>
        <h3 style="margin-top:20px">Recorded sessions</h3>
        <div id="foxSessionSummary" class="note"></div>
        <div class="fox-session-actions">
          <button type="button" class="secondary" id="foxDownloadSessions">Download backup</button>
          <button type="button" class="secondary" id="foxRestoreSessions">Restore backup</button>
          <input type="file" id="foxSessionRestoreInput" accept=".json,application/json" hidden>
        </div>
        <p id="foxSessionMessage" class="note" aria-live="polite"></p>
        <p class="note">Selections stay in this browser until Home Assistant storage is connected. They do not opt you into Octopus or change the battery or car. Clock-change days require special handling of the repeated or missing 01:00 hour.</p>
      </div>`;
    calendar.append(panel);

    // The existing v0.4 calendar grid is *before* this panel. Keep its month grid as the single calendar.
    document.getElementById('foxMonthMode').onclick = () => setMode('month');
    document.getElementById('foxDayMode').onclick = () => openDay(selected);
    document.getElementById('foxBackToMonth').onclick = () => setMode('month');
    document.getElementById('foxPreviousDay').onclick = () => moveDay(-1);
    document.getElementById('foxNextDay').onclick = () => moveDay(1);
    document.getElementById('foxSessionType').onchange = drawHours;
    document.getElementById('foxDownloadSessions').onclick = download;
    document.getElementById('foxRestoreSessions').onclick = () => document.getElementById('foxSessionRestoreInput').click();
    document.getElementById('foxSessionRestoreInput').onchange = restore;

    const originalRender = v4RenderCalendar;
    v4RenderCalendar = function(...args) {
      originalRender(...args);
      decorateMonth();
      if (mode === 'day') drawHours();
    };
    decorateMonth();
    setMode('month');
  }

  // Future modelling code can read the exact saved booking selections.
  window.foxOctopusSessions = {
    getForDay(day) {
      if (!validDay(day)) return {};
      return Object.fromEntries(Object.entries(saved).filter(([key]) => key.startsWith(day + 'T')));
    },
    getFreeMinutes(day) { return validDay(day) ? 30 * countFree(day) : 0; },
    isOverride(day) { return overrides[day] === true; }
  };
  setup();
})();
'''

tmp = root / '.fox-sessions-v3-syntax-test.js'
try:
    tmp.write_text(js)
    result = subprocess.run(['node', '--check', str(tmp)], text=True, capture_output=True)
finally:
    tmp.unlink(missing_ok=True)
if result.returncode:
    raise SystemExit('ERROR: JavaScript syntax test failed. No changes made.\n' + result.stderr)

stamp = datetime.now().strftime('%Y%m%d-%H%M%S')
pages = []
pattern = r'<script\b[^>]*\bsrc=["\']fox-free-sessions\.js(?:\?[^"\']*)?["\'][^>]*></script>'
for name in ('index.html', 'preview-v2.html'):
    page = root / name
    if not page.exists():
        continue
    html = page.read_text()
    if '</body>' not in html:
        raise SystemExit('ERROR: Missing closing </body> in ' + name + '. No changes made.')
    html = re.sub(pattern, '', html)
    html = html.replace('</body>', '<script src="fox-free-sessions.js?v=' + stamp + '" defer></script></body>')
    pages.append((page, html))

for path in [sessions] + [p for p, _ in pages]:
    if path.exists():
        shutil.copy2(path, root / (path.name + '.backup-' + stamp))
sessions.write_text(js)
for path, text in pages:
    path.write_text(text)
print('SUCCESS: FOX OPTIMISER SESSIONS V3 INSTALLED')
print('JavaScript syntax: PASS')
print('Month calendar -> tap date -> full-day hourly view')
print('Happy Hour: 60-minute checkboxes only')
print('Power Up: 30-minute checkboxes available')
print('Default free import sessions: 2 hours per day; override available')
print('Existing browser selections and overrides: PRESERVED')
print('Read-only; no inverter commands')
print('Backups saved with suffix:', stamp)
print('Reload preview-v2.html in Safari.')
PY
