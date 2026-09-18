import { execFile } from "node:child_process";

export const checkCodeRequirement = (path: string, requirement: string): void => {
  execFile("/usr/bin/codesign", ["--verify", "--strict", `-R=${requirement}`, path]);
};
