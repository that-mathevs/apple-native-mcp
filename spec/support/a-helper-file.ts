import { execFile } from "node:child_process";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

/**
 * A tiny program carrying an Info.plist the way the helper does, in its __TEXT,__info_plist
 * section, built for the architectures asked. It lets the real helper files be specified with a
 * version the scenario chose, on any Mac with the command line tools, and no helper built.
 */
export const aHelperFileCarrying = async (
  version: string | undefined,
  directory: string,
  architectures: readonly string[] = ["arm64", "x86_64"],
): Promise<string> => {
  const source = join(directory, "main.c");
  const infoPlist = join(directory, "Info.plist");
  const program = join(directory, `helper-${version ?? "unversioned"}`);

  await writeFile(source, "int main(void) { return 0; }\n");
  await writeFile(
    infoPlist,
    '<?xml version="1.0" encoding="UTF-8"?>\n<plist version="1.0"><dict>' +
      "<key>CFBundleIdentifier</key><string>io.github.that-mathevs.apple-native-mcp</string>" +
      (version === undefined
        ? ""
        : `<key>CFBundleShortVersionString</key><string>${version}</string>`) +
      "</dict></plist>\n",
  );

  await run("/usr/bin/cc", [
    source,
    ...architectures.flatMap((architecture) => ["-arch", architecture]),
    "-o",
    program,
    `-Wl,-sectcreate,__TEXT,__info_plist,${infoPlist}`,
  ]);

  return program;
};
