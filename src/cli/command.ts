/** What `apple-native-mcp` was asked to do. */
export type Command =
  | { readonly command: "serve" }
  | { readonly command: "setup" }
  | { readonly command: "remove" }
  | { readonly command: "unknown"; readonly usage: string };

const usage = "Usage: apple-native-mcp [setup [--remove]]";

/**
 * The command the arguments name. Only the exact forms are known: anything else is refused,
 * never taken for the nearest match.
 */
export const commandIn = (args: readonly string[]): Command => {
  const [first, second, ...rest] = args;
  if (rest.length > 0) return { command: "unknown", usage };

  if (first === undefined) return { command: "serve" };
  if (first === "setup" && second === undefined) return { command: "setup" };
  if (first === "setup" && second === "--remove") return { command: "remove" };

  return { command: "unknown", usage };
};
