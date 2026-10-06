/**
 * Estimates when Etsy lets a buyer review an order.
 *
 * Etsy's rule: a buyer can review for 100 days, starting from the earlier of
 * the confirmed delivery date and the estimated delivery date; for digital
 * items the 100 days start when the buyer downloads the file. Reviews can't
 * be left before then.
 *
 * The Open API v3 exposes none of those dates — no estimated delivery, no
 * confirmed delivery, no download time. What it does expose is when each
 * line item shipped (or was promised to ship), so this estimates:
 *
 *   physical: delivery ≈ ship date + ASSUMED_TRANSIT_DAYS
 *   digital:  download ≈ purchase date
 *
 * Both lean conservative. A real delivery that beats the estimate only opens
 * Etsy's window earlier than ours (we start asking a little late, never too
 * early); a buyer who downloads days after purchase gets a later Etsy
 * deadline than ours (we stop asking a little early, never too late).
 */

const DAY_MS = 86_400_000;

/** Etsy's review window length. */
export const REVIEW_WINDOW_DAYS = 100;

/**
 * Transit allowance added to the ship date. A typical US domestic
 * estimate is 3–7 business days; the upper end keeps us from asking before
 * the parcel has plausibly arrived.
 */
export const ASSUMED_TRANSIT_DAYS = 7;

/** What the window start was estimated from, most to least precise. */
export type ReviewWindowBasis =
  'shipped' | 'expected-ship' | 'digital-purchase';

export interface ReviewWindow {
  readonly opensAt: Date;
  readonly closesAt: Date;
  readonly basis: ReviewWindowBasis;
}

export interface ReviewWindowInput {
  /** True only when every line item is a digital download. */
  readonly isDigitalOnly: boolean;
  readonly purchasedAt: Date;
  /** When the physical items shipped (latest line item), if known. */
  readonly shippedAt: Date | null;
  /** The promised ship-by date (latest line item), if known. */
  readonly expectedShipAt: Date | null;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/**
 * Null when there's nothing to estimate from: a physical order that hasn't
 * shipped and has no promised ship date can't be reviewed yet.
 */
export function estimateReviewWindow(
  input: ReviewWindowInput
): ReviewWindow | null {
  if (input.isDigitalOnly) {
    return {
      opensAt: input.purchasedAt,
      closesAt: addDays(input.purchasedAt, REVIEW_WINDOW_DAYS),
      basis: 'digital-purchase',
    };
  }

  const shipDate: Date | null = input.shippedAt ?? input.expectedShipAt;
  if (shipDate === null) {
    return null;
  }
  const estimatedDelivery: Date = addDays(shipDate, ASSUMED_TRANSIT_DAYS);
  return {
    opensAt: estimatedDelivery,
    closesAt: addDays(estimatedDelivery, REVIEW_WINDOW_DAYS),
    basis: input.shippedAt !== null ? 'shipped' : 'expected-ship',
  };
}

/** Whole days until the window closes; 0 on the closing day. */
export function daysLeftInWindow(window: ReviewWindow, now: Date): number {
  return Math.max(
    0,
    Math.floor((window.closesAt.getTime() - now.getTime()) / DAY_MS)
  );
}

/** Open means a buyer can leave a review right now: opensAt ≤ now < closesAt. */
export function isWindowOpen(window: ReviewWindow, now: Date): boolean {
  return (
    window.opensAt.getTime() <= now.getTime() &&
    now.getTime() < window.closesAt.getTime()
  );
}

/** Latest non-null date, or null — "the order shipped when its last item did". */
export function latestDate(dates: readonly (Date | null)[]): Date | null {
  let latest: Date | null = null;
  for (const date of dates) {
    if (
      date !== null &&
      (latest === null || date.getTime() > latest.getTime())
    ) {
      latest = date;
    }
  }
  return latest;
}
