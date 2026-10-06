import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DEFAULT_TEMPLATES,
  detectMachines,
  etsyPurchaseUrl,
  findPolicyProblem,
  firstNameOf,
  keywordsFor,
  machineNames,
  PLACEHOLDERS,
  productTitles,
  renderHelpfulLinks,
  renderProductTips,
  renderTemplate,
  renderThankYou,
  shortenTitle,
  THANK_YOU_TEMPLATE_IDS,
  unknownPlaceholders,
  type ThankYouContext,
} from '../src/thank-you.js';

const MACHINES = [
  { id: 'f1f2', name: 'xTool F1/F2', matchKeywords: '' },
  { id: 'ultra', name: 'xTool F2 Ultra', matchKeywords: '' },
  { id: 'p2s', name: 'xTool P2S', matchKeywords: '' },
];

const LINKS = [
  {
    machineName: 'xTool F2 Ultra',
    links: [
      {
        label: 'User manual',
        url: 'https://support.xtool.com/f2-ultra-manual',
      },
      {
        label: 'Material settings',
        url: 'https://support.xtool.com/f2-ultra-settings',
      },
    ],
  },
];

function context(overrides: Partial<ThankYouContext> = {}): ThankYouContext {
  return {
    buyerName: 'KAREN BOWERS',
    itemTitles: [
      'xTool F2 Ultra UV Laser Jig – 25 Pencil Batch Engraving Alignment Fixture',
    ],
    isDigitalOnly: false,
    machines: LINKS,
    includeLinks: true,
    signature: 'McQ',
    ...overrides,
  };
}

void describe('firstNameOf', () => {
  void it('takes the first name and softens ALL CAPS', () => {
    assert.equal(firstNameOf('KAREN BOWERS'), 'Karen');
    assert.equal(firstNameOf('Jane Doe'), 'Jane');
    assert.equal(firstNameOf('  '), null);
    assert.equal(firstNameOf(null), null);
  });
});

void describe('shortenTitle', () => {
  void it('drops the xTool prefix and the SEO tail after a dash or bar', () => {
    assert.equal(
      shortenTitle(
        'xTool F2 Ultra UV Laser Jig – 25 Pencil Batch Engraving Alignment Fixture'
      ),
      'F2 Ultra UV Laser Jig'
    );
    assert.equal(
      shortenTitle('xTool F1/F2 Storage Tray (Physical Product)'),
      'Storage Tray'
    );
  });
});

void describe('renderThankYou', () => {
  for (const templateId of THANK_YOU_TEMPLATE_IDS) {
    void it(`${templateId}: thanks them for the product by name, asks neutrally, offers nothing`, () => {
      const message = renderThankYou(templateId, context());
      assert.match(message, /^Hi Karen,/);
      assert.match(message, /for ordering the F2 Ultra UV Laser Jig/);
      assert.match(message, /product review on Etsy would mean a lot/i);
      assert.equal(findPolicyProblem(DEFAULT_TEMPLATES[templateId].body), null);
      assert.doesNotMatch(
        message,
        /discount|coupon|5[- ]star|five[- ]star|in exchange/i
      );
      assert.match(message, /McQ$/);
    });

    void it(`${templateId}: includes helpful links only when asked`, () => {
      assert.match(
        renderThankYou(templateId, context()),
        /support\.xtool\.com\/f2-ultra-manual/
      );
      assert.doesNotMatch(
        renderThankYou(templateId, context({ includeLinks: false })),
        /support\.xtool\.com/
      );
    });

    void it(`${templateId}: includes machine tips only when there are some`, () => {
      const withTips = context({
        machines: [{ ...LINKS[0]!, tips: 'Level the bed first.' }],
      });
      assert.match(
        renderThankYou(templateId, withTips),
        /Tips for the xTool F2 Ultra:\nLevel the bed first\./
      );
      assert.doesNotMatch(renderThankYou(templateId, withTips), /\n\n\n/);
      assert.doesNotMatch(renderThankYou(templateId, context()), /Tips for/);
      assert.doesNotMatch(
        renderThankYou(templateId, { ...withTips, includeTips: false }),
        /Level the bed/
      );
    });
  }

  void it('falls back gracefully with no name, no items and no machines', () => {
    const message = renderThankYou(
      'resources',
      context({ buyerName: null, itemTitles: [], machines: [] })
    );
    assert.match(message, /^Hi there,/);
    assert.match(message, /ordering the item/);
    assert.match(message, /other machine owners/);
    assert.doesNotMatch(message, /\{\{|\n\n\n/);
  });

  void it('check-in uses the digital wording for downloads', () => {
    assert.match(
      renderThankYou('check-in', context({ isDigitalOnly: true })),
      /printed cleanly/
    );
    assert.match(renderThankYou('check-in', context()), /seating right/);
  });

  void it('renders an edited template, falling back to the main body for digital orders', () => {
    const edited = {
      name: 'Mine',
      description: '',
      body: 'Yo {{FIRST_NAME}}! Enjoy your {{MACHINE}} {{PRODUCT_TITLE}}.\n\n— {{SIGNATURE}}',
      digitalBody: '   ',
    };
    assert.equal(
      renderThankYou(edited, context({ isDigitalOnly: true, signature: '  ' })),
      'Yo Karen! Enjoy your xTool F2 Ultra F2 Ultra UV Laser Jig.\n\n— McQ'
    );
  });
});

void describe('{{PURCHASE_LINK}}', () => {
  void it('builds the buyer’s order page URL from a numeric order id only', () => {
    assert.equal(
      etsyPurchaseUrl(' 4089668331 '),
      'https://www.etsy.com/your/purchases/4089668331?ref=yr_purchases'
    );
    assert.equal(etsyPurchaseUrl('40896x'), null);
    assert.equal(etsyPurchaseUrl(null), null);
    assert.equal(etsyPurchaseUrl(undefined), null);
  });

  for (const templateId of THANK_YOU_TEMPLATE_IDS) {
    void it(`${templateId}: links to the order page, or leaves that line out without an id`, () => {
      assert.match(
        renderThankYou(templateId, context({ etsyReceiptId: '4089668331' })),
        /from your order page: https:\/\/www\.etsy\.com\/your\/purchases\/4089668331\?ref=yr_purchases/
      );
      const withoutId = renderThankYou(templateId, context());
      assert.doesNotMatch(withoutId, /order page|PURCHASE_LINK/);
      assert.match(withoutId, /product review on Etsy would mean a lot/i);
    });
  }
});

void describe('renderTemplate', () => {
  void it('drops a paragraph whose placeholder has nothing to show', () => {
    const body = 'Hi {{FIRST_NAME}},\n\nHere you go:\n{{HELPFUL_LINKS}}\n\nBye';
    assert.equal(
      renderTemplate(body, context({ includeLinks: false })),
      'Hi Karen,\n\nBye'
    );
  });

  void it('tolerates spaces inside braces and Windows line endings', () => {
    assert.equal(
      renderTemplate('Hi {{ FIRST_NAME }},\r\n\r\nThanks', context()),
      'Hi Karen,\n\nThanks'
    );
  });

  void it('leaves an unknown placeholder visible rather than silently dropping it', () => {
    assert.equal(
      renderTemplate('Code: {{COUPON}}', context()),
      'Code: {{COUPON}}'
    );
  });
});

void describe('productTitles / machineNames', () => {
  void it('lists up to three products, then counts the rest, without duplicates', () => {
    assert.equal(productTitles(['xTool A Jig', 'xTool A Jig']), 'A Jig');
    assert.equal(productTitles(['A', 'B', 'C']), 'A, B and C');
    assert.equal(productTitles(['A', 'B', 'C', 'D']), 'A, B and 2 other items');
    assert.equal(productTitles([]), 'item');
  });

  void it('joins machine names, or says "machine"', () => {
    assert.equal(machineNames([]), 'machine');
    assert.equal(
      machineNames([
        { machineName: 'xTool F1/F2', links: [] },
        { machineName: 'xTool P2S', links: [] },
      ]),
      'xTool F1/F2 and xTool P2S'
    );
  });
});

void describe('unknownPlaceholders', () => {
  void it('reports placeholders that are not in PLACEHOLDERS', () => {
    assert.deepEqual(
      unknownPlaceholders(
        '{{FIRST_NAME}} {{PRODUCT}} {{PRODUCT}} {{SHOP_URL}}'
      ),
      ['PRODUCT', 'SHOP_URL']
    );
    for (const placeholder of PLACEHOLDERS) {
      assert.deepEqual(unknownPlaceholders(placeholder.token), []);
    }
  });
});

void describe('findPolicyProblem', () => {
  void it('accepts a neutral review request', () => {
    assert.equal(
      findPolicyProblem('A product review on Etsy would mean a lot.'),
      null
    );
    assert.equal(
      findPolicyProblem('An honest review helps other makers.'),
      null
    );
  });

  void it('refuses links in the text', () => {
    for (const text of ['See https://example.com', 'visit www.myshop.com']) {
      assert.match(findPolicyProblem(text) ?? '', /contains a link/);
    }
  });

  void it('refuses incentives', () => {
    for (const text of [
      'Use code THANKS for a discount',
      'Here is a coupon',
      'Get 10% off your next order',
      'I will send a free gift',
      'in exchange for a review',
    ]) {
      assert.match(
        findPolicyProblem(text) ?? '',
        /offers something in return/,
        text
      );
    }
  });

  void it('refuses asking for a particular rating', () => {
    for (const text of [
      'Please leave 5 stars',
      'a five-star review',
      'a positive review',
    ]) {
      assert.match(findPolicyProblem(text) ?? '', /particular rating/, text);
    }
  });
});

void describe('renderHelpfulLinks', () => {
  void it('groups links under each machine and skips machines with none', () => {
    const text = renderHelpfulLinks([
      ...LINKS,
      { machineName: 'xTool P2S', links: [] },
    ]);
    assert.match(
      text,
      /^Helpful links for the xTool F2 Ultra:\n• User manual: https:/
    );
    assert.doesNotMatch(text, /P2S/);
  });
});

void describe('detectMachines', () => {
  void it('lets the longer keyword win: "F2 Ultra" is not also an F1/F2 match', () => {
    assert.deepEqual(
      detectMachines(['xTool F2 Ultra UV Laser Jig'], MACHINES),
      ['ultra']
    );
  });

  void it('matches combined names by either half', () => {
    assert.deepEqual(
      detectMachines(['xTool F2 Laser Jig – Business Card Holder'], MACHINES),
      ['f1f2']
    );
    assert.deepEqual(
      detectMachines(['xTool F1/F2 Laser Jig – Plaque Holder'], MACHINES),
      ['f1f2']
    );
  });

  void it('finds several machines across items, case-insensitively, in profile order', () => {
    assert.deepEqual(
      detectMachines(['p2s coaster jig', 'xTool F1/F2 jig'], MACHINES),
      ['f1f2', 'p2s']
    );
  });

  void it('does not match inside a longer token', () => {
    assert.deepEqual(
      detectMachines(['xTool F20 Pro holder', 'P2SX stand'], MACHINES),
      []
    );
  });

  void it('uses explicit keywords when set', () => {
    const custom = [{ id: 's1', name: 'xTool S1', matchKeywords: 'S1, S-1' }];
    assert.deepEqual(keywordsFor(custom[0]!), ['S1', 'S-1']);
    assert.deepEqual(detectMachines(['Jig for the S-1 enclosure'], custom), [
      's1',
    ]);
  });
});

void describe('renderProductTips / {{PRODUCT_TIPS}}', () => {
  void it('renders one section per product with tips, with the shortened title', () => {
    assert.equal(
      renderProductTips([
        {
          title: 'xTool F2 Pencil Jig (Physical Product)',
          tips: '  Knobs finger-tight. ',
        },
        { title: 'Ink Pad Holder', tips: '' },
      ]),
      'Tips for the F2 Pencil Jig:\nKnobs finger-tight.'
    );
    assert.equal(renderProductTips([]), '');
  });

  void it('drops the paragraph when there are no tips or they are switched off', () => {
    const base = {
      buyerName: 'Jane',
      itemTitles: ['Ink Pad Holder'],
      isDigitalOnly: false,
      machines: [],
      includeLinks: true,
      signature: 'McQ',
    };
    const body = 'Hi {{FIRST_NAME}},\n\n{{PRODUCT_TIPS}}\n\nThanks';
    assert.equal(renderTemplate(body, base), 'Hi Jane,\n\nThanks');
    const productTips = [
      { title: 'Ink Pad Holder', tips: 'Wipe with a dry cloth.' },
    ];
    assert.equal(
      renderTemplate(body, { ...base, productTips }),
      'Hi Jane,\n\nTips for the Ink Pad Holder:\nWipe with a dry cloth.\n\nThanks'
    );
    assert.equal(
      renderTemplate(body, { ...base, productTips, includeProductTips: false }),
      'Hi Jane,\n\nThanks'
    );
  });
});
