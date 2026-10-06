# CLAUDE.md

Project memory for Claude Code. Read this before changing anything.

## What this is

`@richardmcquiston01/seller-toolkit`: a publishable, framework-agnostic
TypeScript package of pure helpers for Etsy sellers. It is being extracted,
module by module, from the McQForYouDesign `etsy-dashboard` app so other
consumers (for example Maker Toolkit's NestJS API) can reuse the same tested
logic. See `ROADMAP.md` for what comes next.

Current modules:

- `src/review-window.ts`: estimates Etsy's 100-day review window from ship or
  purchase dates (the API exposes no delivery or download date).
- `src/thank-you.ts`: thank-you templates, `PLACEHOLDERS`, rendering,
  `findPolicyProblem()`, machine detection, product tips, helpful links.

## Layout

```
src/
  index.ts            barrel: re-exports every module
  review-window.ts    subpath ./review-window
  thank-you.ts        subpath ./thank-you
test/                 *.test.ts (node:test + node:assert, run by Bun)
tsup.config.ts        one entry per public subpath
```

Adding a module: create `src/<module>.ts` (or `src/<module>/index.ts`), add it
to `src/index.ts`, to `tsup.config.ts` `entry`, to `package.json` `exports`
(import/require with types) and to `typesVersions` (so `node10` resolution,
still common in NestJS projects, finds the subpath types). Then add a
changeset.

## Commands (Bun only)

Bun is the package manager, script runner and test runner. Use `bun install`,
`bun run <script>` and `bunx`; never `npm`, `npx` or `tsx` locally. The
lockfile is `bun.lock` (committed). The only `npm` call is `npm publish` in
the release workflow, for provenance.

```bash
bun install
bun run typecheck      # src with no Node types, then tests with them
bun run lint           # ESLint flat config + typescript-eslint
bun run format         # Prettier, using .prettierrc.json
bun run format:check
bun run test           # bun test test
bun run build          # tsup → dist/ (ESM + CJS + .d.ts/.d.cts)
bun run changeset      # describe a change for the next release
```

## Dual ESM and CommonJS: required

The build must keep producing both ESM (`dist/*.js`) and CommonJS
(`dist/*.cjs`) with declarations for each (`.d.ts`, `.d.cts`). Maker
Toolkit's NestJS API compiles to CommonJS and `require()`s this package; an
ESM-only build would break it. Before releasing, check that both
`require('@richardmcquiston01/seller-toolkit')` under Node and an ESM
`import` load and expose the same functions.

## Runtime neutrality

The package must run in Node, Bun and browsers unchanged:

- `lib` is ES2023 with no DOM and `types: []` for `src/`, so Node globals
  don't typecheck there.
- No `node:*` imports, no `fs`, no `process`, no `Buffer`, no `Bun.*` in
  `src/` (ESLint enforces this). Tests may use `node:test`/`node:assert`.
- No network, no filesystem, no database. Pure functions in, plain values out.

## No database code

Consumers load their own data (Prisma, SQL, JSON...) and pass plain arrays
and objects. Never add Prisma, an ORM, a DB driver or storage code here. When
extracting a service from `etsy-dashboard`, split the pure part out and leave
the queries in the app.

## Boundaries: do not cross these

**This package must never send messages to buyers.** Not by API (Etsy has no
Messages endpoints), not by scraping, not by email harvested from receipts.
It produces text; a person pastes it into Etsy Messages by hand.

Etsy API Terms of Use §5, relevant clauses:

- **(15)** prohibits transmitting spam or unsolicited marketing
  communications.
- **(16)** prohibits using the API to send members order, shipping or
  tracking information without Etsy's express written authorization.
- **(21)** prohibits manipulating or artificially inflating a shop's
  statistics or engagement metrics, **including ratings and reviews**.
- **(2)** prohibits diverting sales or migrating members off Etsy.
- **(24)** prohibits automated systems or browser extensions that scrape
  Etsy.

Asking a real buyer for an honest review is fine. Automating that outreach is
not. The design decision (draft locally, paste manually) is deliberate and
load-bearing. **If asked to add auto-send, push back and explain why.**

Thank-you templates make a **neutral** review request only ("A product
review on Etsy would mean a lot."). Never add an incentive (discount, coupon,
freebie, refund) or ask for a particular rating; that's review manipulation
under Etsy's Seller Policy and §5(21).

**Keep `findPolicyProblem()` strict.** It refuses incentives, rating requests
and any URL in template text or tips. Never loosen it. The only links a
message may carry are generated: `{{PURCHASE_LINK}}` (the buyer's own order
page on etsy.com, where Etsy shows "Leave a review") and "Helpful links",
which must be free, non-commercial resources (manuals, settings guides,
tutorials), never the seller's own website or another store. The tests run
every default template through `findPolicyProblem()`; keep them passing.

Never write credentials or tokens into source, logs or committed files.

Trademark line (keep in the README): "The term 'Etsy' is a trademark of Etsy,
Inc. This package uses Etsy's API, but is not endorsed or certified by Etsy."

## Shop-specific defaults

The code came from one shop (xTool laser jigs, signed "McQ"). Those defaults
stay, but as exported, overridable constants: `DEFAULT_SIGNATURE` (or
`ThankYouContext.fallbackSignature`), `DEFAULT_TITLE_PREFIX_PATTERNS` (or
`shortenTitle(title, patterns)` / `ThankYouContext.titlePrefixPatterns`) and
`DEFAULT_MACHINE_NAME_PREFIX` (or the last argument of `keywordsFor` /
`detectMachines`). Changing a default changes output for existing consumers,
so treat it as a breaking change.

## Conventions

- TypeScript strict, plus `noUncheckedIndexedAccess`,
  `exactOptionalPropertyTypes`, `noImplicitReturns`, `noImplicitOverride`,
  `verbatimModuleSyntax`, `useUnknownInCatchVariables`. Array indexing yields
  `T | undefined`; handle it.
- Google TypeScript Style Guide; descriptive camelCase names; typed locals
  where they help.
- Functions return values the caller checks; reserve `throw` for programmer
  error. Error and problem messages are specific.
- Format with Prettier (`.prettierrc.json`); CI runs `format:check`.
- Tests: `node:test` + `node:assert`, run by `bun test`. No network, no
  database.

## Git and releases

- `dev` is the integration branch. Branch features off `dev`
  (`feature/...`) and open PRs into `dev`, never `main`.
- Each user-facing change gets a changeset (`bun run changeset`).
- To release: on `dev`, run `bunx changeset version` (bumps `package.json`,
  writes `CHANGELOG.md`), merge `dev` → `main`, then tag `main` with
  `vX.Y.Z` matching `package.json` and push the tag. The Release workflow
  builds, tests and runs `npm publish --provenance --access public` using the
  `NPM_TOKEN` repository secret.
- First release only: `package.json` already says 0.1.0, so running
  `changeset version` with the pending `minor` changeset
  (`.changeset/initial-extraction.md`) would publish 0.2.0. For v0.1.0,
  either tag as-is and delete that changeset in the release commit, or
  consume it and accept 0.2.0 as the first version.
- CI (`.github/workflows/ci.yml`) runs on PRs and on pushes to `dev`/`main`:
  install with `--frozen-lockfile`, typecheck, lint, format:check, test,
  build.
