import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ASSUMED_TRANSIT_DAYS,
  daysLeftInWindow,
  estimateReviewWindow,
  isWindowOpen,
  latestDate,
  REVIEW_WINDOW_DAYS,
} from '../src/review-window.js';

const DAY = 86_400_000;
const PURCHASED = new Date('2026-06-01T12:00:00Z');
const at = (days: number): Date => new Date(PURCHASED.getTime() + days * DAY);

void describe('estimateReviewWindow', () => {
  void it('digital: opens at purchase and closes 100 days later', () => {
    const window = estimateReviewWindow({
      isDigitalOnly: true,
      purchasedAt: PURCHASED,
      shippedAt: null,
      expectedShipAt: null,
    });
    assert.deepEqual(window, {
      opensAt: PURCHASED,
      closesAt: at(REVIEW_WINDOW_DAYS),
      basis: 'digital-purchase',
    });
  });

  void it('physical: opens at ship date + transit, prefers the actual ship date', () => {
    const window = estimateReviewWindow({
      isDigitalOnly: false,
      purchasedAt: PURCHASED,
      shippedAt: at(2),
      expectedShipAt: at(5),
    });
    assert.equal(window?.basis, 'shipped');
    assert.equal(
      window?.opensAt.getTime(),
      at(2 + ASSUMED_TRANSIT_DAYS).getTime()
    );
    assert.equal(
      window?.closesAt.getTime(),
      at(2 + ASSUMED_TRANSIT_DAYS + 100).getTime()
    );
  });

  void it('physical: falls back to the expected ship date', () => {
    const window = estimateReviewWindow({
      isDigitalOnly: false,
      purchasedAt: PURCHASED,
      shippedAt: null,
      expectedShipAt: at(5),
    });
    assert.equal(window?.basis, 'expected-ship');
    assert.equal(
      window?.opensAt.getTime(),
      at(5 + ASSUMED_TRANSIT_DAYS).getTime()
    );
  });

  void it('physical with no ship information: no window yet', () => {
    assert.equal(
      estimateReviewWindow({
        isDigitalOnly: false,
        purchasedAt: PURCHASED,
        shippedAt: null,
        expectedShipAt: null,
      }),
      null
    );
  });
});

void describe('isWindowOpen / daysLeftInWindow', () => {
  const window = {
    opensAt: at(10),
    closesAt: at(110),
    basis: 'shipped' as const,
  };

  void it('is closed before it opens, open at the opening instant, closed at the closing instant', () => {
    assert.equal(isWindowOpen(window, at(9.99)), false);
    assert.equal(isWindowOpen(window, at(10)), true);
    assert.equal(isWindowOpen(window, at(109.99)), true);
    assert.equal(isWindowOpen(window, at(110)), false);
  });

  void it('counts whole days left and never goes negative', () => {
    assert.equal(daysLeftInWindow(window, at(10)), 100);
    assert.equal(daysLeftInWindow(window, at(109.5)), 0);
    assert.equal(daysLeftInWindow(window, at(200)), 0);
  });
});

void describe('latestDate', () => {
  void it('ignores nulls and returns the latest', () => {
    assert.equal(
      latestDate([null, at(3), at(1), null])?.getTime(),
      at(3).getTime()
    );
    assert.equal(latestDate([null, null]), null);
    assert.equal(latestDate([]), null);
  });
});
