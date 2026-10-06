import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_SIGNATURE,
  detectMachines,
  keywordsFor,
  productTitles,
  renderTemplate,
  shortenTitle,
  type ThankYouContext,
} from '../src/thank-you.js';

const BASE: ThankYouContext = {
  buyerName: 'Jane',
  itemTitles: ['Acme Laser Rotary Jig – Tumbler Holder'],
  isDigitalOnly: false,
  machines: [],
  includeLinks: true,
  signature: '',
};

void describe('overridable shop defaults', () => {
  void it('falls back to DEFAULT_SIGNATURE, or to fallbackSignature when given', () => {
    assert.equal(renderTemplate('{{SIGNATURE}}', BASE), DEFAULT_SIGNATURE);
    assert.equal(
      renderTemplate('{{SIGNATURE}}', {
        ...BASE,
        fallbackSignature: 'The Shop',
      }),
      'The Shop'
    );
    assert.equal(
      renderTemplate('{{SIGNATURE}}', {
        ...BASE,
        signature: 'Sam',
        fallbackSignature: 'The Shop',
      }),
      'Sam'
    );
  });

  void it('strips custom title prefixes', () => {
    const prefixes = [/^Acme\s+/i];
    assert.equal(
      shortenTitle('Acme Laser Rotary Jig – Tumbler Holder', prefixes),
      'Laser Rotary Jig'
    );
    assert.equal(
      productTitles(['Acme A Jig', 'Acme A Jig'], prefixes),
      'A Jig'
    );
    assert.equal(
      renderTemplate('{{PRODUCT_TITLE}}', {
        ...BASE,
        titlePrefixPatterns: prefixes,
      }),
      'Laser Rotary Jig'
    );
    // Default patterns leave a non-xTool prefix alone.
    assert.equal(
      renderTemplate('{{PRODUCT_TITLE}}', BASE),
      'Acme Laser Rotary Jig'
    );
  });

  void it('derives machine keywords with a custom brand prefix, or none', () => {
    const machine = { id: 'r', name: 'Acme R1/R2', matchKeywords: '' };
    assert.deepEqual(keywordsFor(machine, /^Acme\s+/i), ['R1/R2', 'R1', 'R2']);
    assert.deepEqual(keywordsFor(machine, null), [
      'Acme R1/R2',
      'Acme R1',
      'R2',
    ]);
    assert.deepEqual(detectMachines(['R2 jig'], [machine], /^Acme\s+/i), ['r']);
    assert.deepEqual(detectMachines(['R2 jig'], [machine]), ['r']);
  });
});
