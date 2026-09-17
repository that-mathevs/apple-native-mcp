import { execa } from "execa";

export const launchHelper = async (path: string): Promise<string> => {
  const { stdout } = await execa(path, ["--serve"]);
  return stdout;
};
