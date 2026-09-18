import type { NamedFailure } from "./failure.js";

/** Every write v1 offers, each capability named after the tool it switches on. */
export const writeCapabilities = [
  "create_event",
  "create_reminder",
  "create_note",
  "update_note",
  "create_draft",
  "send_email",
  "send_message",
] as const;

export type WriteCapability = (typeof writeCapabilities)[number];

/** Which items of one kind the settings keep from the agent, each addressed by identifier. */
export type Exclusion = {
  /** When set, only these are kept in. Set but empty keeps nothing in: it fails closed. */
  readonly allowlist?: ReadonlySet<string>;
  readonly excluded: ReadonlySet<string>;
};

/**
 * What the user set for this server in the client's configuration.
 *
 * Settings are read from nowhere else. Any file the server could read is one an agent with file
 * access could write, which would let a prompt-injected agent grant itself sending (#19).
 */
export type Settings = {
  /** The write capabilities the user named. Anything not named is off. */
  readonly capabilities: ReadonlySet<WriteCapability>;
  /** What did not parse, when something did not: every write capability is then off. */
  readonly unparsed?: string;
  readonly calendars: Exclusion;
};

/** The client's configuration as the server receives it: the `env` block of its entry. */
type ClientConfiguration = Readonly<Record<string, string | undefined>>;

const ours = "APPLE_NATIVE_MCP_";
const capabilitiesSetting = `${ours}CAPABILITIES`;
const calendarAllowlistSetting = `${ours}CALENDAR_ALLOWLIST`;
const excludedCalendarsSetting = `${ours}EXCLUDED_CALENDARS`;

/** Where a development build of the helper is, which the composition root reads (ADR-0003). */
export const helperPathSetting = `${ours}HELPER`;

const knownSettings: readonly string[] = [
  capabilitiesSetting,
  calendarAllowlistSetting,
  excludedCalendarsSetting,
  helperPathSetting,
];

const isWriteCapability = (name: string): name is WriteCapability =>
  (writeCapabilities as readonly string[]).includes(name);

const listed = (value: string | undefined): readonly string[] =>
  (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry !== "");

const quoted = (names: readonly string[]): string => names.map((name) => `"${name}"`).join(", ");

const exclusionFrom = (
  allowlist: string | undefined,
  excluded: string | undefined,
): Exclusion => ({
  ...(allowlist === undefined ? {} : { allowlist: new Set(listed(allowlist)) }),
  excluded: new Set(listed(excluded)),
});

/** Why the settings do not parse, or nothing when they do. */
const whatDoesNotParse = (configuration: ClientConfiguration): string | undefined => {
  const strangers = Object.keys(configuration).filter(
    (name) => name.startsWith(ours) && !knownSettings.includes(name),
  );
  const notCapabilities = listed(configuration[capabilitiesSetting]).filter(
    (name) => !isWriteCapability(name),
  );

  if (strangers.length > 0) {
    return `${quoted(strangers)} is not a setting. The settings are ${knownSettings.join(", ")}.`;
  }

  if (notCapabilities.length > 0) {
    return (
      `${capabilitiesSetting} names ${quoted(notCapabilities)}, which is not a capability. ` +
      `The capabilities are ${writeCapabilities.join(", ")}.`
    );
  }

  return undefined;
};

/**
 * Settings that do not parse switch every write off, rather than keeping the parts that did: a
 * line that half-worked would leave the user believing the rest of it was what they had asked
 * for. What is kept from the agent is still kept, since dropping that would show it more.
 */
export const settingsFrom = (configuration: ClientConfiguration): Settings => {
  const calendars = exclusionFrom(
    configuration[calendarAllowlistSetting],
    configuration[excludedCalendarsSetting],
  );
  const unparsed = whatDoesNotParse(configuration);

  if (unparsed !== undefined) return { calendars, capabilities: new Set(), unparsed };

  return {
    calendars,
    capabilities: new Set(listed(configuration[capabilitiesSetting]).filter(isWriteCapability)),
  };
};

/** Excluding wins: an identifier on both lists is kept from the agent. */
export const excludes = (exclusion: Exclusion, identifier: string): boolean =>
  exclusion.excluded.has(identifier) ||
  (exclusion.allowlist !== undefined && !exclusion.allowlist.has(identifier));

export const isOn = (settings: Settings, capability: WriteCapability): boolean =>
  settings.capabilities.has(capability);

/** Why a call was refused, and the setting that would allow it. */
export const capabilityOff = (settings: Settings, capability: WriteCapability): NamedFailure => ({
  code: "capability-off",
  sentence:
    settings.unparsed === undefined
      ? `Nothing was done: the ${capability} capability is switched off.`
      : "Nothing was done: the settings do not parse, so every write capability is off.",
  setting:
    `Add ${capability} to ${capabilitiesSetting} in the env block of this server's entry in ` +
    "the client's configuration, then restart the client.",
  ...(settings.unparsed === undefined ? {} : { evidence: settings.unparsed }),
});
