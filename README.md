# @richardmcquiston01/seller-toolkit

<!-- prettier-ignore-start -->
- Author:  Richard McQuiston
- Website:  https://richardmcquiston.com/
<!-- prettier-ignore-end -->

## Overview

Framework-agnostic TypeScript toolkit for Etsy sellers: review-window
estimates, policy-safe thank-you message drafting, sales and listing
analytics, and report builders (HTML/CSV). Built on
[`@richardmcquiston01/etsy-api`](https://www.npmjs.com/package/@richardmcquiston01/etsy-api).
Never contacts buyers. Not affiliated with Etsy, Inc.

Every module is a set of pure functions: no network, no database, no
filesystem. Load your orders, reviews and listings however you like (Prisma,
SQL, a JSON file) and pass plain arrays and objects in. It runs unchanged in
Node, Bun and the browser, and ships both ESM and CommonJS builds with type
declarations.

Available now:

| Module          | Import path                                        | What it does                                                                                                                                                                    |
| --------------- | -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `review-window` | `@richardmcquiston01/seller-toolkit/review-window` | Estimates when Etsy's 100-day review window opens and closes for an order, from the ship or purchase date the Open API v3 actually exposes.                                     |
| `thank-you`     | `@richardmcquiston01/seller-toolkit/thank-you`     | Thank-you message templates with `{{PLACEHOLDERS}}`, rendering, machine detection from item titles, and `findPolicyProblem()`, which refuses incentives, rating asks and links. |

Everything is also exported from the package root. More modules (dashboard
widgets, unreviewed-order detection, view trends, report builders) are
planned; see [ROADMAP.md](./ROADMAP.md).

## Getting Started

### Prerequisites

- Node.js 18+ or Bun 1.3+ (or any modern browser bundler).
- TypeScript is optional; type declarations are included.

### Installation

```bash
bun add @richardmcquiston01/seller-toolkit
# or
npm install @richardmcquiston01/seller-toolkit
```

Both `import` and `require` work:

```ts
import { findPolicyProblem } from '@richardmcquiston01/seller-toolkit';
// or a single module
import { estimateReviewWindow } from '@richardmcquiston01/seller-toolkit/review-window';
```

```js
const { findPolicyProblem } = require('@richardmcquiston01/seller-toolkit');
```

### Usage

**Review windows.** Etsy lets a buyer review for 100 days from the earlier of
confirmed and estimated delivery (digital: from download). The API exposes
none of those dates, so the estimate uses the last ship date plus
`ASSUMED_TRANSIT_DAYS` (7), or the purchase date for digital-only orders.
Both err conservative: never ask before a buyer can review, or after they
can't.

```ts
import {
  daysLeftInWindow,
  estimateReviewWindow,
  isWindowOpen,
  latestDate,
} from '@richardmcquiston01/seller-toolkit/review-window';

const window = estimateReviewWindow({
  isDigitalOnly: false,
  purchasedAt: new Date('2026-09-01'),
  shippedAt: latestDate([new Date('2026-09-03'), null]),
  expectedShipAt: null,
});

if (window !== null && isWindowOpen(window, new Date())) {
  console.log(`${daysLeftInWindow(window, new Date())} days left to review`);
}
```

**Thank-you messages.** Render one of the three presets (`warm`,
`check-in`, `resources`) or your own template text, then copy it into Etsy
Messages yourself.

```ts
import {
  detectMachines,
  findPolicyProblem,
  renderThankYou,
} from '@richardmcquiston01/seller-toolkit/thank-you';

const message = renderThankYou('warm', {
  buyerName: 'KAREN BOWERS', // may be null: Etsy often omits it
  etsyReceiptId: '4089668331', // adds a link to the buyer's own order page on etsy.com
  itemTitles: ['xTool F2 Ultra UV Laser Jig – 25 Pencil Batch Fixture'],
  isDigitalOnly: false,
  machines: [{ machineName: 'xTool F2 Ultra', links: [] }],
  includeLinks: true,
  signature: 'McQ',
});
// "Hi Karen,\n\nThank you so much for ordering the F2 Ultra UV Laser Jig. ..."
```

### Examples

**Check seller-edited template text before saving it.** Run every template
body and every saved tip through `findPolicyProblem()`; it returns a specific
reason, or `null` when the text is fine.

```ts
findPolicyProblem('A product review on Etsy would mean a lot.'); // null
findPolicyProblem('Leave 5 stars for 10% off!'); // "offers something in return. ..."
findPolicyProblem('See www.myshop.com'); // "contains a link. ..."
```

**Detect which machine an order is for.** Longest keyword wins, so
"F2 Ultra" isn't also counted as "F1/F2".

```ts
detectMachines(
  ['xTool F2 Ultra UV Laser Jig'],
  [
    { id: 'f1f2', name: 'xTool F1/F2', matchKeywords: '' },
    { id: 'ultra', name: 'xTool F2 Ultra', matchKeywords: '' },
  ]
); // ['ultra']
```

**Use your own shop's defaults.** The defaults suit the McQForYouDesign shop
(xTool listings, signed "McQ"). Override them per call:

```ts
import {
  detectMachines,
  renderTemplate,
  shortenTitle,
} from '@richardmcquiston01/seller-toolkit/thank-you';

shortenTitle('Acme Rotary Jig – Tumbler Holder', [/^Acme\s+/i]); // "Rotary Jig"
detectMachines(titles, machines, /^Acme\s+/i); // strip "Acme" when deriving keywords

renderTemplate(body, {
  ...context,
  fallbackSignature: 'The Acme Shop', // used when `signature` is blank
  titlePrefixPatterns: [/^Acme\s+/i],
});
```

## What this package will never do

The draft-locally, paste-by-hand design is deliberate. This package:

- **Never contacts buyers.** It has no network code at all. There is no Etsy
  API for Messages, and this package will not send by scraping or by email
  harvested from receipts.
- **Never auto-sends.** Output is text for a person to read, edit and paste
  into Etsy Messages themselves. Requests to add auto-send will be declined.
- **Keeps review requests neutral.** The templates ask "A product review on
  Etsy would mean a lot." and nothing more: no discount, coupon, freebie or
  refund in exchange, and no request for a particular rating.
  `findPolicyProblem()` refuses all of those, and any URL, in template text.
  The only links a message carries are generated: the buyer's own order page
  on etsy.com, and per-machine "Helpful links" to free, non-commercial
  resources supplied by the caller, never another store.

These follow the Etsy API Terms of Use, §5:

- **(15)** no spam or unsolicited marketing communications.
- **(16)** no using the API to send members order, shipping or tracking
  information without Etsy's express written authorization.
- **(21)** no manipulating or artificially inflating a shop's statistics or
  engagement metrics, including ratings and reviews.
- **(2)** no diverting sales or migrating members off Etsy.
- **(24)** no automated systems or browser extensions that scrape Etsy.

Asking a real buyer for an honest review is fine. Automating that outreach
is not.

The term 'Etsy' is a trademark of Etsy, Inc. This package uses Etsy's API, but is not endorsed or certified by Etsy.

## Development

```bash
bun install
bun run typecheck
bun run lint
bun run format:check
bun run test
bun run build      # dist/: ESM (.js), CommonJS (.cjs) and .d.ts/.d.cts
```

Releases are published to npm by GitHub Actions when a `vX.Y.Z` tag is
pushed. **The `NPM_TOKEN` repository secret (an npm automation token) must be
added under Settings → Secrets and variables → Actions** before the first
release. See [CLAUDE.md](./CLAUDE.md) for the branch flow.

## Buy Me a Coffee

If this app, code, or repository has helped you or someone you know, please consider donating. I appreciate any help to offset the costs of development and/or AI Credits.

[**Donate via Stripe**](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800), or scan:

[![Donate via Stripe](./donate.svg)](https://donate.stripe.com/00w5kD3Gj1Xo9v7gVOcs800)

## License

Apache 2

## Copyright

<!-- prettier-ignore -->
(c)2026 Richard McQuiston.  All rights reserved.
