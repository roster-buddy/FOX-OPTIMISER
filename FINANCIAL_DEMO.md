# Fox Optimiser financial demonstration mode

This is an **optional, explicitly labelled synthetic demonstration**, not real electricity accounting. The user opens it with **Daily costs → Open sample figures**. It creates an illustrative October 2026 month with 31 fictional days. Selecting a date shows that day's household grid-only comparison, household supply cost, bill saving, simulated forced battery grid export and detailed energy balances. The monthly panel sums the household bill savings, gross forced-export revenue and two kinds of battery energy loss.

## Model scope

* Synthetic household demand is split into night and daytime use. The day/night baseline uses example prices of 3.4965p and 23.2995p per kWh. These are assumptions in the demo, not retrieved invoices or a guarantee of eligible Octopus smart-charge periods.
* Direct solar-to-house use and battery-to-house use reduce hypothetical household purchases. EV demand is **separate**; toggling EV changes grid import costs and cash balance but not household savings.
* Charge/discharge efficiencies are hypothetical 94% and 92%. Discharged DC electricity is greater than battery-delivered AC; the kWh difference is shown. No instantaneous 3.5 kW grid-export-cap compliance can be inferred from these daily energy totals.
* The model carries example purchased-energy cost and remaining stored kWh between days in a weighted stored-energy pool. Electricity charged from solar has zero purchase price but its opportunity cost (foregone export) is not part of the household bill saving.
* Gross forced-export receipts use an invented daily export price. They are a subset of the illustrative total metered grid export receipts (battery plus solar), not separate extra cash to add to net meter cash balance.
* The displayed forced-export margin subtracts attributed charging purchase cost and assumed 5p/kWh battery wear, but **is not genuine incremental force-discharge profit**: it omits the value of retaining energy for the house or a later export slot.
* The sample does not run an optimiser dispatch schedule, weather or half-hour EV charging eligibility, and does not use meter, Fox ESS, Ohme, live Octopus account, or Home Assistant data.

## Safety and isolation

The two demonstration modules `fox-financial-demo-core.js` and `fox-financial-demo-ui.js` do not call live APIs, read or write browser storage, or call actual reporting or inverter-control APIs. The demonstration panel is **closed by default**, with an amber sample label repeated inside. The real Daily costs table, CSV, P&L calendar and Happy Hour bookings are unchanged. There is no historical meter data fallback, no device connection, and no automatic actuals population.

GitHub Pages includes the demo as part of the read-only HTML entry point. The source's `fox-financial-demo-selftest.js` checks the example's accounting identities, month totals, 31 days, carried stored costs, EV exclusion, and separation from real data; it runs in the repository's existing GitHub Actions checks.
