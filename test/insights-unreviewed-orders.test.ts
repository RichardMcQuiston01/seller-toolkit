import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { closingSoon } from '../src/insights/dashboard.js';
import {
  unreviewedOrdersFrom,
  type UnreviewedReceiptRow,
  type UnreviewedTransactionRow,
} from '../src/insights/unreviewed-orders.js';

/**
 * Fixtures for the rows `unreviewedOrdersFrom` reads. Receipts are assumed
 * already limited to paid, non-canceled orders: that's the caller's query.
 */
type FakeTransaction = Omit<
  UnreviewedTransactionRow,
  'shippedAt' | 'expectedShipAt'
> & {
  readonly shippedAt?: Date | null;
  readonly expectedShipAt?: Date | null;
};

type FakeReceipt = Omit<
  UnreviewedReceiptRow,
  'shippedAt' | 'transactions' | 'thankYouCopiedAt'
> & {
  readonly shippedAt?: Date | null;
  readonly transactions: readonly FakeTransaction[];
  readonly thankYouCopiedAt?: readonly (Date | null)[];
};

function rows(receipts: readonly FakeReceipt[]): UnreviewedReceiptRow[] {
  return receipts.map((receipt) => ({
    shippedAt: null,
    thankYouCopiedAt: [],
    ...receipt,
    transactions: receipt.transactions.map((transaction) => ({
      shippedAt: null,
      expectedShipAt: null,
      ...transaction,
    })),
  }));
}

function find(
  receipts: readonly FakeReceipt[],
  reviewedTransactionIds: readonly bigint[] = []
) {
  return unreviewedOrdersFrom(rows(receipts), reviewedTransactionIds, NOW);
}

function daysAgo(now: Date, days: number): Date {
  return new Date(now.getTime() - days * 86_400_000);
}

const NOW = new Date('2026-08-24T00:00:00Z');

function makeReceipt(overrides: Partial<FakeReceipt> = {}): FakeReceipt {
  return {
    id: 'receipt-1',
    etsyReceiptId: 1n,
    buyerName: 'Jane Doe',
    messageFromBuyer: null,
    grandTotalAmount: 2500,
    currencyCode: 'USD',
    etsyCreatedAt: daysAgo(NOW, 10),
    transactions: [
      {
        etsyTransactionId: 100n,
        title: 'xTool F1/F2 Filament Box (Digital Download)',
        isDigital: true,
      },
    ],
    ...overrides,
  };
}

void describe('unreviewedOrdersFrom', () => {
  void it('includes a paid, unreviewed order inside the eligible window', () => {
    const orders = find([makeReceipt()]);
    assert.equal(orders.length, 1);
    assert.equal(orders[0]?.etsyReceiptId, 1n);
    assert.equal(orders[0]?.receiptId, 'receipt-1');
    assert.equal(orders[0]?.daysSincePurchase, 10);
  });

  void it('excludes a receipt whose transaction already has a review', () => {
    assert.equal(find([makeReceipt()], [100n]).length, 0);
  });

  void it('accepts the reviewed ids as a Set too', () => {
    const orders = unreviewedOrdersFrom(
      rows([makeReceipt()]),
      new Set([100n]),
      NOW
    );
    assert.equal(orders.length, 0);
  });

  void it('excludes a digital order more than 100 days after purchase', () => {
    assert.equal(
      find([makeReceipt({ etsyCreatedAt: daysAgo(NOW, 101) })]).length,
      0
    );
  });

  void it('includes a digital order on the day of purchase and reports 100 days left', () => {
    const orders = find([makeReceipt({ etsyCreatedAt: NOW })]);
    assert.equal(orders[0]?.daysLeftToReview, 100);
    assert.equal(orders[0]?.reviewWindowBasis, 'digital-purchase');
  });

  void it('excludes a physical order until its estimated delivery (ship date + transit)', () => {
    const physical = (shippedDaysAgo: number) =>
      makeReceipt({
        etsyCreatedAt: daysAgo(NOW, shippedDaysAgo + 2),
        transactions: [
          {
            etsyTransactionId: 200n,
            title: 'Laser Jig',
            isDigital: false,
            shippedAt: daysAgo(NOW, shippedDaysAgo),
          },
        ],
      });
    assert.equal(find([physical(3)]).length, 0);

    const open = find([physical(10)]);
    assert.equal(open.length, 1);
    assert.equal(open[0]?.reviewWindowBasis, 'shipped');
    // Shipped 10 days ago + 7 transit → opened 3 days ago → 97 days left.
    assert.equal(open[0]?.daysLeftToReview, 97);
  });

  void it('keeps a physical order bought 110 days ago that shipped late (window still open)', () => {
    const orders = find([
      makeReceipt({
        etsyCreatedAt: daysAgo(NOW, 110),
        transactions: [
          {
            etsyTransactionId: 201n,
            title: 'Laser Jig',
            isDigital: false,
            shippedAt: daysAgo(NOW, 90),
          },
        ],
      }),
    ]);
    assert.equal(orders.length, 1);
  });

  void it('excludes an unshipped physical order with no expected ship date', () => {
    const orders = find([
      makeReceipt({
        transactions: [
          { etsyTransactionId: 202n, title: 'Laser Jig', isDigital: false },
        ],
      }),
    ]);
    assert.equal(orders.length, 0);
  });

  void it('falls back to the expected ship date, then to the receipt shipment date', () => {
    const expected = makeReceipt({
      id: 'r-expected',
      etsyReceiptId: 5n,
      transactions: [
        {
          etsyTransactionId: 203n,
          title: 'Jig',
          isDigital: false,
          expectedShipAt: daysAgo(NOW, 20),
        },
      ],
    });
    const receiptLevel = makeReceipt({
      id: 'r-receipt',
      etsyReceiptId: 6n,
      shippedAt: daysAgo(NOW, 20),
      transactions: [
        { etsyTransactionId: 204n, title: 'Jig', isDigital: false },
      ],
    });
    const basisById = new Map(
      find([expected, receiptLevel]).map((order) => [
        order.receiptId,
        order.reviewWindowBasis,
      ])
    );
    assert.equal(basisById.get('r-expected'), 'expected-ship');
    assert.equal(basisById.get('r-receipt'), 'shipped');
  });

  void it('reports when a thank-you was last copied', () => {
    const copiedAt = daysAgo(NOW, 2);
    const orders = find([makeReceipt({ thankYouCopiedAt: [null, copiedAt] })]);
    assert.equal(orders[0]?.lastThankedAt?.getTime(), copiedAt.getTime());
    assert.equal(find([makeReceipt()])[0]?.lastThankedAt, null);
  });

  void it('marks isDigitalOnly false when any transaction is physical', () => {
    const orders = find([
      makeReceipt({
        transactions: [
          {
            etsyTransactionId: 101n,
            title: 'Laser Jig',
            isDigital: false,
            shippedAt: daysAgo(NOW, 9),
          },
          { etsyTransactionId: 102n, title: 'Bonus STL', isDigital: true },
        ],
      }),
    ]);
    assert.equal(orders[0]?.isDigitalOnly, false);
  });

  void it('marks isDigitalOnly false when there are no transactions', () => {
    // No line items means no digital flag, so it needs a ship date like a physical order.
    const orders = find([
      makeReceipt({ transactions: [], shippedAt: daysAgo(NOW, 9) }),
    ]);
    assert.equal(orders[0]?.isDigitalOnly, false);
  });

  void it('sets hasBuyerNote from a trimmed messageFromBuyer', () => {
    const orders = find([
      makeReceipt({
        id: 'r-blank',
        etsyReceiptId: 4n,
        messageFromBuyer: '   ',
      }),
      makeReceipt({
        id: 'r-note',
        etsyReceiptId: 5n,
        messageFromBuyer: 'Please rush this!',
      }),
    ]);
    const byReceiptId = new Map(
      orders.map((order) => [order.etsyReceiptId, order])
    );
    assert.equal(byReceiptId.get(4n)?.hasBuyerNote, false);
    assert.equal(byReceiptId.get(5n)?.hasBuyerNote, true);
  });

  void it('sorts by grand total descending, then most recent first', () => {
    const orders = find([
      makeReceipt({
        id: 'r-cheap-old',
        etsyReceiptId: 6n,
        grandTotalAmount: 1000,
        etsyCreatedAt: daysAgo(NOW, 20),
      }),
      makeReceipt({
        id: 'r-expensive',
        etsyReceiptId: 7n,
        grandTotalAmount: 5000,
        etsyCreatedAt: daysAgo(NOW, 30),
      }),
      makeReceipt({
        id: 'r-cheap-new',
        etsyReceiptId: 8n,
        grandTotalAmount: 1000,
        etsyCreatedAt: daysAgo(NOW, 5),
      }),
    ]);
    assert.deepEqual(
      orders.map((order) => order.etsyReceiptId),
      [7n, 8n, 6n]
    );
  });

  void it('produces orders buildDashboard and closingSoon accept as-is', () => {
    const soon = closingSoon(find([makeReceipt()]));
    assert.deepEqual(soon, [
      {
        etsyReceiptId: '1',
        buyerName: 'Jane Doe',
        itemTitles: ['xTool F1/F2 Filament Box (Digital Download)'],
        daysLeftToReview: 90,
        thanked: false,
      },
    ]);
  });
});
