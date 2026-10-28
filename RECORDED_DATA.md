# Actual accounting integration contract

Status: preparation only. No live adapters, credentials, network access or device control are implemented by these modules.

The actual report uses Europe/London days from 23:30 on the preceding date to 23:30 on the selected ending date. DST days contain 23 or 25 elapsed hours. Forecast comparison results must never populate actual accounting.

Future authenticated server/Home Assistant adapters should provide separate interval streams for each measured quantity. Use `FoxRecordedData.inspect` to check each stream and `FoxRecordedData.price` for recorded grid energy and historical applicable rates. These functions currently run in tests; connecting them to the dashboard awaits adapter implementation.

Energy record: `{start, end, value, source, measured:true}`. Timestamps are UTC epoch milliseconds; value is interval kWh, not instantaneous kW or a cumulative meter reading. Source is `octopus`, `fox`, `ohme` or `charger-meter`. A future adapter must authenticate and establish provenance: the source label alone is not proof of measurement. Convert cumulative readings with reset handling before submission.

Rate record: `{start, end, pence, confirmed:true}`. Pence/kWh must include VAT and be historically applicable. Negative prices are valid. Do not substitute planner defaults, current rates or unconfirmed Smart windows. If a rate changes within a measurement, obtain finer readings; do not assume uniform consumption.

Incomplete days, gaps, overlaps, duplicated intervals and boundary-crossing intervals return unavailable. A measured zero is valid. Never treat missing data as zero. Out-of-window valid readings are ignored; malformed timestamps are rejected.

Keep streams independent: incomplete charger data must not suppress complete metered grid totals. Main-meter energy cannot establish device/source splits. Battery input kWh is not battery output kWh. A battery's cost allocation also needs historical carried energy value and measured losses; leave savings unavailable without adequate evidence. Keep total export independent of unavailable solar/battery splits.

Standing charges are a separate dated charge, not a kWh tariff. Import/export pricing and standing charges must be reconciled to actual account data when available. Cash balance and avoided-import savings are separate views; do not add overlapping benefits.

Do not put API keys into public files or browser storage. Future server-side authentication, secure transport, history retrieval and UI connection are still required. Live activation requires Ben's explicit readiness instruction.

## Household savings and forced-discharge export accounting

The new fox-household-benefit.js module is read-only and has no live data sources or synthetic fallback.

House-only bill savings require complete matching half-hour measurements of houseDemand, houseGrid, houseDirectSolar, houseBattery and utility-meter gridImport. The first four streams must be independently verified as scope house-only with excludesEV:true. This excludes EV electricity even when the charger is wired into household circuits. For each interval, measured demand must equal grid plus direct solar plus battery delivered energy, and the household grid component must not exceed the metered import.

The comparison values the SAME measured house demand at each interval's actual confirmed historical import tariff, including eligible special smart-charging periods. Actual house cost includes directly metered grid cost plus battery cost allocated to electricity actually delivered to the house. Stored-energy allocations require historical charging inputs, grid purchase cost, solar origin, conversion losses and carried energy from prior days. Verified rates require the houseBatteryDeliveredCost tariff stream with confirmed:true and basis:verified-storage-lot-ledger. These interface flags do not prove that an authenticated source exists today. Do not calculate battery savings from SOC alone.

Verified forcedGridExport must represent battery-origin energy actually delivered to the GRID, not the inverter's force-discharge request or all inverter discharge. Each interval needs source:fox and attribution:verified-grid-export. It must not exceed recorded batteryExport or utility-meter gridExport for the same interval. Price only with confirmed historical export rates.

Gross forced export receipts are a SUBSET of total metered grid-export revenue already in P&L. Do not add them again to that P&L. Incremental profit from forcing export would also require the electricity's acquisition costs, wear and the credible no-force alternative, including foregone household self-use or future export opportunities. Leave incremental profit unavailable without that evidence.

Household bill savings exclude the opportunity cost of solar electricity that could otherwise have been exported and exclude wear until separately measured or reliably modelled. Do not advertise bill savings plus gross export receipts as final overall net profit. Monthly figures are independent subtotals over verified complete days with the number of valid days displayed. Missing data never counts as zero. Accounting uses Europe/London 23:30-to-23:30 periods, including DST.
