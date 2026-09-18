/** How many days back a mail search reaches when the caller names no start (#24). */
export const searchDays = 30;

/**
 * The most emails of one mailbox a search looks at, newest first, before it stops and says the
 * mailbox was truncated. A busy inbox measured a thousand emails in thirty days.
 */
export const searchCeiling = 2000;

/** How many matches a search reports when no limit is given, and the most it can. */
export const defaultMatches = 20;
export const greatestMatches = 50;

/** The longest search query read: a query is a few words, and each costs every email scanned. */
export const longestQuery = 200;

/**
 * How long a search may go on starting reads before it stops and reports what it has. A client
 * waits sixty seconds for a tool at the least (#25), and a read already started can take a whole
 * time budget of its own, as can the Message-IDs of the matches, so this leaves room for both.
 */
export const searchTimeBudgetSeconds = 40;
