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
