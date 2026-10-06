import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  computeListingViewTrends,
  type ViewTrendListingRow,
} from '../src/insights/view-trends.js';

function day(offsetFromEpoch: number): Date {
  return new Date(Date.UTC(2026, 7, 1 + offsetFromEpoch));
}

function filamentBox(
  statSnapshots: ViewTrendListingRow['statSnapshots']
): ViewTrendListingRow {
  return { id: 'l1', etsyListingId: 10n, title: 'Filament Box', statSnapshots };
}

void describe('computeListingViewTrends', () => {
  void it('returns no points for a listing with fewer than two snapshots', () => {
    const points = computeListingViewTrends([
      filamentBox([{ capturedOn: day(0), viewsTotal: 5, favorersTotal: 1 }]),
    ]);
    assert.equal(points.length, 0);
  });

  void it('differences consecutive same-day-cadence snapshots into a daily delta', () => {
    const points = computeListingViewTrends([
      filamentBox([
        { capturedOn: day(0), viewsTotal: 100, favorersTotal: 4 },
        { capturedOn: day(1), viewsTotal: 130, favorersTotal: 5 },
      ]),
    ]);
    assert.equal(points.length, 1);
    const point = points[0];
    assert.equal(point?.daysSpan, 1);
    assert.equal(point?.viewsDelta, 30);
    assert.equal(point?.viewsPerDay, 30);
    assert.equal(point?.favorersDelta, 1);
    assert.equal(point?.listingId, 'l1');
    assert.equal(point?.etsyListingId, 10n);
  });

  void it('spreads the delta across the gap when a sync was missed', () => {
    const points = computeListingViewTrends([
      filamentBox([
        { capturedOn: day(0), viewsTotal: 100, favorersTotal: 4 },
        { capturedOn: day(4), viewsTotal: 140, favorersTotal: 4 },
      ]),
    ]);
    const point = points[0];
    assert.equal(point?.daysSpan, 4);
    assert.equal(point?.viewsDelta, 40);
    assert.equal(point?.viewsPerDay, 10);
  });

  void it('emits one point per consecutive pair, across multiple listings', () => {
    const points = computeListingViewTrends([
      filamentBox([
        { capturedOn: day(0), viewsTotal: 100, favorersTotal: 4 },
        { capturedOn: day(1), viewsTotal: 110, favorersTotal: 4 },
        { capturedOn: day(2), viewsTotal: 125, favorersTotal: 5 },
      ]),
      {
        id: 'l2',
        etsyListingId: 20n,
        title: 'Bin Divider',
        statSnapshots: [
          { capturedOn: day(0), viewsTotal: 50, favorersTotal: 2 },
          { capturedOn: day(1), viewsTotal: 55, favorersTotal: 2 },
        ],
      },
    ]);
    assert.equal(points.length, 3);
  });

  void it('sorts points most recent first', () => {
    const points = computeListingViewTrends([
      filamentBox([
        { capturedOn: day(0), viewsTotal: 100, favorersTotal: 4 },
        { capturedOn: day(1), viewsTotal: 110, favorersTotal: 4 },
        { capturedOn: day(2), viewsTotal: 125, favorersTotal: 5 },
      ]),
    ]);
    assert.ok(
      (points[0]?.toDate.getTime() ?? 0) > (points[1]?.toDate.getTime() ?? 0)
    );
  });

  void it('orders snapshots by date itself, so callers need not sort them', () => {
    const points = computeListingViewTrends([
      filamentBox([
        { capturedOn: day(2), viewsTotal: 125, favorersTotal: 5 },
        { capturedOn: day(0), viewsTotal: 100, favorersTotal: 4 },
        { capturedOn: day(1), viewsTotal: 110, favorersTotal: 4 },
      ]),
    ]);
    assert.deepEqual(
      points.map((point) => point.viewsDelta),
      [15, 10]
    );
  });
});
