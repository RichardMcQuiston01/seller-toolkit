# ROADMAP

Modules planned for extraction from the McQForYouDesign etsy-dashboard, each
as its own subpath export. In every case the database code stays in the app:
the package takes plain arrays and objects that the consumer has already
loaded, and returns plain values.

## Shipped

- `review-window`: Etsy review-window estimates (0.1.0).
- `thank-you`: templates, placeholders, `findPolicyProblem()`, machine
  detection, product tips and the helpful-links block (0.1.0).

## Next

- **Dashboard widget builders.** KPIs with period comparison, revenue by
  month, digital vs physical, top products, purchases by country, rating
  breakdown, "viewed but not selling", stale listings, low stock, expiring
  soon, repeat buyers. One pure function per widget over receipt, listing,
  review and snapshot rows.
- **Unreviewed-order logic and pagination.** Which paid orders have no
  review yet and are inside the (estimated) review window, plus the
  filter/search/paginate helpers. Built on `review-window`; joins reviews to
  receipts by `transaction_id`.
- **View-trend deltas.** Difference consecutive daily listing snapshots
  into per-day view and favorite gains (`views` is lifetime cumulative,
  tabulated once a day).
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

## Never

Anything that contacts buyers, auto-sends messages, offers review
incentives, or scrapes Etsy. See "What this package will never do" in the
README.
