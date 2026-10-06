import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  buildDashboard,
  DASHBOARD_LIST_SIZE,
  DEFAULT_DASHBOARD_THRESHOLDS,
  EXPIRING_WITHIN_DAYS,
  LOW_STOCK_THRESHOLD,
  MONTHS_IN_CHART,
  resolveDashboardThresholds,
  snapshotsNeededSince,
  STALE_AFTER_DAYS,
  VIEWED_MIN_VIEWS,
  VIEWED_WINDOW_DAYS,
  closingSoon,
  type DashboardListingRow,
  type DashboardReceiptRow,
  type DashboardSnapshotRow,
  dominantCurrency,
  expiringSoon,
  fulfilmentMix,
  isDashboardPeriod,
  lastMonthKeys,
  lowStock,
  monthKey,
  monthlySales,
  ratingBreakdown,
  repeatBuyers,
  salesByCountry,
  salesByListing,
  staleListings,
  topProducts,
  viewedNotSelling,
  viewsGained,
} from '../src/insights/dashboard.js';
import type { UnreviewedOrder } from '../src/insights/unreviewed-orders.js';

const NOW = new Date('2026-10-05T12:00:00Z');
const DAY = 86_400_000;
const daysAgo = (days: number): Date => new Date(NOW.getTime() - days * DAY);

let nextReceiptId: number = 1;
function receipt(
  overrides: Partial<DashboardReceiptRow> = {}
): DashboardReceiptRow {
  nextReceiptId += 1;
  return {
    etsyReceiptId: BigInt(nextReceiptId),
    buyerUserId: null,
    buyerName: null,
    status: 'paid',
    grandTotalAmount: 2000,
    currencyCode: 'USD',
    etsyCreatedAt: daysAgo(1),
    countryIso: 'US',
    transactions: [
      {
        etsyListingId: 100n,
        title: 'Jig',
        quantity: 1,
        isDigital: false,
        pricePerUnit: 1500,
      },
    ],
    ...overrides,
  };
}

function listing(
  overrides: Partial<DashboardListingRow> = {}
): DashboardListingRow {
  return {
    etsyListingId: 100n,
    title: 'Jig',
    state: 'active',
    listingType: 'physical',
    quantity: 10,
    thumbnailUrl: null,
    etsyCreatedAt: daysAgo(400),
    etsyUpdatedAt: daysAgo(10),
    endingAt: null,
    ...overrides,
  };
}

function snapshot(
  id: bigint,
  days: number,
  viewsTotal: number
): DashboardSnapshotRow {
  return { etsyListingId: id, capturedOn: daysAgo(days), viewsTotal };
}

void describe('periods and months', () => {
  void it('recognises only the four periods', () => {
    assert.equal(isDashboardPeriod('90d'), true);
    assert.equal(isDashboardPeriod('7d'), false);
  });

  void it('buckets months in the given timezone', () => {
    // 03:00 UTC on Oct 1 is still September in New York.
    const date = new Date('2026-10-01T03:00:00Z');
    assert.equal(monthKey(date, 'UTC'), '2026-10');
    assert.equal(monthKey(date, 'America/New_York'), '2026-09');
  });

  void it('lists the last N months across a year boundary, oldest first', () => {
    assert.deepEqual(
      lastMonthKeys(new Date('2026-02-10T00:00:00Z'), 'UTC', 4),
      ['2025-11', '2025-12', '2026-01', '2026-02']
    );
  });

  void it('adds orders into their month and drops ones outside the chart', () => {
    const rows = [
      receipt({
        etsyCreatedAt: new Date('2026-10-02T00:00:00Z'),
        grandTotalAmount: 1000,
      }),
      receipt({
        etsyCreatedAt: new Date('2026-10-03T00:00:00Z'),
        grandTotalAmount: 500,
      }),
      receipt({
        etsyCreatedAt: new Date('2026-09-15T00:00:00Z'),
        grandTotalAmount: 700,
      }),
      receipt({ etsyCreatedAt: new Date('2024-01-01T00:00:00Z') }),
    ];
    const months = monthlySales(rows, NOW, 'UTC', 3);
    assert.deepEqual(months, [
      { month: '2026-08', orders: 0, revenue: 0 },
      { month: '2026-09', orders: 1, revenue: 700 },
      { month: '2026-10', orders: 2, revenue: 1500 },
    ]);
  });
});

void describe('sales breakdowns', () => {
  void it('picks the most common currency', () => {
    assert.equal(
      dominantCurrency([
        receipt({ currencyCode: 'USD' }),
        receipt({ currencyCode: 'CAD' }),
        receipt({ currencyCode: 'USD' }),
      ]),
      'USD'
    );
    assert.equal(dominantCurrency([]), null);
  });

  void it('groups by country with unknown last', () => {
    const rows = [
      receipt({ countryIso: null }),
      receipt({ countryIso: null }),
      receipt({ countryIso: 'CA' }),
      receipt({ countryIso: 'US' }),
      receipt({ countryIso: 'US' }),
    ];
    assert.deepEqual(
      salesByCountry(rows).map((row) => [row.countryIso, row.orders]),
      [
        ['US', 2],
        ['CA', 1],
        [null, 2],
      ]
    );
  });

  void it('ranks products by units, using the listing title, grouping unlinked items by title', () => {
    const listings = new Map([
      ['100', listing({ title: 'Pencil jig', thumbnailUrl: 'x.jpg' })],
    ]);
    const rows = [
      receipt({
        transactions: [
          {
            etsyListingId: 100n,
            title: 'old title',
            quantity: 2,
            isDigital: false,
            pricePerUnit: 500,
          },
          {
            etsyListingId: null,
            title: 'Gift',
            quantity: 1,
            isDigital: false,
            pricePerUnit: 900,
          },
        ],
      }),
      receipt({
        transactions: [
          {
            etsyListingId: null,
            title: 'Gift',
            quantity: 3,
            isDigital: false,
            pricePerUnit: 900,
          },
        ],
      }),
    ];
    assert.deepEqual(topProducts(rows, listings), [
      {
        etsyListingId: null,
        title: 'Gift',
        thumbnailUrl: null,
        unitsSold: 4,
        revenue: 3600,
      },
      {
        etsyListingId: '100',
        title: 'Pencil jig',
        thumbnailUrl: 'x.jpg',
        unitsSold: 2,
        revenue: 1000,
      },
    ]);
  });

  void it('splits digital and physical line items', () => {
    const mix = fulfilmentMix([
      receipt({
        transactions: [
          {
            etsyListingId: 1n,
            title: 'A',
            quantity: 1,
            isDigital: true,
            pricePerUnit: 300,
          },
          {
            etsyListingId: 2n,
            title: 'B',
            quantity: 2,
            isDigital: false,
            pricePerUnit: 1000,
          },
        ],
      }),
      receipt({
        transactions: [
          {
            etsyListingId: 1n,
            title: 'A',
            quantity: 1,
            isDigital: true,
            pricePerUnit: 300,
          },
        ],
      }),
    ]);
    assert.deepEqual(mix, {
      digital: { units: 2, revenue: 600, orders: 2 },
      physical: { units: 2, revenue: 2000, orders: 1 },
    });
  });

  void it('counts repeat buyers, ignoring orders without a buyer id', () => {
    const result = repeatBuyers([
      receipt({ buyerUserId: 1n, buyerName: 'Ann', etsyCreatedAt: daysAgo(5) }),
      receipt({ buyerUserId: 1n, buyerName: null, etsyCreatedAt: daysAgo(1) }),
      receipt({ buyerUserId: 2n, buyerName: 'Bo' }),
      receipt({ buyerUserId: null }),
    ]);
    assert.equal(result.buyers, 2);
    assert.equal(result.repeatBuyers, 1);
    assert.equal(result.repeatOrders, 2);
    assert.deepEqual(result.top, [
      { buyerName: 'Ann', orders: 2, lastOrderAt: daysAgo(1).toISOString() },
    ]);
  });
});

void describe('reviews', () => {
  void it('breaks ratings down and ignores out-of-range values', () => {
    const at = daysAgo(1);
    const rows = [5, 5, 4, 1, 0].map((rating) => ({
      etsyListingId: null,
      rating,
      body: null,
      etsyCreatedAt: at,
    }));
    assert.deepEqual(ratingBreakdown(rows), {
      counts: [1, 0, 0, 1, 2],
      total: 4,
      average: 3.8,
    });
    assert.deepEqual(ratingBreakdown([]), {
      counts: [0, 0, 0, 0, 0],
      total: 0,
      average: null,
    });
  });

  void it('lists unreviewed orders closing soonest first', () => {
    const order = (
      id: number,
      days: number,
      thanked: boolean
    ): UnreviewedOrder => ({
      receiptId: `r${id}`,
      etsyReceiptId: BigInt(id),
      buyerName: null,
      purchasedAt: daysAgo(30),
      daysSincePurchase: 30,
      grandTotalAmount: 1000,
      currencyCode: 'USD',
      itemTitles: ['Jig'],
      isDigitalOnly: false,
      hasBuyerNote: false,
      reviewWindowOpensAt: daysAgo(20),
      reviewWindowClosesAt: daysAgo(-days),
      reviewWindowBasis: 'shipped',
      daysLeftToReview: days,
      lastThankedAt: thanked ? daysAgo(2) : null,
    });
    assert.deepEqual(
      closingSoon([
        order(1, 40, false),
        order(2, 3, true),
        order(3, 12, false),
      ]).map((row) => [row.etsyReceiptId, row.thanked]),
      [
        ['2', true],
        ['3', false],
        ['1', false],
      ]
    );
  });
});

void describe('view snapshots', () => {
  const snapshots = [
    snapshot(100n, 40, 50),
    snapshot(100n, 29, 100),
    snapshot(100n, 1, 180),
    snapshot(200n, 20, 10),
    snapshot(200n, 2, 15),
    snapshot(300n, 3, 999), // a single snapshot can't show a gain
  ];

  void it('sums per-listing gains since the period start', () => {
    assert.deepEqual(viewsGained(snapshots, daysAgo(30)), {
      views: 85,
      listings: 2,
      fromDate: daysAgo(29).toISOString(),
      toDate: daysAgo(1).toISOString(),
    });
    assert.equal(viewsGained(snapshots, null)?.views, 135);
    assert.equal(viewsGained([snapshot(1n, 1, 5)], null), null);
  });

  void it('flags active listings that gained views but sold nothing since', () => {
    const listings = [
      listing({ etsyListingId: 100n, title: 'Busy, no sales' }),
      listing({ etsyListingId: 200n, title: 'Too few views' }),
      listing({ etsyListingId: 400n, title: 'Busy and selling' }),
    ];
    const withSeller = [
      ...snapshots,
      snapshot(400n, 25, 0),
      snapshot(400n, 1, 300),
    ];
    const sold = [
      receipt({
        etsyCreatedAt: daysAgo(3),
        transactions: [
          {
            etsyListingId: 400n,
            title: 'x',
            quantity: 1,
            isDigital: false,
            pricePerUnit: 1,
          },
        ],
      }),
    ];
    const result = viewedNotSelling(listings, withSeller, sold, NOW);
    assert.deepEqual(
      result.items.map((item) => [item.title, item.value]),
      [['Busy, no sales', 80]]
    );
    assert.equal(result.fromDate, daysAgo(29).toISOString());
  });
});

void describe('listing alerts', () => {
  void it('finds old active listings without a recent sale, never-sold first', () => {
    const listings = [
      listing({ etsyListingId: 1n, title: 'Never sold' }),
      listing({ etsyListingId: 2n, title: 'Sold long ago' }),
      listing({ etsyListingId: 3n, title: 'Sold recently' }),
      listing({
        etsyListingId: 4n,
        title: 'New listing',
        etsyCreatedAt: daysAgo(10),
      }),
      listing({ etsyListingId: 5n, title: 'Inactive', state: 'inactive' }),
    ];
    const sales = salesByListing([
      receipt({
        etsyCreatedAt: daysAgo(200),
        transactions: [
          {
            etsyListingId: 2n,
            title: null,
            quantity: 1,
            isDigital: false,
            pricePerUnit: 1,
          },
        ],
      }),
      receipt({
        etsyCreatedAt: daysAgo(5),
        transactions: [
          {
            etsyListingId: 3n,
            title: null,
            quantity: 1,
            isDigital: false,
            pricePerUnit: 1,
          },
        ],
      }),
    ]);
    const result = staleListings(listings, sales, NOW);
    assert.deepEqual(
      result.items.map((item) => [item.title, item.value, item.date]),
      [
        ['Never sold', 400, null],
        ['Sold long ago', 200, daysAgo(200).toISOString()],
      ]
    );
  });

  void it('flags low stock on physical listings only', () => {
    const result = lowStock([
      listing({ etsyListingId: 1n, title: 'Two left', quantity: 2 }),
      listing({ etsyListingId: 2n, title: 'Plenty', quantity: 30 }),
      listing({
        etsyListingId: 3n,
        title: 'Download',
        quantity: 0,
        listingType: 'download',
      }),
      listing({
        etsyListingId: 4n,
        title: 'Sold out',
        quantity: 0,
        state: 'sold_out',
      }),
      listing({ etsyListingId: 5n, title: 'Last one', quantity: 1 }),
    ]);
    assert.deepEqual(
      result.items.map((item) => [item.title, item.value]),
      [
        ['Last one', 1],
        ['Two left', 2],
      ]
    );
  });

  void it('lists active listings ending within two weeks', () => {
    const result = expiringSoon(
      [
        listing({ etsyListingId: 1n, title: 'Soon', endingAt: daysAgo(-3) }),
        listing({ etsyListingId: 2n, title: 'Later', endingAt: daysAgo(-40) }),
        listing({ etsyListingId: 3n, title: 'Past', endingAt: daysAgo(1) }),
      ],
      NOW
    );
    assert.deepEqual(
      result.items.map((item) => [item.title, item.value]),
      [['Soon', 3]]
    );
    assert.equal(result.total, 1);
  });
});

void describe('buildDashboard', () => {
  void it('compares the period with the one before and leaves refunds and other currencies out of totals', () => {
    const dashboard = buildDashboard(
      {
        receipts: [
          receipt({ etsyCreatedAt: daysAgo(5), grandTotalAmount: 3000 }),
          receipt({ etsyCreatedAt: daysAgo(10), grandTotalAmount: 1000 }),
          receipt({ etsyCreatedAt: daysAgo(12), status: 'fully refunded' }),
          receipt({ etsyCreatedAt: daysAgo(15), currencyCode: 'CAD' }),
          receipt({ etsyCreatedAt: daysAgo(45), grandTotalAmount: 500 }),
        ],
        reviews: [],
        listings: [listing()],
        snapshots: [],
        unreviewedOrders: [],
      },
      { now: NOW, period: '30d', timeZone: 'UTC' }
    );
    assert.equal(dashboard.currencyCode, 'USD');
    assert.equal(dashboard.otherCurrencyOrders, 1);
    assert.deepEqual(dashboard.totals, {
      orders: 2,
      revenue: 4000,
      units: 2,
      averageOrderValue: 2000,
    });
    assert.deepEqual(dashboard.previousTotals, {
      orders: 1,
      revenue: 500,
      units: 1,
      averageOrderValue: 500,
    });
    assert.equal(dashboard.viewsGained, null);
    assert.equal(dashboard.recentOrders.length, 4);
    assert.equal(dashboard.monthly.length, 12);
  });

  void it('has no previous period for all time', () => {
    const dashboard = buildDashboard(
      {
        receipts: [],
        reviews: [],
        listings: [],
        snapshots: [],
        unreviewedOrders: [],
      },
      { now: NOW, period: 'all', timeZone: 'UTC' }
    );
    assert.equal(dashboard.previousTotals, null);
    assert.equal(dashboard.periodStart, null);
    assert.equal(dashboard.currencyCode, null);
    assert.equal(dashboard.totals.averageOrderValue, null);
  });
});

void describe('thresholds', () => {
  void it('defaults match the exported constants', () => {
    assert.deepEqual(DEFAULT_DASHBOARD_THRESHOLDS, {
      listSize: DASHBOARD_LIST_SIZE,
      monthsInChart: MONTHS_IN_CHART,
      staleAfterDays: STALE_AFTER_DAYS,
      lowStockThreshold: LOW_STOCK_THRESHOLD,
      expiringWithinDays: EXPIRING_WITHIN_DAYS,
      viewedWindowDays: VIEWED_WINDOW_DAYS,
      viewedMinViews: VIEWED_MIN_VIEWS,
    });
    assert.deepEqual(
      [5, 12, 90, 2, 14, 30, 25],
      Object.values(DEFAULT_DASHBOARD_THRESHOLDS)
    );
    assert.deepEqual(
      resolveDashboardThresholds(),
      DEFAULT_DASHBOARD_THRESHOLDS
    );
    assert.equal(
      resolveDashboardThresholds({ lowStockThreshold: 5 }).lowStockThreshold,
      5
    );
    assert.equal(
      resolveDashboardThresholds({ lowStockThreshold: 5 }).listSize,
      5
    );
  });

  void it('lets each listing alert take its own threshold', () => {
    const listings = [
      listing({ etsyListingId: 1n, title: 'Five left', quantity: 5 }),
      listing({
        etsyListingId: 2n,
        title: 'Ends in 20 days',
        endingAt: daysAgo(-20),
      }),
    ];
    assert.equal(lowStock(listings).total, 0);
    assert.deepEqual(
      lowStock(listings, 5, { lowStockThreshold: 5 }).items.map(
        (item) => item.title
      ),
      ['Five left']
    );
    assert.equal(expiringSoon(listings, NOW).total, 0);
    assert.equal(
      expiringSoon(listings, NOW, 5, { expiringWithinDays: 30 }).total,
      1
    );
    const sales = salesByListing([]);
    assert.equal(
      staleListings([listing({ etsyCreatedAt: daysAgo(60) })], sales, NOW)
        .total,
      0
    );
    assert.equal(
      staleListings([listing({ etsyCreatedAt: daysAgo(60) })], sales, NOW, 5, {
        staleAfterDays: 30,
      }).total,
      1
    );
    const snapshots = [snapshot(100n, 20, 0), snapshot(100n, 1, 10)];
    assert.equal(viewedNotSelling([listing()], snapshots, [], NOW).total, 0);
    assert.equal(
      viewedNotSelling([listing()], snapshots, [], NOW, 5, {
        viewedMinViews: 10,
      }).total,
      1
    );
  });

  void it('passes overrides through buildDashboard', () => {
    const input = {
      receipts: [1, 2, 3, 4, 5, 6, 7].map(() => receipt()),
      reviews: [],
      listings: [listing({ quantity: 4 })],
      snapshots: [],
      unreviewedOrders: [],
    };
    const defaults = buildDashboard(input, {
      now: NOW,
      period: '30d',
      timeZone: 'UTC',
    });
    assert.equal(defaults.recentOrders.length, 5);
    assert.equal(defaults.monthly.length, 12);
    assert.equal(defaults.lowStock.total, 0);
    const tuned = buildDashboard(input, {
      now: NOW,
      period: '30d',
      timeZone: 'UTC',
      thresholds: { listSize: 3, monthsInChart: 6, lowStockThreshold: 4 },
    });
    assert.equal(tuned.recentOrders.length, 3);
    assert.equal(tuned.monthly.length, 6);
    assert.equal(tuned.lowStock.total, 1);
  });

  void it('says how far back the snapshots buildDashboard reads go', () => {
    assert.equal(snapshotsNeededSince('all', NOW), null);
    assert.equal(
      snapshotsNeededSince('90d', NOW)?.getTime(),
      daysAgo(90).getTime()
    );
    // The 30-day "viewed but not selling" window wins over a shorter period.
    assert.equal(
      snapshotsNeededSince('30d', NOW, { viewedWindowDays: 45 })?.getTime(),
      daysAgo(45).getTime()
    );
  });
});
