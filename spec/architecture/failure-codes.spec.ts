import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

// X-20 asks for "a stable code" an agent can branch on. Two spellings of one idea is not that:
// the server's own codes were kebab-case, the helper's passed through in snake_case, and one
// failure could arrive both ways (calendar-not-found and calendar_not_found). The helper's
// protocol keeps its own spelling, which never changes once published; the adapter translates.

/** Every failure code a tool can answer with, as an agent reads it. */
const everyFailureCode = [
  "arguments-invalid",
  "calendar-identifier-needed",
  "calendar-not-found",
  "calendar-not-writable",
  "calendar-permission-missing",
  "calendar-unreadable",
  "capability-off",
  "chat-unknown",
  "contact-note-unavailable",
  "contacts-permission-missing",
  "contacts-unreadable",
  "email-not-found",
  "email-reference-stale",
  "event-duplicate",
  "event-not-found",
  "event-not-saved",
  "event-time-invalid",
  "helper-answer-unreadable",
  "helper-fails-code-requirement",
  "helper-failure",
  "helper-files-unreadable",
  "helper-install-failed",
  "helper-not-asked",
  "helper-not-removed",
  "helper-not-installed",
  "helper-not-shipped",
  "helper-not-started",
  "helper-older-than-server",
  "helper-stopped",
  "helper-timed-out",
  "helper-version-unreadable",
  "local-mailboxes-not-asked",
  "mail-account-ambiguous",
  "mail-account-has-no-inbox",
  "mail-account-not-asked",
  "mail-account-unknown",
  "mail-accounts-unread",
  "mail-did-not-start",
  "mail-permission-missing",
  "mail-search-out-of-time",
  "mail-search-reached-nothing",
  "mail-timed-out",
  "mail-unreadable",
  "mailbox-bodies-out-of-time",
  "mailbox-bodies-unread",
  "mailbox-matches-unreferenced",
  "mailbox-needs-its-mail-account",
  "mailbox-not-asked",
  "mailbox-too-large",
  "mailbox-unknown",
  "message-store-not-found",
  "message-store-permission-missing",
  "message-store-unreadable",
  "message-text-unreadable",
  "note-not-found",
  "notes-permission-missing",
  "notes-timed-out",
  "notes-unreadable",
  "permission-state-unreadable",
  "protocol-version-unsupported",
  "query-too-short",
  "range-not-forwards",
  "range-too-long",
  "reminder-duplicate",
  "reminder-list-ambiguous",
  "reminder-list-needed",
  "reminder-list-unknown",
  "reminder-due-invalid",
  "reminder-not-saved",
  "reminders-permission-missing",
  "reminders-timed-out",
  "request-malformed",
  "request-unknown",
  "result-invalid",
  "server-older-than-helper",
  "tool-not-offered",
  "tool-unknown",
] as const;

const at = (path: string): string => fileURLToPath(new URL(path, import.meta.url));

const filesUnder = (directory: string): string[] =>
  readdirSync(directory, { recursive: true, encoding: "utf8" })
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".spec.ts"))
    .map((entry) => `${directory}/${entry}`);

/**
 * Every code the server names in its own failures: as a field, or as the first thing a failure
 * builder is given, which is how the refusals that carry records are written.
 */
const namings = [
  /code: "(?<code>[^"]+)"/gu,
  /\(\s*"(?<code>[a-z]+(?:-[a-z]+)+)",/gu,
];

const codesInTheServer = (): string[] =>
  filesUnder(at("../../src")).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    return namings.flatMap((naming) =>
      [...source.matchAll(naming)].map((found) => found.groups?.code ?? ""),
    );
  });

/** Every code the helper can send, as the protocol spells them. */
const codesInTheHelper = (): string[] =>
  [
    ...readFileSync(at("../../native/Sources/HelperCore/NamedFailure.swift"), "utf8").matchAll(
      /case \w+ = "(?<code>[^"]+)"/gu,
    ),
  ].map((found) => found.groups?.code ?? "");

describe("every failure code an agent sees", () => {
  // Both readings are of source, so a regex that stopped matching would leave nothing to check
  // and every scenario below would pass on an empty list.
  it("is found where it is written: in the server's own failures, and in the helper's protocol", () => {
    expect(new Set(codesInTheServer()).size).toBeGreaterThan(30);
    expect(new Set(codesInTheHelper()).size).toBeGreaterThan(20);
  });

  it("is spelt one way: words parted by hyphens, never by underscores", () => {
    for (const code of everyFailureCode) expect(code).toMatch(/^[a-z]+(?:-[a-z]+)*$/u);
  });

  it("is one of the codes this scenario lists, so a new one in another spelling fails here", () => {
    for (const code of new Set(codesInTheServer())) expect(everyFailureCode).toContain(code);
  });

  // The helper's own codes never change once published, so the adapter translates them instead.
  it("covers every code the helper can send, translated as the adapter translates it", () => {
    for (const code of codesInTheHelper()) {
      expect(everyFailureCode).toContain(code.replaceAll("_", "-"));
    }
  });

  // A code nothing can answer with any more is one an agent is told to expect for nothing.
  it("can still be answered with: by the server, or by the helper", () => {
    const answerable = new Set([
      ...codesInTheServer(),
      ...codesInTheHelper().map((code) => code.replaceAll("_", "-")),
    ]);

    for (const code of everyFailureCode) expect([...answerable]).toContain(code);
  });
});
