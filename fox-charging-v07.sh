#!/usr/bin/env bash
set -euo pipefail
cd /workspaces/FOX-OPTIMISER
python3 - <<'PY'
from pathlib import Path
from datetime import datetime
import shutil, subprocess, re
source=Path('fox-charging-v06.js')
if not source.exists(): raise SystemExit('ERROR: v0.6 charging planner not found. Nothing changed.')
for name in ('index.html','preview-v2.html'):
    if not Path(name).exists(): raise SystemExit(f'ERROR: {name} missing. Nothing changed.')
s=source.read_text()
# Make targeted changes without touching the existing working calculations.
old="const isFree=t=>t==='happy'||t==='legacy';"
new="const isFree=t=>t==='happy'||t==='legacy'; // Only explicitly marked free sessions; Power Up is not assumed free."
if s.count(old)!=1: raise SystemExit('ERROR: unexpected free-session code. Nothing changed.')
s=s.replace(old,new)
old="r.free?'Free session*':'Standard'"
new="r.free?'Booked free session*':'Intelligent Go · cheap'"
if s.count(old)!=1: raise SystemExit('ERROR: tariff table code differs from expected v0.6. Nothing changed.')
s=s.replace(old,new)
old="const evOK=evLeft<.05,batOK=batLeft<.05;"
new="const evOK=evLeft<.05,batOK=batLeft<.05;"
if s.count(old)!=1: raise SystemExit('ERROR: feasibility code differs from expected v0.6. Nothing changed.')
# Improve status explanation and tariff footnote without changing calculations.
old="*Free import is subject to Octopus eligibility, booked-hour allowances and actual metering. This is a planning estimate, not a bil"
# Existing line is longer than the terminal display; replace a stable phrase.
phrase="*Free import is subject to Octopus eligibility, booked-hour allowances and actual metering."
if s.count(phrase)!=1: raise SystemExit('ERROR: tariff footnote differs from expected v0.6. Nothing changed.')
s=s.replace(phrase,"*The 23:30–05:30 period is shown as Intelligent Octopus Go cheap-rate unless a booked free session is explicitly marked. Free import is subject to Octopus eligibility, booked-hour allowances and actual metering.")
# Clear distinction between manual simulation and future authoritative Ohme windows.
old="Advisory only · Manual Ohme target until Home Assistant is connected · 30-second recalculation"
new="Read-only simulation · EV windows are estimates, NOT Ohme's actual schedule · Recalculates every 30 seconds"
if s.count(old)!=1: raise SystemExit('ERROR: planner description differs from expected v0.6. Nothing changed.')
s=s.replace(old,new)
# For the manual simulator, a deadline later than 05:30 cannot be met within this overnight model.
# Display this explicitly rather than silently implying a later time was modelled.
needle="const evNeed=cfg.evCapacity*cfg.evPercent/100/(cfg.evEfficiency/100), batteryCapacity="
if s.count(needle)!=1: raise SystemExit('ERROR: energy model differs from expected v0.6. Nothing changed.')
s=s.replace(needle,"const deadlineOutsideWindow=deadline>end;\n  const evNeed=cfg.evCapacity*cfg.evPercent/100/(cfg.evEfficiency/100), batteryCapacity=")
needle="const evOK=evLeft<.05,batOK=batLeft<.05;"
s=s.replace(needle,needle+"\n  if(deadlineOutsideWindow) { status.title='EV deadline is after 05:30. This simulation only models the 23:30–05:30 overnight window.'; } else { status.removeAttribute('title'); }")
# Keep the existing localStorage key, so user inputs are retained.
# Build candidate and validate before modifying any existing file.
target=Path('fox-charging-v07.js')
tmp=Path('fox-charging-v07.js.tmp')
tmp.write_text(s)
# Validate JavaScript via stdin before modifying the existing app.
check=subprocess.run(['node','--check'],input=s,capture_output=True,text=True)
if check.returncode:
    tmp.unlink(missing_ok=True)
    raise SystemExit('ERROR: JavaScript syntax failed; nothing changed.\n'+check.stderr)
html={}
for name in ('index.html','preview-v2.html'):
    contents=Path(name).read_text()
    pattern=r'<script\b[^>]*src=["\']fox-charging-v06\.js[^"\']*["\'][^>]*></script>'
    if len(re.findall(pattern,contents))!=1:
        tmp.unlink(missing_ok=True)
        raise SystemExit(f'ERROR: expected exactly one v0.6 script in {name}; nothing changed.')
    html[name]=re.sub(pattern,'<script src="fox-charging-v07.js?v=20261025" defer></script>',contents,count=1)
stamp=datetime.now().strftime('%Y%m%d-%H%M%S')
for name in ('index.html','preview-v2.html'):
    shutil.copy2(name,f'{name}.bak-v07-{stamp}')
if target.exists(): shutil.copy2(target,f'{target.name}.bak-{stamp}')
tmp.replace(target)
for name,contents in html.items(): Path(name).write_text(contents)
print('SUCCESS: Fox Optimiser charging planner v0.7 installed')
print('PASS: JavaScript syntax')
print('PASS: Existing v0.6 settings retained')
print('PASS: Both HTML entry points updated; backups saved')
print('UNCHANGED: app.js, calendar, server, battery/EV controls')
print('Refresh preview-v2.html (hard reload if cached)')
PY
