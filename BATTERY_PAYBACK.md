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