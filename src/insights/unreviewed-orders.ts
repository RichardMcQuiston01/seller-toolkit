import {
  daysLeftInWindow,
  estimateReviewWindow,
  isWindowOpen,
  latestDate,
  type ReviewWindow,
  type ReviewWindowBasis,
} from '../review-window.js';

/**
 * Which paid orders have no review yet and are inside Etsy's (estimated)
 * review window.
 *
 * This is the pure core of etsy-dashboard's `findUnreviewedOrders`: the
 * consumer loads paid, non-canceled receipts and the reviewed transaction
 * ids itself (Etsy's `getReviewsByShop` returns `transaction_id`, the only
 * join key back to a receipt) and passes them in as plain rows.
 *
 * Nothing here sends anything. The output is a list a person works through
 * by hand; see the package README.
 */

const MS_PER_DAY = 86_400_000;

/**
 * The fields of an unreviewed order that dashboard widgets need
 * (`closingSoon`, `buildDashboard`). Every `UnreviewedOrder` is one.
 */
export interface UnreviewedOrderSummary {
  readonly etsyReceiptId: bigint;
  readonly buyerName: string | null;
  readonly itemTitles: readonly string[];
  readonly purchasedAt: Date;
  readonly daysLeftToReview: number;
  /** When a thank-you for this order was last copied, or null if never. */
  readonly lastThankedAt: Date | null;
}

export interface UnreviewedOrder extends UnreviewedOrderSummary {
  /** The consumer's own receipt id (`UnreviewedReceiptRow.id`). */
  readonly receiptId: string;
  readonly daysSincePurchase: number;
  /** Minor units. */
  readonly grandTotalAmount: number;
  readonly currencyCode: string;
  readonly isDigitalOnly: boolean;
  readonly hasBuyerNote: boolean;
  /** Estimated Etsy review window; see `review-window`. */
  readonly reviewWindowOpensAt: Date;
  readonly reviewWindowClosesAt: Date;
  readonly reviewWindowBasis: ReviewWindowBasis;
}

export interface UnreviewedTransactionRow {
  readonly etsyTransactionId: bigint;
  readonly title: string | null;
  /** `is_digital` sits on the transaction, not the receipt. */
  readonly isDigital: boolean;
  readonly shippedAt: Date | null;
  readonly expectedShipAt: Date | null;
}

export interface UnreviewedReceiptRow {
  /** The consumer's own id for the receipt (e.g. a database key). */
  readonly id: string;
  readonly etsyReceiptId: bigint;
  /** Frequently null on live receipts; never assume it. */
  readonly buyerName: string | null;
  /** The note the buyer left at checkout. */
  readonly messageFromBuyer: string | null;
  /** Minor units. */
  readonly grandTotalAmount: number;
  readonly currencyCode: string;
  readonly etsyCreatedAt: Date;
  /** Receipt-level ship date (from shipment notifications), if any. */
  readonly shippedAt: Date | null;
  readonly transactions: readonly UnreviewedTransactionRow[];
  /** When each thank-you for this order was copied; null entries are ignored. */
  readonly thankYouCopiedAt: readonly (Date | null)[];
}

/**
 * Orders with no reviewed line item whose estimated review window is open
 * at `now`, highest value first, then most recent.
 *
 * `receipts` must already be limited to paid, non-canceled orders. A
 * receipt counts as reviewed when any of its transactions is in
 * `reviewedTransactionIds`. A physical order counts as shipped when its
 * last physical item did, falling back to the receipt's own ship date.
 */
export function unreviewedOrdersFrom(
  receipts: readonly UnreviewedReceiptRow[],
  reviewedTransactionIds: Iterable<bigint>,
  now: Date
): UnreviewedOrder[] {
  const reviewed: ReadonlySet<bigint> = new Set<bigint>(reviewedTransactionIds);
  const results: UnreviewedOrder[] = [];

  for (const receipt of receipts) {
    const anyReviewed: boolean = receipt.transactions.some((transaction) =>
      reviewed.has(transaction.etsyTransactionId)
    );
    if (anyReviewed) continue;

    const isDigitalOnly: boolean =
      receipt.transactions.length > 0 &&
      receipt.transactions.every((transaction) => transaction.isDigital);
    const physicalItems: UnreviewedTransactionRow[] =
      receipt.transactions.filter((transaction) => !transaction.isDigital);
    const window: ReviewWindow | null = estimateReviewWindow({
      isDigitalOnly,
      purchasedAt: receipt.etsyCreatedAt,
      shippedAt:
        latestDate(physicalItems.map((transaction) => transaction.shippedAt)) ??
        receipt.shippedAt,
      expectedShipAt: latestDate(
        physicalItems.map((transaction) => transaction.expectedShipAt)
      ),
    });
    if (window === null || !isWindowOpen(window, now)) continue;

    const ageMs: number = now.getTime() - receipt.etsyCreatedAt.getTime();
    const itemTitles: string[] = receipt.transactions
      .map((transaction) => transaction.title)
      .filter(
        (title: string | null): title is string =>
          title !== null && title.length > 0
      );

    results.push({
      receiptId: receipt.id,
      etsyReceiptId: receipt.etsyReceiptId,
      buyerName: receipt.buyerName,
      purchasedAt: receipt.etsyCreatedAt,
      daysSincePurchase: Math.floor(ageMs / MS_PER_DAY),
      grandTotalAmount: receipt.grandTotalAmount,
      currencyCode: receipt.currencyCode,
      itemTitles,
      isDigitalOnly,
      hasBuyerNote: (receipt.messageFromBuyer ?? '').trim().length > 0,
      reviewWindowOpensAt: window.opensAt,
      reviewWindowClosesAt: window.closesAt,
      reviewWindowBasis: window.basis,
      daysLeftToReview: daysLeftInWindow(window, now),
      lastThankedAt: latestDate(receipt.thankYouCopiedAt),
    });
  }

  // Highest-value first, then most recent: those are worth the effort.
  results.sort(
    (left, right) =>
      right.grandTotalAmount - left.grandTotalAmount ||
      right.purchasedAt.getTime() - left.purchasedAt.getTime()
  );
  return results;
}
