/**
 * Personalised thank-you messages, rendered from editable templates for the
 * seller to copy and paste into Etsy Messages by hand.
 *
 * A template is plain text with {{PLACEHOLDERS}} (see PLACEHOLDERS). The
 * three presets below are the defaults; a consumer can let the seller reword
 * them and store those edits itself (this package has no storage).
 *
 * Etsy rules the templates must respect (see the package README), which a
 * consumer should enforce on save with findPolicyProblem():
 *   - A neutral review request only. Never offer anything in exchange
 *     (discount, coupon, freebie, refund) and never ask for a particular
 *     rating.
 *   - No links in the text itself. Links come only from a machine's curated
 *     "Helpful links" (free, non-commercial, never off-Etsy stores), which
 *     have their own checks.
 *   - Nothing here sends anything. The output is text.
 */

export const THANK_YOU_TEMPLATE_IDS = [
  'warm',
  'check-in',
  'resources',
] as const;
export type ThankYouTemplateId = (typeof THANK_YOU_TEMPLATE_IDS)[number];

/** The editable parts of a template. */
export interface MessageTemplateText {
  readonly name: string;
  readonly description: string;
  readonly body: string;
  /** Used instead of `body` when every item is a digital download; null = use `body`. */
  readonly digitalBody: string | null;
}

export interface ThankYouTemplate extends MessageTemplateText {
  readonly id: ThankYouTemplateId;
}

export interface PlaceholderInfo {
  readonly token: string;
  readonly description: string;
}

/** Every placeholder a template may use. Anything else is rejected on save. */
export const PLACEHOLDERS: readonly PlaceholderInfo[] = [
  {
    token: '{{FIRST_NAME}}',
    description: 'Buyer’s first name, or “there” when Etsy omits it',
  },
  {
    token: '{{PRODUCT_TITLE}}',
    description: 'Short product title(s), e.g. “F2 Ultra UV Laser Jig”',
  },
  {
    token: '{{MACHINE}}',
    description: 'Machine name(s), e.g. “xTool F2 Ultra”, or “machine”',
  },
  {
    token: '{{HELPFUL_LINKS}}',
    description:
      'The machine’s helpful links. Its paragraph is left out when there are none',
  },
  {
    token: '{{PRODUCT_TIPS}}',
    description:
      'Your saved tips for the ordered product(s), from the Items tab. Its paragraph is left out when there are none',
  },
  {
    token: '{{MACHINE_TIPS}}',
    description:
      'The machine’s saved tips. Its paragraph is left out when there are none',
  },
  {
    token: '{{PURCHASE_LINK}}',
    description:
      'Link to the buyer’s own order page on Etsy, where they can leave a review. Its paragraph is left out when the order number is unknown',
  },
  { token: '{{SIGNATURE}}', description: 'Your sign-off name' },
];

/**
 * The buyer's own page for this order on etsy.com ("Purchases and reviews"),
 * where Etsy shows the "Leave a review" button. It stays on Etsy, so it's
 * not steering anyone off-platform. Null for anything but a numeric id.
 */
export function etsyPurchaseUrl(
  etsyReceiptId: string | null | undefined
): string | null {
  const id: string = (etsyReceiptId ?? '').trim();
  return /^\d+$/.test(id)
    ? `https://www.etsy.com/your/purchases/${id}?ref=yr_purchases`
    : null;
}

/** Sign-off used when `ThankYouContext.signature` is blank and no fallback is given. */
export const DEFAULT_SIGNATURE = 'McQ';

/**
 * Brand prefixes shortenTitle() strips from the start of a listing title,
 * applied in order (each at most once). The defaults suit listings titled
 * "xTool F2 Ultra …"; pass your own to shortenTitle() or via
 * `ThankYouContext.titlePrefixPatterns`.
 */
export const DEFAULT_TITLE_PREFIX_PATTERNS: readonly RegExp[] = [
  /^xTool\s+F1\/F2\s+/i,
  /^xTool\s+/i,
];

/**
 * Brand prefix keywordsFor() strips from a machine name when deriving match
 * keywords ("xTool F2 Ultra" → "F2 Ultra"). Override per call, or null to
 * strip nothing.
 */
export const DEFAULT_MACHINE_NAME_PREFIX: RegExp = /^xTool\s+/i;

const REVIEW_ASK = 'A product review on Etsy would mean a lot.';
const PURCHASE_LINK_LINE =
  'You can leave one from your order page: {{PURCHASE_LINK}}';

export const DEFAULT_TEMPLATES: Readonly<
  Record<ThankYouTemplateId, ThankYouTemplate>
> = {
  warm: {
    id: 'warm',
    name: 'Short & warm',
    description: 'A brief thank-you with a gentle review ask.',
    body: [
      'Hi {{FIRST_NAME}},',
      'Thank you so much for ordering the {{PRODUCT_TITLE}}. I hope it’s everything you were looking for.',
      '{{PRODUCT_TIPS}}',
      '{{MACHINE_TIPS}}',
      '{{HELPFUL_LINKS}}',
      `${REVIEW_ASK} It really helps a small shop like mine.`,
      PURCHASE_LINK_LINE,
      'Thanks again,\n{{SIGNATURE}}',
    ].join('\n\n'),
    digitalBody: null,
  },
  'check-in': {
    id: 'check-in',
    name: 'Maker check-in',
    description:
      'Asks how it is working on their machine and offers help first.',
    body: [
      'Hi {{FIRST_NAME}},',
      'Thank you for ordering the {{PRODUCT_TITLE}}! I hope it’s working well on your {{MACHINE}}. If anything isn’t seating right, just reply here and I’ll make it right.',
      '{{PRODUCT_TIPS}}',
      '{{MACHINE_TIPS}}',
      '{{HELPFUL_LINKS}}',
      `If it’s saved you some setup time, ${REVIEW_ASK.charAt(0).toLowerCase()}${REVIEW_ASK.slice(1)}`,
      PURCHASE_LINK_LINE,
      'Thanks again,\n{{SIGNATURE}}',
    ].join('\n\n'),
    digitalBody: [
      'Hi {{FIRST_NAME}},',
      'Thank you for ordering the {{PRODUCT_TITLE}}! I hope it printed cleanly for you. If anything didn’t fit right (pocket tolerance, first layer, whatever it is), just reply here and I’ll sort it out or send a revised file.',
      '{{PRODUCT_TIPS}}',
      '{{MACHINE_TIPS}}',
      '{{HELPFUL_LINKS}}',
      `If it’s saved you some setup time, ${REVIEW_ASK.charAt(0).toLowerCase()}${REVIEW_ASK.slice(1)}`,
      PURCHASE_LINK_LINE,
      'Thanks again,\n{{SIGNATURE}}',
    ].join('\n\n'),
  },
  resources: {
    id: 'resources',
    name: 'Tips & resources',
    description:
      'Leads with tips and free resources for their machine, then a soft review ask.',
    body: [
      'Hi {{FIRST_NAME}},',
      'Thank you for ordering the {{PRODUCT_TITLE}}! Here are a few things other {{MACHINE}} owners have found useful.',
      '{{PRODUCT_TIPS}}',
      '{{MACHINE_TIPS}}',
      '{{HELPFUL_LINKS}}',
      `If anything isn’t working the way you’d like, just reply here and I’ll help sort it out. And if you’re happy with it, ${REVIEW_ASK.charAt(0).toLowerCase()}${REVIEW_ASK.slice(1)}`,
      PURCHASE_LINK_LINE,
      'Thanks again,\n{{SIGNATURE}}',
    ].join('\n\n'),
    digitalBody: null,
  },
};

export interface HelpfulLink {
  readonly label: string;
  readonly url: string;
}

export interface MachineLinks {
  /** Display name, e.g. "xTool F2 Ultra". */
  readonly machineName: string;
  readonly links: readonly HelpfulLink[];
  /** Saved tips for this machine (assembly, setup...); empty when none. */
  readonly tips?: string;
}

export interface ProductTips {
  /** The item title as ordered; shortened when rendered. */
  readonly title: string;
  readonly tips: string;
}

export interface ThankYouContext {
  readonly buyerName: string | null;
  /** Etsy's order number, for {{PURCHASE_LINK}}; omitted or null leaves that paragraph out. */
  readonly etsyReceiptId?: string | null;
  readonly itemTitles: readonly string[];
  readonly isDigitalOnly: boolean;
  /** Machines detected (or chosen) for this order, each with its links and tips. */
  readonly machines: readonly MachineLinks[];
  readonly includeLinks: boolean;
  /** Defaults to true; false leaves {{MACHINE_TIPS}} paragraphs out. */
  readonly includeTips?: boolean;
  /** Saved tips for the ordered products (Items tab); omitted means none. */
  readonly productTips?: readonly ProductTips[];
  /** Defaults to true; false leaves {{PRODUCT_TIPS}} paragraphs out. */
  readonly includeProductTips?: boolean;
  /** Sign-off name, e.g. "McQ". */
  readonly signature: string;
  /** Used when `signature` is blank; defaults to DEFAULT_SIGNATURE. */
  readonly fallbackSignature?: string;
  /** Prefixes stripped from item titles; defaults to DEFAULT_TITLE_PREFIX_PATTERNS. */
  readonly titlePrefixPatterns?: readonly RegExp[];
}

export function isThankYouTemplateId(
  value: string
): value is ThankYouTemplateId {
  return (THANK_YOU_TEMPLATE_IDS as readonly string[]).includes(value);
}

/** "Jane" from "Jane Doe"; null when Etsy didn't return a usable name. */
export function firstNameOf(buyerName: string | null): string | null {
  const first: string | undefined = buyerName?.trim().split(/\s+/)[0];
  if (first === undefined || first.length === 0) {
    return null;
  }
  // Etsy names are often ALL CAPS ("KAREN BOWERS"); "Karen" reads warmer.
  return first === first.toUpperCase() && first.length > 1
    ? first.charAt(0) + first.slice(1).toLowerCase()
    : first;
}

/** Strip an Etsy listing title down to something usable mid-sentence. */
export function shortenTitle(
  title: string,
  prefixPatterns: readonly RegExp[] = DEFAULT_TITLE_PREFIX_PATTERNS
): string {
  const withoutPrefix: string = prefixPatterns.reduce(
    (text: string, pattern: RegExp) => text.replace(pattern, ''),
    title
  );
  const withoutSuffix: string = withoutPrefix
    .replace(/\s*\((Digital Download|Physical Product|PLA)\)\s*$/i, '')
    .replace(/\s*\|\s*.*$/, '')
    // "Laser Jig – 25 Pencil Batch Engraving Alignment Fixture" → "Laser Jig"
    .replace(/\s+[–—-]\s+.*$/u, '');
  return withoutSuffix.trim();
}

/** "A", "A and B", "A, B and C", "A, B and 2 other items"; "item" when there are none. */
export function productTitles(
  itemTitles: readonly string[],
  prefixPatterns: readonly RegExp[] = DEFAULT_TITLE_PREFIX_PATTERNS
): string {
  const titles: string[] = [
    ...new Set(
      itemTitles
        .map((title) => shortenTitle(title, prefixPatterns))
        .filter((title) => title.length > 0)
    ),
  ];
  if (titles.length === 0) return 'item';
  if (titles.length === 1) return titles[0] ?? 'item';
  if (titles.length <= 3) {
    return `${titles.slice(0, -1).join(', ')} and ${titles[titles.length - 1]}`;
  }
  const others: number = titles.length - 2;
  return `${titles.slice(0, 2).join(', ')} and ${others} other items`;
}

/** "xTool F2", "xTool F1/F2 and xTool P2S", "machine". */
export function machineNames(machines: readonly MachineLinks[]): string {
  const names: string[] = machines.map((machine) => machine.machineName);
  if (names.length === 0) return 'machine';
  if (names.length === 1) return names[0] ?? 'machine';
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

/** The "Helpful links" block, grouped by machine; empty string when there's nothing to show. */
export function renderHelpfulLinks(machines: readonly MachineLinks[]): string {
  const sections: string[] = machines
    .filter((machine) => machine.links.length > 0)
    .map((machine) =>
      [
        `Helpful links for the ${machine.machineName}:`,
        ...machine.links.map((link) => `• ${link.label}: ${link.url}`),
      ].join('\n')
    );
  return sections.join('\n\n');
}

/** The tips block, one section per machine with tips; empty string when none have any. */
export function renderMachineTips(machines: readonly MachineLinks[]): string {
  return machines
    .filter((machine) => (machine.tips ?? '').trim().length > 0)
    .map(
      (machine) =>
        `Tips for the ${machine.machineName}:\n${(machine.tips ?? '').trim()}`
    )
    .join('\n\n');
}

/** The product tips block, one section per product with tips; empty string when none. */
export function renderProductTips(
  products: readonly ProductTips[],
  prefixPatterns: readonly RegExp[] = DEFAULT_TITLE_PREFIX_PATTERNS
): string {
  return products
    .filter((product) => product.tips.trim().length > 0)
    .map(
      (product) =>
        `Tips for the ${shortenTitle(product.title, prefixPatterns)}:\n${product.tips.trim()}`
    )
    .join('\n\n');
}

const PLACEHOLDER_PATTERN = /\{\{\s*([A-Z_]+)\s*\}\}/g;
const KNOWN_PLACEHOLDERS: ReadonlySet<string> = new Set(
  PLACEHOLDERS.map((placeholder) => placeholder.token.slice(2, -2))
);

/** Placeholder names used in `text` that aren't in PLACEHOLDERS. */
export function unknownPlaceholders(text: string): string[] {
  const unknown = new Set<string>();
  for (const match of text.matchAll(PLACEHOLDER_PATTERN)) {
    const name: string | undefined = match[1];
    if (name !== undefined && !KNOWN_PLACEHOLDERS.has(name)) unknown.add(name);
  }
  return [...unknown];
}

/** The template body that applies to this order. */
export function bodyFor(
  template: MessageTemplateText,
  isDigitalOnly: boolean
): string {
  return isDigitalOnly &&
    template.digitalBody !== null &&
    template.digitalBody.trim().length > 0
    ? template.digitalBody
    : template.body;
}

/**
 * Fills a template body. Paragraphs (separated by a blank line) that use a
 * placeholder with nothing to show, {{HELPFUL_LINKS}} with no links for
 * example, are left out entirely, so there's no dangling intro or gap.
 */
export function renderTemplate(body: string, context: ThankYouContext): string {
  const firstName: string | null = firstNameOf(context.buyerName);
  const prefixPatterns: readonly RegExp[] =
    context.titlePrefixPatterns ?? DEFAULT_TITLE_PREFIX_PATTERNS;
  const values: Readonly<Record<string, string>> = {
    FIRST_NAME: firstName ?? 'there',
    PRODUCT_TITLE: productTitles(context.itemTitles, prefixPatterns),
    MACHINE: machineNames(context.machines),
    HELPFUL_LINKS: context.includeLinks
      ? renderHelpfulLinks(context.machines)
      : '',
    MACHINE_TIPS:
      (context.includeTips ?? true) ? renderMachineTips(context.machines) : '',
    PRODUCT_TIPS:
      (context.includeProductTips ?? true)
        ? renderProductTips(context.productTips ?? [], prefixPatterns)
        : '',
    PURCHASE_LINK: etsyPurchaseUrl(context.etsyReceiptId) ?? '',
    SIGNATURE:
      context.signature.trim() ||
      context.fallbackSignature ||
      DEFAULT_SIGNATURE,
  };

  const paragraphs: string[] = body
    .replace(/\r\n/g, '\n')
    .split(/\n[ \t]*\n/)
    .filter((paragraph) => {
      for (const match of paragraph.matchAll(PLACEHOLDER_PATTERN)) {
        const name: string = match[1] ?? '';
        if (values[name] === '') return false;
      }
      return paragraph.trim().length > 0;
    })
    .map((paragraph) =>
      // Unknown placeholders are refused on save; any that slip through stay visible.
      paragraph
        .replace(
          PLACEHOLDER_PATTERN,
          (token, name: string) => values[name] ?? token
        )
        .trim()
    );
  return paragraphs.join('\n\n');
}

/** Renders one of the presets, or an edited version of it. */
export function renderThankYou(
  template: ThankYouTemplateId | MessageTemplateText,
  context: ThankYouContext
): string {
  const resolved: MessageTemplateText =
    typeof template === 'string' ? DEFAULT_TEMPLATES[template] : template;
  return renderTemplate(bodyFor(resolved, context.isDigitalOnly), context);
}

/**
 * Wording Etsy doesn't allow in a review request, or that bypasses the link
 * checks. Returns a specific problem, or null when the text is fine. Applied
 * to template text and machine tips on save.
 */
export function findPolicyProblem(text: string): string | null {
  if (/https?:\/\/|www\.[a-z0-9-]+\.[a-z]/i.test(text)) {
    return 'contains a link. Add links under a machine’s Helpful links instead, where they are checked (https only, never another store)';
  }
  if (
    /\b(discount|coupon|promo(tion)? code|voucher|gift card|% off|percent off|free (gift|item|shipping|product)|refund (if|for|in exchange)|in exchange for)\b/i.test(
      text
    ) ||
    /\d+\s?% off/i.test(text)
  ) {
    return 'offers something in return. Etsy prohibits incentives for reviews (discounts, coupons, freebies, refunds)';
  }
  if (
    /\b(5|five)[- ]?stars?\b|\b(positive|good|great|glowing|perfect) (review|rating|feedback)\b|\brate (us|me|it) (highly|5)/i.test(
      text
    )
  ) {
    return 'asks for a particular rating. Etsy only allows a neutral request for a review';
  }
  return null;
}

export interface MachineMatcher {
  readonly id: string;
  readonly name: string;
  /** Comma-separated; empty means "derive from the name" (see keywordsFor). */
  readonly matchKeywords: string;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function keywordsFor(
  machine: MachineMatcher,
  namePrefix: RegExp | null = DEFAULT_MACHINE_NAME_PREFIX
): string[] {
  const explicit: string[] = machine.matchKeywords
    .split(',')
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
  if (explicit.length > 0) return explicit;
  // No keywords set: the name without its brand prefix ("xTool" by default),
  // plus each half of a combined name, so "xTool F1/F2" also matches a title
  // that only says "F2".
  const base: string = (
    namePrefix === null ? machine.name : machine.name.replace(namePrefix, '')
  ).trim();
  if (base.length === 0) return [];
  const parts: string[] = base.includes('/')
    ? base
        .split('/')
        .map((part) => part.trim())
        .filter((part) => part.length > 0)
    : [];
  return [base, ...parts];
}

/**
 * Which machines an order's item titles mention. Longest keywords match
 * first and consume their text, so "F2 Ultra" claims "xTool F2 Ultra Jig"
 * before the shorter "F2" keyword of the F1/F2 profile can.
 */
export function detectMachines(
  itemTitles: readonly string[],
  machines: readonly MachineMatcher[],
  namePrefix: RegExp | null = DEFAULT_MACHINE_NAME_PREFIX
): string[] {
  let remaining: string = itemTitles.join(' \n ');
  const candidates = machines
    .flatMap((machine) =>
      keywordsFor(machine, namePrefix).map((keyword) => ({ machine, keyword }))
    )
    .sort((a, b) => b.keyword.length - a.keyword.length);

  const matched = new Set<string>();
  for (const { machine, keyword } of candidates) {
    // Word-ish boundaries that also work around "/" in "F1/F2".
    const pattern = new RegExp(
      `(^|[^A-Za-z0-9])${escapeRegExp(keyword)}(?![A-Za-z0-9])`,
      'gi'
    );
    if (pattern.test(remaining)) {
      matched.add(machine.id);
      remaining = remaining.replace(
        pattern,
        (_match, prefix: string) => `${prefix} `
      );
    }
  }
  // Keep the caller's machine order for stable output.
  return machines
    .filter((machine) => matched.has(machine.id))
    .map((machine) => machine.id);
}
