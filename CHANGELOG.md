# Changelog

All notable changes to `@richardmcquiston01/seller-toolkit` are recorded
here by [Changesets](https://github.com/changesets/changesets). Don't edit
entries by hand; add a changeset with `bun run changeset` instead.

## 0.2.0

### Minor Changes

- be8fd0f: Add the `insights` module (`@richardmcquiston01/seller-toolkit/insights`, also
  exported from the root): the McQForYouDesign etsy-dashboard's dashboard
  widgets and `buildDashboard`, unreviewed-order detection
  (`unreviewedOrdersFrom`) and per-day listing view trends
  (`computeListingViewTrends`), as pure functions over rows the caller loads.
  Dashboard thresholds are exported defaults (`DEFAULT_DASHBOARD_THRESHOLDS`)
  that `DashboardOptions.thresholds` can override.

## 0.1.0

### Minor Changes

- 4b8f8f9: Initial release: `review-window` (Etsy review-window estimates) and
  `thank-you` (policy-checked thank-you message templates, placeholders,
  `findPolicyProblem()`, machine detection), extracted unchanged from the
  McQForYouDesign etsy-dashboard. Shop-specific defaults (signature fallback,
  xTool title and machine-name prefixes) are exported constants that callers
  can override.
