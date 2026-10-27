# Fox Optimiser development handover

Updated: 27 October 2026

## Current implementation
- Read-only dashboard with public Octopus export prices.
- Weather-based solar estimates, not measured solar production.
- Battery SOC and household demand remain assumptions.
- Historical backtest v2.2.1 includes overnight feasibility and assumed wear.
- Synthetic replanning tests cover solar and demand changes.
- Reserve-shortfall reporting verifies forced exports stop when infeasible.
- Data gate rejects missing, stale, invalid and future-dated readings.
- Solar surplus reduces available battery export headroom.
- v2.5 integrates the data gate into half-hour simulated export requests.
- v2.6 separately tests watchdog expiry and recovery behaviour.
- Successful price and solar load timestamps appear on the dashboard.

## Requirements
- Target: 20% SOC at 19:00, without an additional SOC buffer.
- Minimum SOC: 5%.
- Cheap charging window: 23:30–05:30 Europe/London.
- Maximum instantaneous net grid export: 3.5 kW.
- Provisional simultaneous grid import ceiling: 8.3 kW.
- Half-hour simulations cannot enforce instantaneous physical limits.

## Outstanding
- Confirm Home Assistant hardware and available read-only integrations.
- Obtain and validate real battery, solar and household readings.
- Validate CT polarity, units and measurement timestamps.
- Validate solar estimates against measured generation when available.
- Integrate watchdog behaviour with a persistent controller.
- Test command acknowledgement and physical inverter feedback.
- No live inverter or Ohme control is implemented.

## Development workflow
Use complete terminal-paste commands; no manual file edits or downloads.
Python port 8000 is the local static preview.
Keep the preview server in a separate terminal.
Stage named files only; do not publish backup files or credentials.

## Latest verification
- No Home Assistant hardware purchased or installed, confirmed 27 October 2026.
- Combined replanner, data gate and watchdog synthetic tests passed.
- Missing/stale readings block forced exports.
- Fresh readings alone cannot restart an interrupted plan.
- A new synthetic plan resumes exports and retains 20.43% SOC at 19:00
  in the tested recovery scenarios.
- The simulator still supplies known battery state to the planner.
  Delayed-state estimation and physical control remain untested.
