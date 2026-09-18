import { execFileSync } from "node:child_process";

export const sendMessage = (recipient: string, body: string): string =>
  execFileSync("/usr/bin/osascript", ["-e", `tell application "Messages" to send "${body}" to buddy "${recipient}"`]).toString();
