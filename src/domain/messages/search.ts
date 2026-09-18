/** How many days back a search reaches when the caller names no start (#20). */
export const searchDays = 30;

/**
 * The most messages one search scans, newest first, before it stops and says how far back it
 * reached. The maintainer's choice for #40.
 */
export const searchCeiling = 20_000;

/** The most matches one search returns, the best first. It says how many matched in all. */
export const greatestMatches = 50;

/** The longest search query read: a query is a few words, and each costs every text scanned. */
export const longestQuery = 200;
