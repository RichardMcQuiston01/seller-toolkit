# ROADMAP

Modules planned for extraction from the McQForYouDesign etsy-dashboard, each
as its own subpath export. In every case the database code stays in the app:
the package takes plain arrays and objects that the consumer has already
loaded, and returns plain values.

## Shipped

- `review-window`: Etsy review-window estimates (0.1.0).
- `thank-you`: templates, placeholders, `findPolicyProblem()`, machine
  detection, product tips and the helpful-links block (0.1.0).
- `insights`: dashboard widget builders (KPIs with a period comparison,
  revenue by month, digital vs physical, top products, purchases by country,
  latest reviews and rating breakdown, closing-soon unreviewed orders,
  "viewed but not selling", stale listings, low stock, expiring soon, repeat
  buyers) with overridable thresholds; unreviewed-order detection
  (`unreviewedOrdersFrom`); and per-day view trends
  (`computeListingViewTrends`).

## Next

- **Report builders and report-document.** Inventory, account ledger and
  payments reports as a single `ReportDocument` model, rendered to a
  self-contained HTML file (no scripts) and CSV per table (formula-looking
  text defused).
- **ffmpeg argument builders.** Pure builders and parsers for splicing a
  branded intro/outro onto a listing video (args, probe parsing, range
  headers). The package builds arguments; it never spawns processes.
- **`EtsyApiPort` and the wrapper adapter.** The narrow port interface and
  the adapter onto `@richardmcquiston01/etsy-api`, mapping its responses to
  small camelCase domain types. This is the point at which the package takes
  a dependency on `@richardmcquiston01/etsy-api`.
- **Unreviewed-order pagination.** The filter/search/paginate helpers
  around unreviewed orders and drafts (`paginateUnreviewedOrders`,
  `paginateDrafts`, `normalizePaging`) are still in etsy-dashboard.

## Never

Anything that contacts buyers, auto-sends messages, offers review
incentives, or scrapes Etsy. See "What this package will never do" in the
README.
