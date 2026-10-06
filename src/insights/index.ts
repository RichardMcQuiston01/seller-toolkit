/**
 * Shop insights for Etsy sellers: dashboard widgets (sales totals with a
 * period comparison, revenue by month, top products, ratings, listing
 * alerts, repeat buyers...), unreviewed-order detection and per-day view
 * trends from daily listing snapshots.
 *
 * Pure functions over plain rows the consumer has already loaded. No
 * network, no database, no Etsy calls.
 */

export * from './dashboard.js';
export * from './unreviewed-orders.js';
export * from './view-trends.js';
