# Battery investment recovery (£4,800)

The read-only dashboard starts with NO CLAIMED SAVINGS. The £4,800 target is the user's investment recovery threshold. The installation date and earlier recorded data are not yet known. Valid-day totals only cover verified history available in the app, not automatically the battery's lifetime.

## What counts

Battery-to-house bill savings, excluding EV charging and excluding direct solar-to-house benefit. The no-battery comparison assumes the solar panels are still installed and identical house demand at the actual historical tariff times. Battery supply includes verified charging purchase cost allocated from stored-energy history (including losses). Negative savings remain negative. The actual fox-household-benefit.js exposes batteryOnlySavingGbp and baselineWithoutBatteryGbp when verified data supports them; its older house-wide savings remain unchanged.

Only VERIFIED INCREMENTAL NET forced-export benefit may be added: the difference compared with the no-force-discharge alternative after actual charging costs, wear, remaining household-use value and alternative future export are considered. The current forceNet remains unavailable. Never add gross battery export receipts on top of export P&L or onto battery payback.

Solar-derived battery energy also has an opportunity cost where it could otherwise have been exported. The battery-only bill-saving measure does not fully price foregone export, finance, maintenance or battery depreciation. The result is a bill-based capital recovery view, not a complete return-on-investment calculation.

## Forecast policy

fox-battery-payback-core.js uses a transparent historical trend rather than claiming a trained AI model. No forecast unless at least 60 verified days are available across two calendar months, with >=85% coverage, a reading no older than 14 days, and positive recent average savings. Initially uses up to 120 recent days, with wide faster/slower run-rate scenarios. After >=300 verified days across 10 calendar months, month-of-year rates may inform seasonality. Forecasts will change with weather, usage and tariffs; they are not guarantees. Without validated data all values remain unavailable.

## Demonstration

The separate amber October 2026 DEMO counts only example battery-to-house saving towards £4,800. It uses a FLAT simulated October run rate to show an illustrative break-even month; this is NOT an AI prediction. Example solar-to-house savings and gross forced-export receipts never count towards that payback. Battery energy-loss details are collapsed to keep focus on money.

No actual-energy readings, browser persistence, public keys, credentials, live commands or Octopus booking data are written by this feature.

## Stored-solar export gain: measured sources, energy loss and £4,800 payback

Direct solar fed into the battery is not free if it could otherwise have been sold at 12p/kWh. For every interval when measured solar input is diverted into storage, track its confirmed historical direct-export tariff and verified feasibility within the property's instantaneous export limit.

Solar stored in an existing grid-charged battery cannot be identified as physical electrons at discharge. The fox-solar-storage-ledger.js module therefore tracks solar-origin and grid-origin energy as separate accounting inventories and uses a documented pro-rata allocation at each discharge. This is an *attribution model* based on independently verified flow inputs, not an exact direct sensor for solar-sourced export. Carry both the source energy and its original missed direct-export opportunity through days.

The actual fox-solar-meter-reconcile.js interface requires aligned half-hour (or finer) energy measurements from a separately validated third-party solar Gen Load source, actual solar-to-battery charging AC, battery charging DC by solar/grid origin, battery total discharge DC split into house and export, battery AC delivered to house, battery AC delivered into the grid, direct solar export, and Octopus utility-meter net export. Battery-to-grid plus direct-solar grid export must match the utility meter in each interval. The meter determines cash revenue. Daily loss is checked as battery discharge DC minus AC delivered to both house and grid; it is not simply SOC decline minus meter export. Charge losses are solar input AC less solar stored DC, with comparable electrical measurement boundaries and validated CT polarity. The Gen Load reading is generation of a third-party source; by itself it is NOT battery charge energy. Do not invent solar-to-battery flow from it or from SOC change.

For exported solar-origin stored electricity: extra gain = attributed AC grid export × actual export price − the original AC solar charge input's pro-rata alternative immediate-export value − the applicable battery cycling/wear allowance. Both charge and discharge energy losses are present because the baseline values original solar input while the paid sale uses only energy reaching the meter. The house-bound solar-origin battery share also forfeits direct-export value; subtract that from the battery's house savings. Add solar-to-grid incremental benefit ONCE in the £4,800 tracker and never add total or gross force discharge revenue again. Missing validated source flows or confirmed direct-export opportunity must yield unavailable, not a fake gain.

Example: 10.24 kWh capacity, 10% solar energy is 1.024 kWh. Conditional on all 1.024 kWh being solar-origin and 80% reaching the grid, gross revenue at 29.8p is £0.2441216, direct sale at 12p would earn £0.12288 and extra profit is £0.1212416 before wear. A 50% SOC drop versus 40% of capacity metered export does not alone establish 20% conversion loss, because the battery may also have powered the home and its stored inventory may already contain grid energy. The pro-rata model will attribute only the solar-origin share of the actual metered battery export.
