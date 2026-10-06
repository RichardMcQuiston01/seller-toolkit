import type { UnreviewedOrderSummary } from './unreviewed-orders.js';

/**
 * Shop dashboard numbers, worked out from rows the consumer has already
 * loaded (synced receipts, reviews, listings and daily view snapshots).
 * Nothing here calls Etsy or a database. Etsy's API has no Ads, visits,
 * conversion or search-term data at all, so none of that appears here.
 *
 * One pure function per widget, plus `buildDashboard`, which runs them all.
 * Results are JSON-ready: ids as strings, dates as ISO strings.
 */

export const DASHBOARD_PERIODS = ['30d', '90d', '365d', 'all'] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

export function isDashboardPeriod(value: string): value is DashboardPeriod {
  return (DASHBOARD_PERIODS as readonly string[]).includes(value);
}

const MS_PER_DAY = 86_400_000;

/** Length in days of each period except "all". */
export const DASHBOARD_PERIOD_DAYS: Readonly<
  Record<Exclude<DashboardPeriod, 'all'>, number>
> = {
  '30d': 30,
  '90d': 90,
  '365d': 365,
};

/** How many rows each "top N" widget shows. */
export const DASHBOARD_LIST_SIZE = 5;
/** Months in the revenue chart, including the current one. */
export const MONTHS_IN_CHART = 12;
/** An active listing with no sale for this long (and at least this old) is stale. */
export const STALE_AFTER_DAYS = 90;
/** Physical listings at or below this quantity are low on stock. */
export const LOW_STOCK_THRESHOLD = 2;
/** Active listings ending within this many days are "expiring soon". */
export const EXPIRING_WITHIN_DAYS = 14;
/** "Viewed but not selling" looks at views gained over this many days... */
export const VIEWED_WINDOW_DAYS = 30;
/** ...and lists listings that gained at least this many views but sold nothing. */
export const VIEWED_MIN_VIEWS = 25;

/** Every tunable number the dashboard widgets use. */
export interface DashboardThresholds {
  /** Rows per "top N" widget. */
  readonly listSize: number;
  /** Months in the revenue chart, including the current one. */
  readonly monthsInChart: number;
  /** No sale for this many days (and listed at least this long) is stale. */
  readonly staleAfterDays: number;
  /** Physical listings at or below this quantity are low on stock. */
  readonly lowStockThreshold: number;
  /** Active listings ending within this many days are expiring soon. */
  readonly expiringWithinDays: number;
  /** "Viewed but not selling" window, in days. */
  readonly viewedWindowDays: number;
  /** "Viewed but not selling" minimum views gained in that window. */
  readonly viewedMinViews: number;
}

/** The defaults, identical to the exported constants above. */
export const DEFAULT_DASHBOARD_THRESHOLDS: DashboardThresholds = {
  listSize: DASHBOARD_LIST_SIZE,
  monthsInChart: MONTHS_IN_CHART,
  staleAfterDays: STALE_AFTER_DAYS,
  lowStockThreshold: LOW_STOCK_THRESHOLD,
  expiringWithinDays: EXPIRING_WITHIN_DAYS,
  viewedWindowDays: VIEWED_WINDOW_DAYS,
  viewedMinViews: VIEWED_MIN_VIEWS,
};

/** The defaults with any given overrides applied. */
export function resolveDashboardThresholds(
  overrides: Partial<DashboardThresholds> = {}
): DashboardThresholds {
  const defaults: DashboardThresholds = DEFAULT_DASHBOARD_THRESHOLDS;
  return {
    listSize: overrides.listSize ?? defaults.listSize,
    monthsInChart: overrides.monthsInChart ?? defaults.monthsInChart,
    staleAfterDays: overrides.staleAfterDays ?? defaults.staleAfterDays,
    lowStockThreshold:
      overrides.lowStockThreshold ?? defaults.lowStockThreshold,
    expiringWithinDays:
      overrides.expiringWithinDays ?? defaults.expiringWithinDays,
    viewedWindowDays: overrides.viewedWindowDays ?? defaults.viewedWindowDays,
    viewedMinViews: overrides.viewedMinViews ?? defaults.viewedMinViews,
  };
}

/** Receipt statuses that don't count as a sale. */
const EXCLUDED_STATUSES: ReadonlySet<string> = new Set([
  'canceled',
  'fully refunded',
]);

// ---------------------------------------------------------------------------
// Input rows: minimal shapes, so any data layer can supply them.

export interface DashboardTransactionRow {
  readonly etsyListingId: bigint | null;
  readonly title: string | null;
  readonly quantity: number;
  readonly isDigital: boolean;
  /** Minor units. */
  readonly pricePerUnit: number | null;
}

export interface DashboardReceiptRow {
  readonly etsyReceiptId: bigint;
  readonly buyerUserId: bigint | null;
  readonly buyerName: string | null;
  /** Etsy's receipt status, e.g. "paid", "completed", "fully refunded". */
  readonly status: string;
  /** Minor units, including shipping and tax. */
  readonly grandTotalAmount: number;
  readonly currencyCode: string;
  readonly etsyCreatedAt: Date;
  /** ISO-3166 alpha-2 from the shipping address; often null. */
  readonly countryIso: string | null;
  readonly transactions: readonly DashboardTransactionRow[];
}

export interface DashboardReviewRow {
  readonly etsyListingId: bigint | null;
  readonly rating: number;
  readonly body: string | null;
  readonly etsyCreatedAt: Date;
}

export interface DashboardListingRow {
  readonly etsyListingId: bigint;
  readonly title: string;
  readonly state: string;
  /** Etsy's `listing_type`: "physical", "download" or "both". */
  readonly listingType: string | null;
  readonly quantity: number | null;
  readonly thumbnailUrl: string | null;
  readonly etsyCreatedAt: Date | null;
  readonly etsyUpdatedAt: Date | null;
  readonly endingAt: Date | null;
}

export interface DashboardSnapshotRow {
  readonly etsyListingId: bigint;
  readonly capturedOn: Date;
  /** Lifetime views at capture time. */
  readonly viewsTotal: number;
}

export interface DashboardInput {
  /** Paid, non-canceled receipts. Refunds are left out here by status. */
  readonly receipts: readonly DashboardReceiptRow[];
  readonly reviews: readonly DashboardReviewRow[];
  readonly listings: readonly DashboardListingRow[];
  readonly snapshots: readonly DashboardSnapshotRow[];
  /**
   * Already-computed unreviewed orders, e.g. from `unreviewedOrdersFrom`.
   * Only the fields in `UnreviewedOrderSummary` are read.
   */
  readonly unreviewedOrders: readonly UnreviewedOrderSummary[];
}

export interface DashboardOptions {
  readonly now: Date;
  readonly period: DashboardPeriod;
  /** IANA zone for month buckets, e.g. "America/New_York". */
  readonly timeZone: string;
  /** Overrides for `DEFAULT_DASHBOARD_THRESHOLDS`. */
  readonly thresholds?: Partial<DashboardThresholds> | undefined;
}

// ---------------------------------------------------------------------------
// Output (JSON-ready: ids as strings, dates as ISO strings).

export interface SalesTotals {
  readonly orders: number;
  /** Order totals in minor units, including shipping and tax. */
  readonly revenue: number;
  readonly units: number;
  /** Minor units; null without orders. */
  readonly averageOrderValue: number | null;
}

export interface MonthlySales {
  /** "2026-10" */
  readonly month: string;
  readonly orders: number;
  readonly revenue: number;
}

export interface CountrySales {
  /** ISO-3166 alpha-2, or null when Etsy didn't return an address. */
  readonly countryIso: string | null;
  readonly orders: number;
  readonly revenue: number;
}

export interface RecentOrder {
  readonly etsyReceiptId: string;
  readonly purchasedAt: string;
  readonly buyerName: string | null;
  readonly itemTitles: readonly string[];
  readonly totalAmount: number;
  readonly currencyCode: string;
  readonly countryIso: string | null;
  readonly hasDigital: boolean;
  readonly hasPhysical: boolean;
}

export interface TopProduct {
  readonly etsyListingId: string | null;
  readonly title: string;
  readonly thumbnailUrl: string | null;
  readonly unitsSold: number;
  /** Line-item price × quantity, minor units (excludes shipping and tax). */
  readonly revenue: number;
}

export interface LatestReview {
  readonly etsyListingId: string | null;
  readonly listingTitle: string | null;
  readonly rating: number;
  readonly body: string | null;
  readonly createdAt: string;
}

export interface RatingBreakdown {
  /** Index 0 is one star, index 4 is five stars. */
  readonly counts: readonly [number, number, number, number, number];
  readonly total: number;
  /** One decimal; null without reviews. */
  readonly average: number | null;
}

export interface ClosingSoonOrder {
  readonly etsyReceiptId: string;
  readonly buyerName: string | null;
  readonly itemTitles: readonly string[];
  readonly daysLeftToReview: number;
  readonly thanked: boolean;
}

export interface ListingAlert {
  readonly etsyListingId: string;
  readonly title: string;
  readonly thumbnailUrl: string | null;
  /** What the widget is about: views gained, quantity, days to expiry... */
  readonly value: number;
  /** A related date: last sale, expiry... null when there is none. */
  readonly date: string | null;
}

export interface ListingAlertList {
  readonly items: readonly ListingAlert[];
  /** How many matched before cutting to the list size. */
  readonly total: number;
}

export interface ViewedNotSelling extends ListingAlertList {
  /** The snapshot span compared, or null with fewer than two daily snapshots. */
  readonly fromDate: string | null;
  readonly toDate: string | null;
}

export interface ViewsGained {
  readonly views: number;
  readonly listings: number;
  readonly fromDate: string;
  readonly toDate: string;
}

export interface RepeatBuyer {
  readonly buyerName: string | null;
  readonly orders: number;
  readonly lastOrderAt: string;
}

export interface RepeatBuyers {
  /** Buyers Etsy identified (buyer_user_id), in the period. */
  readonly buyers: number;
  readonly repeatBuyers: number;
  /** Orders by repeat buyers. */
  readonly repeatOrders: number;
  readonly top: readonly RepeatBuyer[];
}

export interface FulfilmentMix {
  readonly units: number;
  readonly revenue: number;
  /** Orders with at least one line item of this kind. */
  readonly orders: number;
}

export interface Dashboard {
  readonly generatedAt: string;
  readonly period: DashboardPeriod;
  readonly periodStart: string | null;
  /** The shop's (most common) currency; totals only add orders in it. */
  readonly currencyCode: string | null;
  /** Orders in other currencies, left out of money totals. */
  readonly otherCurrencyOrders: number;
  readonly totals: SalesTotals;
  /** The same length of time just before the period; null for "all". */
  readonly previousTotals: SalesTotals | null;
  readonly viewsGained: ViewsGained | null;
  readonly monthly: readonly MonthlySales[];
  readonly countries: readonly CountrySales[];
  readonly recentOrders: readonly RecentOrder[];
  readonly topProducts: readonly TopProduct[];
  readonly latestReviews: readonly LatestReview[];
  readonly ratings: RatingBreakdown;
  readonly closingSoon: readonly ClosingSoonOrder[];
  readonly unreviewedTotal: number;
  readonly viewedNotSelling: ViewedNotSelling;
  readonly staleListings: ListingAlertList;
  readonly lowStock: ListingAlertList;
  readonly expiringSoon: ListingAlertList;
  readonly repeatBuyers: RepeatBuyers;
  readonly mix: {
    readonly digital: FulfilmentMix;
    readonly physical: FulfilmentMix;
  };
}

// ---------------------------------------------------------------------------
// Widgets.

/** Start of the period, or null for all time. */
export function periodStart(period: DashboardPeriod, now: Date): Date | null {
  return period === 'all'
    ? null
    : new Date(now.getTime() - DASHBOARD_PERIOD_DAYS[period] * MS_PER_DAY);
}

/**
 * The earliest snapshot date `buildDashboard` reads for `period` (the
 * period, or the "viewed but not selling" window if longer), or null for
 * all time. Lets a consumer load only the snapshots it needs.
 */
export function snapshotsNeededSince(
  period: DashboardPeriod,
  now: Date,
  thresholds: Partial<DashboardThresholds> = {}
): Date | null {
  if (period === 'all') return null;
  const days: number = Math.max(
    DASHBOARD_PERIOD_DAYS[period],
    resolveDashboardThresholds(thresholds).viewedWindowDays
  );
  return new Date(now.getTime() - days * MS_PER_DAY);
}

/** Paid, not canceled and not fully refunded. */
export function isCountedSale(
  receipt: Pick<DashboardReceiptRow, 'status'>
): boolean {
  return !EXCLUDED_STATUSES.has(receipt.status);
}

function inRange(date: Date, from: Date | null, to: Date): boolean {
  return (
    (from === null || date.getTime() >= from.getTime()) &&
    date.getTime() < to.getTime()
  );
}

/** The currency most orders are in; null without orders. */
export function dominantCurrency(
  receipts: readonly DashboardReceiptRow[]
): string | null {
  const counts = new Map<string, number>();
  for (const receipt of receipts) {
    counts.set(
      receipt.currencyCode,
      (counts.get(receipt.currencyCode) ?? 0) + 1
    );
  }
  let best: string | null = null;
  let bestCount: number = 0;
  for (const [code, count] of counts) {
    if (
      count > bestCount ||
      (count === bestCount && best !== null && code < best)
    ) {
      best = code;
      bestCount = count;
    }
  }
  return best;
}

export function salesTotals(
  receipts: readonly DashboardReceiptRow[]
): SalesTotals {
  let revenue: number = 0;
  let units: number = 0;
  for (const receipt of receipts) {
    revenue += receipt.grandTotalAmount;
    for (const transaction of receipt.transactions) {
      units += transaction.quantity;
    }
  }
  return {
    orders: receipts.length,
    revenue,
    units,
    averageOrderValue:
      receipts.length === 0 ? null : Math.round(revenue / receipts.length),
  };
}

/** "2026-10" for `date` in `timeZone`. */
export function monthKey(date: Date, timeZone: string): string {
  const parts: Intl.DateTimeFormatPart[] = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(date);
  const year: string =
    parts.find((part) => part.type === 'year')?.value ?? '0000';
  const month: string =
    parts.find((part) => part.type === 'month')?.value ?? '00';
  return `${year}-${month}`;
}

/** The last `count` month keys ending with the one `now` falls in, oldest first. */
export function lastMonthKeys(
  now: Date,
  timeZone: string,
  count: number
): string[] {
  const [yearText, monthText] = monthKey(now, timeZone).split('-');
  let year: number = Number(yearText);
  let month: number = Number(monthText);
  const keys: string[] = [];
  for (let index = 0; index < count; index += 1) {
    keys.unshift(`${year}-${String(month).padStart(2, '0')}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }
  return keys;
}

export function monthlySales(
  receipts: readonly DashboardReceiptRow[],
  now: Date,
  timeZone: string,
  months: number = MONTHS_IN_CHART
): MonthlySales[] {
  const buckets = new Map<string, { orders: number; revenue: number }>(
    lastMonthKeys(now, timeZone, months).map((key) => [
      key,
      { orders: 0, revenue: 0 },
    ])
  );
  for (const receipt of receipts) {
    const bucket = buckets.get(monthKey(receipt.etsyCreatedAt, timeZone));
    if (bucket === undefined) continue;
    bucket.orders += 1;
    bucket.revenue += receipt.grandTotalAmount;
  }
  return [...buckets.entries()].map(([month, bucket]) => ({
    month,
    ...bucket,
  }));
}

/** Orders and revenue per country, most orders first; "unknown" (null) last. */
export function salesByCountry(
  receipts: readonly DashboardReceiptRow[]
): CountrySales[] {
  const byCountry = new Map<
    string | null,
    { orders: number; revenue: number }
  >();
  for (const receipt of receipts) {
    const entry = byCountry.get(receipt.countryIso) ?? {
      orders: 0,
      revenue: 0,
    };
    entry.orders += 1;
    entry.revenue += receipt.grandTotalAmount;
    byCountry.set(receipt.countryIso, entry);
  }
  return [...byCountry.entries()]
    .map(([countryIso, entry]) => ({ countryIso, ...entry }))
    .sort((left, right) => {
      if ((left.countryIso === null) !== (right.countryIso === null)) {
        return left.countryIso === null ? 1 : -1;
      }
      return (
        right.orders - left.orders ||
        right.revenue - left.revenue ||
        (left.countryIso ?? '').localeCompare(right.countryIso ?? '')
      );
    });
}

function toRecentOrder(receipt: DashboardReceiptRow): RecentOrder {
  return {
    etsyReceiptId: receipt.etsyReceiptId.toString(),
    purchasedAt: receipt.etsyCreatedAt.toISOString(),
    buyerName: receipt.buyerName,
    itemTitles: receipt.transactions
      .map((transaction) => transaction.title)
      .filter((title): title is string => title !== null && title !== ''),
    totalAmount: receipt.grandTotalAmount,
    currencyCode: receipt.currencyCode,
    countryIso: receipt.countryIso,
    hasDigital: receipt.transactions.some(
      (transaction) => transaction.isDigital
    ),
    hasPhysical: receipt.transactions.some(
      (transaction) => !transaction.isDigital
    ),
  };
}

export function recentOrders(
  receipts: readonly DashboardReceiptRow[],
  limit: number = DASHBOARD_LIST_SIZE
): RecentOrder[] {
  return [...receipts]
    .sort(
      (left, right) =>
        right.etsyCreatedAt.getTime() - left.etsyCreatedAt.getTime()
    )
    .slice(0, limit)
    .map(toRecentOrder);
}

/** Best sellers by units, then line-item revenue. Unlinked items group by title. */
export function topProducts(
  receipts: readonly DashboardReceiptRow[],
  listingsById: ReadonlyMap<string, DashboardListingRow>,
  limit: number = DASHBOARD_LIST_SIZE
): TopProduct[] {
  const byKey = new Map<
    string,
    { listingId: string | null; title: string; units: number; revenue: number }
  >();
  for (const receipt of receipts) {
    for (const transaction of receipt.transactions) {
      const listingId: string | null =
        transaction.etsyListingId?.toString() ?? null;
      const title: string =
        (listingId === null ? undefined : listingsById.get(listingId)?.title) ??
        transaction.title ??
        'Untitled item';
      const key: string =
        listingId === null ? `title:${title}` : `id:${listingId}`;
      const entry = byKey.get(key) ?? {
        listingId,
        title,
        units: 0,
        revenue: 0,
      };
      entry.units += transaction.quantity;
      entry.revenue += (transaction.pricePerUnit ?? 0) * transaction.quantity;
      byKey.set(key, entry);
    }
  }
  return [...byKey.values()]
    .sort(
      (left, right) =>
        right.units - left.units ||
        right.revenue - left.revenue ||
        left.title.localeCompare(right.title)
    )
    .slice(0, limit)
    .map((entry) => ({
      etsyListingId: entry.listingId,
      title: entry.title,
      thumbnailUrl:
        entry.listingId === null
          ? null
          : (listingsById.get(entry.listingId)?.thumbnailUrl ?? null),
      unitsSold: entry.units,
      revenue: entry.revenue,
    }));
}

export function latestReviews(
  reviews: readonly DashboardReviewRow[],
  listingsById: ReadonlyMap<string, DashboardListingRow>,
  limit: number = DASHBOARD_LIST_SIZE
): LatestReview[] {
  return [...reviews]
    .sort(
      (left, right) =>
        right.etsyCreatedAt.getTime() - left.etsyCreatedAt.getTime()
    )
    .slice(0, limit)
    .map((review) => {
      const listingId: string | null = review.etsyListingId?.toString() ?? null;
      return {
        etsyListingId: listingId,
        listingTitle:
          listingId === null
            ? null
            : (listingsById.get(listingId)?.title ?? null),
        rating: review.rating,
        body:
          review.body === null || review.body.trim() === ''
            ? null
            : review.body,
        createdAt: review.etsyCreatedAt.toISOString(),
      };
    });
}

export function ratingBreakdown(
  reviews: readonly DashboardReviewRow[]
): RatingBreakdown {
  const counts: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let sum: number = 0;
  let total: number = 0;
  for (const review of reviews) {
    if (
      !Number.isInteger(review.rating) ||
      review.rating < 1 ||
      review.rating > 5
    ) {
      continue;
    }
    const index = (review.rating - 1) as 0 | 1 | 2 | 3 | 4;
    counts[index] += 1;
    sum += review.rating;
    total += 1;
  }
  return {
    counts,
    total,
    average: total === 0 ? null : Math.round((sum / total) * 10) / 10,
  };
}

/** Unreviewed orders whose (estimated) review window closes soonest. */
export function closingSoon(
  orders: readonly UnreviewedOrderSummary[],
  limit: number = DASHBOARD_LIST_SIZE
): ClosingSoonOrder[] {
  return [...orders]
    .sort(
      (left, right) =>
        left.daysLeftToReview - right.daysLeftToReview ||
        left.purchasedAt.getTime() - right.purchasedAt.getTime()
    )
    .slice(0, limit)
    .map((order) => ({
      etsyReceiptId: order.etsyReceiptId.toString(),
      buyerName: order.buyerName,
      itemTitles: order.itemTitles,
      daysLeftToReview: order.daysLeftToReview,
      thanked: order.lastThankedAt !== null,
    }));
}

/** Views one listing gained over a span of snapshots. */
export interface ViewGain {
  readonly gained: number;
  readonly from: Date;
  readonly to: Date;
}

/**
 * Views each listing gained between its earliest snapshot on/after `since`
 * (or ever, when null) and its latest. Listings with one snapshot are left
 * out: Etsy's views are lifetime totals, so a gain needs two.
 */
export function viewGainsSince(
  snapshots: readonly DashboardSnapshotRow[],
  since: Date | null
): Map<string, ViewGain> {
  const spans = new Map<
    string,
    { first: DashboardSnapshotRow; last: DashboardSnapshotRow }
  >();
  for (const snapshot of snapshots) {
    if (since !== null && snapshot.capturedOn.getTime() < since.getTime()) {
      continue;
    }
    const id: string = snapshot.etsyListingId.toString();
    const span = spans.get(id);
    if (span === undefined) {
      spans.set(id, { first: snapshot, last: snapshot });
      continue;
    }
    if (snapshot.capturedOn.getTime() < span.first.capturedOn.getTime()) {
      span.first = snapshot;
    }
    if (snapshot.capturedOn.getTime() > span.last.capturedOn.getTime()) {
      span.last = snapshot;
    }
  }
  const gains = new Map<string, ViewGain>();
  for (const [id, span] of spans) {
    if (span.first.capturedOn.getTime() === span.last.capturedOn.getTime()) {
      continue;
    }
    gains.set(id, {
      // Lifetime totals shouldn't drop, but never report a negative gain.
      gained: Math.max(0, span.last.viewsTotal - span.first.viewsTotal),
      from: span.first.capturedOn,
      to: span.last.capturedOn,
    });
  }
  return gains;
}

function spanOf(
  gains: ReadonlyMap<string, { from: Date; to: Date }>
): { from: Date; to: Date } | null {
  let from: Date | null = null;
  let to: Date | null = null;
  for (const gain of gains.values()) {
    if (from === null || gain.from.getTime() < from.getTime()) from = gain.from;
    if (to === null || gain.to.getTime() > to.getTime()) to = gain.to;
  }
  return from === null || to === null ? null : { from, to };
}

export function viewsGained(
  snapshots: readonly DashboardSnapshotRow[],
  since: Date | null
): ViewsGained | null {
  const gains = viewGainsSince(snapshots, since);
  const span = spanOf(gains);
  if (span === null) return null;
  let views: number = 0;
  for (const gain of gains.values()) views += gain.gained;
  return {
    views,
    listings: gains.size,
    fromDate: span.from.toISOString(),
    toDate: span.to.toISOString(),
  };
}

/** Units sold and last sale for one listing. */
export interface ListingSales {
  readonly units: number;
  readonly lastSoldAt: Date;
}

/** Units sold per listing id among `receipts`, plus each listing's last sale. */
export function salesByListing(
  receipts: readonly DashboardReceiptRow[]
): Map<string, ListingSales> {
  const byListing = new Map<string, { units: number; lastSoldAt: Date }>();
  for (const receipt of receipts) {
    for (const transaction of receipt.transactions) {
      if (transaction.etsyListingId === null) continue;
      const id: string = transaction.etsyListingId.toString();
      const entry = byListing.get(id);
      if (entry === undefined) {
        byListing.set(id, {
          units: transaction.quantity,
          lastSoldAt: receipt.etsyCreatedAt,
        });
        continue;
      }
      entry.units += transaction.quantity;
      if (receipt.etsyCreatedAt.getTime() > entry.lastSoldAt.getTime()) {
        entry.lastSoldAt = receipt.etsyCreatedAt;
      }
    }
  }
  return byListing;
}

function toAlert(
  listing: DashboardListingRow,
  value: number,
  date: Date | null
): ListingAlert {
  return {
    etsyListingId: listing.etsyListingId.toString(),
    title: listing.title,
    thumbnailUrl: listing.thumbnailUrl,
    value,
    date: date?.toISOString() ?? null,
  };
}

function cut(items: readonly ListingAlert[], limit: number): ListingAlertList {
  return { items: items.slice(0, limit), total: items.length };
}

/**
 * Active listings that gained at least `viewedMinViews` (25) views over the
 * last `viewedWindowDays` (30) days but sold nothing since.
 */
export function viewedNotSelling(
  listings: readonly DashboardListingRow[],
  snapshots: readonly DashboardSnapshotRow[],
  receipts: readonly DashboardReceiptRow[],
  now: Date,
  limit: number = DASHBOARD_LIST_SIZE,
  thresholds: Partial<DashboardThresholds> = {}
): ViewedNotSelling {
  const { viewedWindowDays, viewedMinViews } =
    resolveDashboardThresholds(thresholds);
  const since = new Date(now.getTime() - viewedWindowDays * MS_PER_DAY);
  const gains = viewGainsSince(snapshots, since);
  const span = spanOf(gains);
  const items: ListingAlert[] = [];
  for (const listing of listings) {
    if (listing.state !== 'active') continue;
    const gain = gains.get(listing.etsyListingId.toString());
    if (gain === undefined || gain.gained < viewedMinViews) continue;
    const soldSince: boolean = receipts.some(
      (receipt) =>
        receipt.etsyCreatedAt.getTime() >= gain.from.getTime() &&
        receipt.transactions.some(
          (transaction) => transaction.etsyListingId === listing.etsyListingId
        )
    );
    if (!soldSince) items.push(toAlert(listing, gain.gained, null));
  }
  items.sort(
    (left, right) =>
      right.value - left.value || left.title.localeCompare(right.title)
  );
  return {
    ...cut(items, limit),
    fromDate: span?.from.toISOString() ?? null,
    toDate: span?.to.toISOString() ?? null,
  };
}

/**
 * Active listings at least `staleAfterDays` (90) old with no sale in that
 * time. `value` is days since the last sale (or since the listing was
 * created, when it never sold); `date` is the last sale.
 */
export function staleListings(
  listings: readonly DashboardListingRow[],
  sales: ReadonlyMap<string, { readonly lastSoldAt: Date }>,
  now: Date,
  limit: number = DASHBOARD_LIST_SIZE,
  thresholds: Partial<DashboardThresholds> = {}
): ListingAlertList {
  const { staleAfterDays } = resolveDashboardThresholds(thresholds);
  const cutoff: number = now.getTime() - staleAfterDays * MS_PER_DAY;
  const items: ListingAlert[] = [];
  for (const listing of listings) {
    if (listing.state !== 'active') continue;
    if (
      listing.etsyCreatedAt !== null &&
      listing.etsyCreatedAt.getTime() > cutoff
    ) {
      continue;
    }
    const lastSoldAt: Date | null =
      sales.get(listing.etsyListingId.toString())?.lastSoldAt ?? null;
    if (lastSoldAt !== null && lastSoldAt.getTime() > cutoff) continue;
    const since: Date | null = lastSoldAt ?? listing.etsyCreatedAt;
    const days: number =
      since === null
        ? 0
        : Math.floor((now.getTime() - since.getTime()) / MS_PER_DAY);
    items.push(toAlert(listing, days, lastSoldAt));
  }
  // Never sold first, then the longest since a sale.
  items.sort(
    (left, right) =>
      Number(left.date !== null) - Number(right.date !== null) ||
      right.value - left.value ||
      left.title.localeCompare(right.title)
  );
  return cut(items, limit);
}

/** Active physical listings with `lowStockThreshold` (2) or fewer left. */
export function lowStock(
  listings: readonly DashboardListingRow[],
  limit: number = DASHBOARD_LIST_SIZE,
  thresholds: Partial<DashboardThresholds> = {}
): ListingAlertList {
  const { lowStockThreshold } = resolveDashboardThresholds(thresholds);
  const items: ListingAlert[] = listings
    .filter(
      (listing) =>
        listing.state === 'active' &&
        listing.listingType !== 'download' &&
        listing.quantity !== null &&
        listing.quantity <= lowStockThreshold
    )
    .map((listing) => toAlert(listing, listing.quantity ?? 0, null))
    .sort(
      (left, right) =>
        left.value - right.value || left.title.localeCompare(right.title)
    );
  return cut(items, limit);
}

/** Active listings ending (renewing or expiring) within `expiringWithinDays` (14). */
export function expiringSoon(
  listings: readonly DashboardListingRow[],
  now: Date,
  limit: number = DASHBOARD_LIST_SIZE,
  thresholds: Partial<DashboardThresholds> = {}
): ListingAlertList {
  const { expiringWithinDays } = resolveDashboardThresholds(thresholds);
  const until: number = now.getTime() + expiringWithinDays * MS_PER_DAY;
  const items: ListingAlert[] = [];
  for (const listing of listings) {
    if (listing.state !== 'active' || listing.endingAt === null) continue;
    const endsAt: number = listing.endingAt.getTime();
    if (endsAt < now.getTime() || endsAt > until) continue;
    items.push(
      toAlert(
        listing,
        Math.ceil((endsAt - now.getTime()) / MS_PER_DAY),
        listing.endingAt
      )
    );
  }
  items.sort(
    (left, right) =>
      left.value - right.value || left.title.localeCompare(right.title)
  );
  return cut(items, limit);
}

/** Buyers with two or more orders. Orders without a buyer id can't be matched. */
export function repeatBuyers(
  receipts: readonly DashboardReceiptRow[],
  limit: number = DASHBOARD_LIST_SIZE
): RepeatBuyers {
  const byBuyer = new Map<
    bigint,
    { orders: number; last: DashboardReceiptRow; name: string | null }
  >();
  for (const receipt of receipts) {
    if (receipt.buyerUserId === null) continue;
    const entry = byBuyer.get(receipt.buyerUserId);
    if (entry === undefined) {
      byBuyer.set(receipt.buyerUserId, {
        orders: 1,
        last: receipt,
        name: receipt.buyerName,
      });
      continue;
    }
    entry.orders += 1;
    if (receipt.etsyCreatedAt.getTime() > entry.last.etsyCreatedAt.getTime()) {
      entry.last = receipt;
      entry.name = receipt.buyerName ?? entry.name;
    } else {
      entry.name = entry.name ?? receipt.buyerName;
    }
  }
  const repeat = [...byBuyer.values()].filter((entry) => entry.orders >= 2);
  return {
    buyers: byBuyer.size,
    repeatBuyers: repeat.length,
    repeatOrders: repeat.reduce((sum, entry) => sum + entry.orders, 0),
    top: repeat
      .sort(
        (left, right) =>
          right.orders - left.orders ||
          right.last.etsyCreatedAt.getTime() - left.last.etsyCreatedAt.getTime()
      )
      .slice(0, limit)
      .map((entry) => ({
        buyerName: entry.name,
        orders: entry.orders,
        lastOrderAt: entry.last.etsyCreatedAt.toISOString(),
      })),
  };
}

/** Digital vs physical line items: units, line revenue and orders containing each. */
export function fulfilmentMix(
  receipts: readonly DashboardReceiptRow[]
): Dashboard['mix'] {
  const digital = { units: 0, revenue: 0, orders: 0 };
  const physical = { units: 0, revenue: 0, orders: 0 };
  for (const receipt of receipts) {
    let hasDigital: boolean = false;
    let hasPhysical: boolean = false;
    for (const transaction of receipt.transactions) {
      const bucket = transaction.isDigital ? digital : physical;
      bucket.units += transaction.quantity;
      bucket.revenue += (transaction.pricePerUnit ?? 0) * transaction.quantity;
      if (transaction.isDigital) hasDigital = true;
      else hasPhysical = true;
    }
    if (hasDigital) digital.orders += 1;
    if (hasPhysical) physical.orders += 1;
  }
  return { digital, physical };
}

/**
 * Every widget, from rows already loaded. Sales are receipts that pass
 * `isCountedSale`; money totals only add orders in the dominant currency.
 */
export function buildDashboard(
  input: DashboardInput,
  options: DashboardOptions
): Dashboard {
  const { now, period, timeZone } = options;
  const thresholds: DashboardThresholds = resolveDashboardThresholds(
    options.thresholds
  );
  const limit: number = thresholds.listSize;
  const sales: DashboardReceiptRow[] = input.receipts.filter(isCountedSale);
  const currencyCode: string | null = dominantCurrency(sales);
  const sameCurrency: DashboardReceiptRow[] = sales.filter(
    (receipt) => receipt.currencyCode === currencyCode
  );
  const start: Date | null = periodStart(period, now);
  const inPeriod: DashboardReceiptRow[] = sameCurrency.filter((receipt) =>
    inRange(receipt.etsyCreatedAt, start, now)
  );
  // Out-of-currency orders still count as orders everywhere money isn't summed.
  const allInPeriod: DashboardReceiptRow[] = sales.filter((receipt) =>
    inRange(receipt.etsyCreatedAt, start, now)
  );
  const previousStart: Date | null =
    start === null
      ? null
      : new Date(start.getTime() - (now.getTime() - start.getTime()));
  const listingsById = new Map<string, DashboardListingRow>(
    input.listings.map((listing) => [listing.etsyListingId.toString(), listing])
  );

  return {
    generatedAt: now.toISOString(),
    period,
    periodStart: start?.toISOString() ?? null,
    currencyCode,
    otherCurrencyOrders: allInPeriod.length - inPeriod.length,
    totals: salesTotals(inPeriod),
    previousTotals:
      start === null || previousStart === null
        ? null
        : salesTotals(
            sameCurrency.filter((receipt) =>
              inRange(receipt.etsyCreatedAt, previousStart, start)
            )
          ),
    viewsGained: viewsGained(input.snapshots, start),
    monthly: monthlySales(
      sameCurrency,
      now,
      timeZone,
      thresholds.monthsInChart
    ),
    countries: salesByCountry(inPeriod),
    recentOrders: recentOrders(sales, limit),
    topProducts: topProducts(inPeriod, listingsById, limit),
    latestReviews: latestReviews(input.reviews, listingsById, limit),
    ratings: ratingBreakdown(input.reviews),
    closingSoon: closingSoon(input.unreviewedOrders, limit),
    unreviewedTotal: input.unreviewedOrders.length,
    viewedNotSelling: viewedNotSelling(
      input.listings,
      input.snapshots,
      sales,
      now,
      limit,
      thresholds
    ),
    staleListings: staleListings(
      input.listings,
      salesByListing(sales),
      now,
      limit,
      thresholds
    ),
    lowStock: lowStock(input.listings, limit, thresholds),
    expiringSoon: expiringSoon(input.listings, now, limit, thresholds),
    repeatBuyers: repeatBuyers(allInPeriod, limit),
    mix: fulfilmentMix(inPeriod),
  };
}

/**
 * The timezone this runtime is in, for month buckets; "UTC" when the
 * runtime doesn't report one.
 */
export function localTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
