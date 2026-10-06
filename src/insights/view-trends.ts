/**
 * Per-day view and favorite trends from daily listing snapshots.
 *
 * Etsy's `views` and `num_favorers` are lifetime-cumulative counters
 * tabulated once per day, with no history and no daily figure. The only way
 * to see a trend is to snapshot them daily yourself and difference
 * consecutive snapshots, which is what this module does.
 */

const MS_PER_DAY = 86_400_000;

export interface ViewTrendSnapshotRow {
  readonly capturedOn: Date;
  /** Lifetime views at capture time. */
  readonly viewsTotal: number;
  /** Lifetime favorers at capture time. */
  readonly favorersTotal: number;
}

export interface ViewTrendListingRow {
  /** The consumer's own id for the listing (e.g. a database key). */
  readonly id: string;
  readonly etsyListingId: bigint;
  readonly title: string;
  /** Any order; they are sorted oldest first before differencing. */
  readonly statSnapshots: readonly ViewTrendSnapshotRow[];
}

export interface ListingViewTrendPoint {
  /** `ViewTrendListingRow.id`. */
  readonly listingId: string;
  readonly etsyListingId: bigint;
  readonly title: string;
  readonly fromDate: Date;
  readonly toDate: Date;
  /** Calendar days between the two snapshots (at least 1; more when a sync was missed). */
  readonly daysSpan: number;
  readonly viewsDelta: number;
  readonly viewsPerDay: number;
  readonly favorersDelta: number;
}

/**
 * Difference every consecutive pair of snapshots, per listing, into a
 * view/favorite delta. Most recent pairs first. A listing needs at least
 * two snapshots to produce a point.
 */
export function computeListingViewTrends(
  listings: readonly ViewTrendListingRow[]
): ListingViewTrendPoint[] {
  const points: ListingViewTrendPoint[] = [];

  for (const listing of listings) {
    const snapshots: ViewTrendSnapshotRow[] = [...listing.statSnapshots].sort(
      (left, right) => left.capturedOn.getTime() - right.capturedOn.getTime()
    );
    for (let index = 1; index < snapshots.length; index += 1) {
      const previous: ViewTrendSnapshotRow | undefined = snapshots[index - 1];
      const current: ViewTrendSnapshotRow | undefined = snapshots[index];
      if (previous === undefined || current === undefined) continue;

      const daysSpan: number = Math.max(
        1,
        Math.round(
          (current.capturedOn.getTime() - previous.capturedOn.getTime()) /
            MS_PER_DAY
        )
      );
      const viewsDelta: number = current.viewsTotal - previous.viewsTotal;

      points.push({
        listingId: listing.id,
        etsyListingId: listing.etsyListingId,
        title: listing.title,
        fromDate: previous.capturedOn,
        toDate: current.capturedOn,
        daysSpan,
        viewsDelta,
        viewsPerDay: viewsDelta / daysSpan,
        favorersDelta: current.favorersTotal - previous.favorersTotal,
      });
    }
  }

  points.sort((left, right) => right.toDate.getTime() - left.toDate.getTime());
  return points;
}
