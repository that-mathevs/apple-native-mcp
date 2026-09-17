import { spawn } from "node:child_process";

export const launchHelper = (path: string): ReturnType<typeof spawn> =>
  spawn(path, ["--serve"], { stdio: ["pipe", "pipe", "inherit"] });
