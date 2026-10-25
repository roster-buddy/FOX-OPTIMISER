# Fox Optimiser — MVP v0.1

A mobile-first, installable, **read-only** energy optimiser prototype for Fox ESS EVO10 owners on Intelligent Octopus Go import and Outgoing Agile export.

## What it does
- Fetches public Octopus Outgoing Agile half-hour prices (no Octopus API key required for public prices).
- Allows manual battery state of charge, household demand, solar forecast and tariff assumptions.
- Calculates a *conservative illustrative* schedule that prioritises protecting 2 kWh of battery storage and projected household use before the next cheap import period.
- Shows a half-hour price chart, planned actions, estimated export revenue and a CSV download.
- Stores settings only in the browser's local storage.
- Works as an installable web app (PWA) and caches the interface for offline access.

## Important limitations
- **Never sends control commands to Fox ESS.** No cloud key is needed and Octopus Charge Pack is not disturbed.
- No actual Fox ESS telemetry, solar forecast feed, house smart meter readings, battery capacity validation or charging control yet. All these are manual inputs. Live prices are fetched when available and clearly identified; otherwise sample prices must be deliberately selected.
- Estimates are planning aids, not dispatch-grade optimisation. It uses simplified constant round-trip/energy loss assumptions, half-hour load estimates, a fixed import rate and a heuristic, not a full dynamic-programming solver. The export rate is an AC export limit; actual battery/inverter performance may vary.
- Import tariff is user-entered; Intelligent Octopus Go can provide additional smart-charge periods not modelled here.
- Outgoing Agile and Charge Pack eligibility/compatibility must be confirmed with Octopus before any future live control.

## Run on GitHub Codespaces from iPad
1. Create a private GitHub repository named `fox-optimiser`.
2. Upload `index.html`, `app.js`, `styles.css`, `manifest.webmanifest`, `sw.js` and `icon.svg` into the repository root.
3. Open the repository in GitHub Codespaces.
4. Run `python3 -m http.server 8000` in the terminal.
5. In Codespaces **Ports**, set port 8000 visibility to **Private**, and open its forwarded URL.
6. In Safari use **Share → Add to Home Screen** if available.

For public hosting later, use HTTPS and avoid exposing any API credentials. Do not place a Fox ESS API key in browser-side code. A future controller needs a secure backend.

## Octopus tariff
Default export tariff is `E-1R-AGILE-OUTGOING-19-05-13-E` (region E / West Midlands). Change this to the exact export tariff shown on your Octopus account if different. The app requests `https://api.octopus.energy/v1/electricity-meter-points/...`? No: it uses the public product standard-unit-rates endpoint under `/v1/products/{product}/electricity-tariffs/{tariff}/standard-unit-rates/`.

## Safety
This app does not change inverter settings, SOC, export limits or schedules. No remote write features are implemented.
