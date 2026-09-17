import { execFileSync } from "node:child_process";

export const runScript = (path: string): string =>
  execFileSync("/usr/bin/osascript", [path]).toString();
