import { z } from "zod";

import type { WriteCapability } from "../../src/domain/settings.js";
import { reporting } from "../../src/mcp/result.js";
import { tool, type Tool } from "../../src/mcp/tool.js";

type StandIn = { tool: Tool; created: unknown[] };

const aToolThatRemembers = (name: string, capability: WriteCapability | undefined): StandIn => {
  const created: unknown[] = [];

  return {
    created,
    tool: tool({
      name,
      title: "Create a calendar event",
      description: "A new event in a calendar.",
      capability,
      input: { title: z.string() },
      output: { title: z.string().optional() },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: false },
      call: (request) => {
        created.push(request);
        return Promise.resolve(reporting({ title: request.title }));
      },
    }),
  };
};

/**
 * A write tool that only remembers what it was asked to create.
 *
 * The scenarios about calling a tool are rules of the server rather than of any one tool, so
 * they use this one and stay still when a real tool's arguments change.
 */
export const aToolThatCreatesAnEvent = (): StandIn =>
  aToolThatRemembers("create_event", "create_event");

/** The mistake the server has to survive: a tool that changes a store and names no capability. */
export const aToolThatNamesNoCapability = (): StandIn =>
  aToolThatRemembers("rename_event", undefined);
