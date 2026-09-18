import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { calendarEventStore } from "./adapters/native/calendar-event-store.js";
import {
  codesignCodeRequirement,
  pinnedCodeRequirement,
} from "./adapters/native/codesign-code-requirement.js";
import { diskHelperFiles } from "./adapters/native/disk-helper-files.js";
import { Helper } from "./adapters/native/helper.js";
import { helperPermissions } from "./adapters/native/helper-permissions.js";
import { helperReminderStore } from "./adapters/native/reminder-store.js";
import { helperToLaunch } from "./application/setup/helper-to-launch.js";
import { installHelper } from "./application/setup/install-helper.js";
import { removeSetup, setup } from "./cli/setup.js";
import { helperPathSetting, settingsFrom } from "./domain/settings.js";
import { buildServer } from "./mcp/server.js";

// The composition root: the one place an adapter meets a use case.

/** One level up, whether this runs from `src/` or from `dist/`. */
const packageRoot = new URL("..", import.meta.url);

const { version: serverVersion } = JSON.parse(
  readFileSync(new URL("package.json", packageRoot), "utf8"),
) as { version: string };

/**
 * The shipped helper is the signed build the release puts inside the package; the fixed path is
 * the same for every install channel, so every update keeps the user's grants (ADR-0003).
 */
const helperFiles = diskHelperFiles({
  shipped: fileURLToPath(new URL("native/bin/apple-native-mcp", packageRoot)),
  fixed: join(homedir(), "Library", "Application Support", "apple-native-mcp", "apple-native-mcp"),
});

const codeRequirement = codesignCodeRequirement(pinnedCodeRequirement);

/** Only the client's configuration can name a development build (ADR-0003). */
const developmentBuild = process.env[helperPathSetting];

/** A helper started only once the check before launch allows it (ADR-0003). */
const helperChecked = (client: () => string): Helper =>
  new Helper(
    async () =>
      await helperToLaunch({
        helperFiles,
        codeRequirement,
        serverVersion,
        client: client(),
        ...(developmentBuild === undefined ? {} : { developmentBuild }),
      }),
  );

/** `apple-native-mcp setup`, run by the user in a terminal, where stdout is theirs to read. */
const runSetup = async (): Promise<void> => {
  const helper = helperChecked(() => "the install you ran setup from");
  const permissions = helperPermissions(helper);

  const status = await setup({ helperFiles, codeRequirement, permissions }, (line) => {
    console.log(line);
  });

  helper.stop();
  process.exit(status);
};

/** The MCP server, started by a client, which owns stdout for the protocol. */
const serve = async (): Promise<void> => {
  const settings = settingsFrom(process.env);

  // A client shows a server's stderr in its log, which is the one place a user looks when a
  // write they switched on is not offered.
  if (settings.unparsed !== undefined) {
    console.error(`apple-native-mcp: every write capability is off. ${settings.unparsed}`);
  }

  // An update arrives as a newer shipped helper, so every start offers it to the fixed path. A
  // failure here is not the end: the check before launch names what to do, on the call that
  // needs the helper.
  if (developmentBuild === undefined) {
    const installed = await installHelper({ helperFiles, codeRequirement });
    if (!installed.ok) {
      const { sentence, evidence } = installed.failure;
      const because = evidence === undefined ? "" : ` (${evidence})`;
      console.error(`apple-native-mcp: ${sentence}${because}`);
    }
  }

  // The client's name is asked for only when a tool first needs the helper, by which time the
  // client has said who it is in its initialize.
  const helper = helperChecked(
    () => server.server.getClientVersion()?.name ?? "your MCP client",
  );

  const server = buildServer({
    eventStore: calendarEventStore(helper),
    reminderStore: helperReminderStore(helper),
    now: () => new Date(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    settings,
  });

  const stopping = (): void => {
    helper.stop();
    process.exit(0);
  };

  process.on("SIGINT", stopping);
  process.on("SIGTERM", stopping);

  await server.connect(new StdioServerTransport());
};

/** `apple-native-mcp setup --remove`: takes the helper away and says what to turn off. */
const runRemoval = async (): Promise<void> => {
  const status = await removeSetup({ helperFiles }, (line) => {
    console.log(line);
  });

  process.exit(status);
};

const [command, option] = process.argv.slice(2);

if (command === "setup" && option === "--remove") await runRemoval();
else if (command === "setup") await runSetup();
else await serve();
