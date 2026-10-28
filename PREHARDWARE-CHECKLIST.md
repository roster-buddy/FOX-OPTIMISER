# Fox Optimiser — pre-hardware integration checklist (v28–v33)

**Status:** development-only, read-only simulation. No live Home Assistant, Fox ESS, Octopus or Ohme integration is claimed. No battery commands or independently enforced export limits exist in this browser app.

## Completed software preparations

- v28: connection readiness and recovery latch can be evaluated alongside a new scenario plan. After a simulated interruption, the old plan ID cannot be reused without a new plan and explicit acknowledgement.
- v29: conservative household-demand interval validation. Synthetic demand is clearly labelled; external forecasts remain unverified until calibrated against measured readings. Public weather is a separate advisory and is never counted as guaranteed battery refill.
- v30: price-ranked 27 half-hour daytime slots from 05:30–19:00 UK local time. Opportunity cost includes avoided peak import, efficiency-adjusted cheap import, foregone direct solar export and battery wear.
- v31: whole-day SOC ledger reserves 20% of assumed usable capacity at 19:00, deducts forecast household consumption and does not assume daytime solar charging. The existing overnight simulator checks EV priority, battery refill and the 8.3 kW provisional combined import cap.
- v32: integrated simulation tests for feasible/infeasible overnight charging, broken connection recovery, missing intervals, UK DST transitions and no live dispatch.
- v33: commissioning checklist below. Passing simulation tests does **not** prove safety or permit hardware control.

## Before any live integration

1. Install and configure supported Home Assistant hardware, and establish a reliable local connection to the inverter. Validate exact Fox ESS EVO10 integration compatibility and its supported control interface.
2. Obtain suitable credentials or authorised integration access without disabling the existing Octopus Charge Pack arrangement until the user explicitly chooses to migrate. Never store secrets in public GitHub Pages or browser source.
3. Independently confirm Fox ESS sensor measurement points and CT polarity. Specifically verify whether Gen Load represents PV generation and avoid treating it as direct battery charge.
4. Confirm Octopus account-specific import and export tariff eligibility, including Intelligent Octopus smart-charge periods, VAT and historical settlement rates. Ohme charging must be reconciled against grid import without double-counting.
5. Verify the battery's **usable** capacity, actual minimum SOC, charging/discharging efficiency, inverter AC power ratings and battery-source opening inventory. Confirm the requested 20% SOC at 19:00 under real household demand.
6. Have the installer confirm the **3.5 kW instantaneous net grid export** DNO limit and validate the **provisional 8.3 kW simultaneous grid import** assumption against actual supply constraints. Half-hour averages cannot establish compliance.
7. Commission an independent local watchdog and fail-safe for lost internet, HA outage, inverter communication timeout, stale readings, SOC anomalies, unexpected EV loads, failed command acknowledgement and site meter disagreement. Test that export actually stops, not just that the app reports zero.
8. Verify authenticated command acknowledgement, physical inverter feedback, control exclusivity and safe fallback to self-use. An interrupted plan must not automatically restart after recovery.
9. Only then evaluate a separately reviewed live control implementation. The current pre-hardware modules **always** report dispatchApproved:false and accountingApproved:false.

## Known limitations

The day planner is intentionally conservative: it treats all forecast house demand as battery demand, ignores future solar production, ranks export slots by price, and does not yet simulate dynamic PV, EV charging, battery charge-source provenance or real-time net grid power. Its simulated power is not a live setpoint. Its financial values are hypothetical, not actual earnings. The overnight and daytime modules are evaluated as separate scenario phases, not as a continuously calibrated real battery state across a full 24 hours.

**Stop point:** Software is ready for integration design and bench testing, not autonomous export. Hardware, credentials, authenticated data, installer validation and commissioning remain mandatory.
