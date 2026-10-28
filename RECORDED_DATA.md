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

## Verified battery DC-to-AC discharge comparison

The optional fox-discharge-flow.js module reconciles *battery output* separately from the utility meter's net grid export. Input streams are batteryDischargeDC and batteryDeliveredAC, each consisting of complete, measured interval kWh readings. The first must use source fox, verified:true and measurementPoint battery-dc-output. The second must use source fox, verified:true, measurementPoint battery-inverter-ac-output and attribution battery-only.

These verification tags are a future authenticated integration contract, **not evidence** that the Fox ESS inverter actually exposes these measurements or that they have been checked. In particular, on a hybrid inverter, total AC generation that includes solar is NOT battery-only AC. If a comparable battery-attributed AC output cannot be measured reliably, keep the DC/AC difference unavailable rather than estimating it from total grid export. Comparisons must use the same intervals and compatible, independently validated electrical measurement boundaries. A positive DC minus AC difference represents energy between those measurement points, which may include inverter losses or auxiliary usage. This is not the same as DC minus *net metered export*: battery output may serve the house or the EV, and concurrent solar may contribute to the meter.

Octopus metered export determines billable export receipts; force-specific export requires verified attribution within the measured battery-grid and overall net-export streams. DC-to-AC efficiency alone does not determine cash profit. Actual battery-energy acquisition costs must still flow from the historical battery storage lot ledger, including charging losses. Do not charge them twice or add gross forced export as new income on top of total export receipts.

The report's independent dischargeFlow field exposes DC kWh, battery-attributed AC kWh, and DC-to-AC kWh difference. The CSV exports these as energy-only rows with blank monetary columns. These values are unavailable without validated source data; there is no live Home Assistant or Fox ESS adapter yet.


## Stored-solar export gain: measured sources, energy loss and £4,800 payback

Direct solar fed into the battery is not free if it could otherwise have been sold at 12p/kWh. For every interval when measured solar input is diverted into storage, track its confirmed historical direct-export tariff and verified feasibility within the property's instantaneous export limit.

Solar stored in an existing grid-charged battery cannot be identified as physical electrons at discharge. The fox-solar-storage-ledger.js module therefore tracks solar-origin and grid-origin energy as separate accounting inventories and uses a documented pro-rata allocation at each discharge. This is an *attribution model* based on independently verified flow inputs, not an exact direct sensor for solar-sourced export. Carry both the source energy and its original missed direct-export opportunity through days.

The actual fox-solar-meter-reconcile.js interface requires aligned half-hour (or finer) energy measurements from a separately validated third-party solar Gen Load source, actual solar-to-battery charging AC, battery charging DC by solar/grid origin, battery total discharge DC split into house and export, battery AC delivered to house, battery AC delivered into the grid, direct solar export, and Octopus utility-meter net export. Battery-to-grid plus direct-solar grid export must match the utility meter in each interval. The meter determines cash revenue. Daily loss is checked as battery discharge DC minus AC delivered to both house and grid; it is not simply SOC decline minus meter export. Charge losses are solar input AC less solar stored DC, with comparable electrical measurement boundaries and validated CT polarity. The Gen Load reading is generation of a third-party source; by itself it is NOT battery charge energy. Do not invent solar-to-battery flow from it or from SOC change.

For exported solar-origin stored electricity: extra gain = attributed AC grid export × actual export price − the original AC solar charge input's pro-rata alternative immediate-export value − the applicable battery cycling/wear allowance. Both charge and discharge energy losses are present because the baseline values original solar input while the paid sale uses only energy reaching the meter. The house-bound solar-origin battery share also forfeits direct-export value; subtract that from the battery's house savings. Add solar-to-grid incremental benefit ONCE in the £4,800 tracker and never add total or gross force discharge revenue again. Missing validated source flows or confirmed direct-export opportunity must yield unavailable, not a fake gain.

Example: 10.24 kWh capacity, 10% solar energy is 1.024 kWh. Conditional on all 1.024 kWh being solar-origin and 80% reaching the grid, gross revenue at 29.8p is £0.2441216, direct sale at 12p would earn £0.12288 and extra profit is £0.1212416 before wear. A 50% SOC drop versus 40% of capacity metered export does not alone establish 20% conversion loss, because the battery may also have powered the home and its stored inventory may already contain grid energy. The pro-rata model will attribute only the solar-origin share of the actual metered battery export.
