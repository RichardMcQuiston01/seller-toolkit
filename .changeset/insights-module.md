---
'@richardmcquiston01/seller-toolkit': minor
---

Add the `insights` module (`@richardmcquiston01/seller-toolkit/insights`, also
exported from the root): the McQForYouDesign etsy-dashboard's dashboard
widgets and `buildDashboard`, unreviewed-order detection
(`unreviewedOrdersFrom`) and per-day listing view trends
(`computeListingViewTrends`), as pure functions over rows the caller loads.
Dashboard thresholds are exported defaults (`DEFAULT_DASHBOARD_THRESHOLDS`)
that `DashboardOptions.thresholds` can override.
