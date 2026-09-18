const parts = (version: string): readonly number[] => version.split(".").map(Number);

/**
 * Whether one helper version is newer than another, compared part by part as numbers.
 *
 * The helper and the server share one version, so this also says whether a helper is newer than
 * the server about to launch it.
 */
export const isNewer = (version: string, than: string): boolean => {
  const mine = parts(version);
  const theirs = parts(than);

  for (let index = 0; index < Math.max(mine.length, theirs.length); index += 1) {
    const difference = (mine[index] ?? 0) - (theirs[index] ?? 0);
    if (difference !== 0) return difference > 0;
  }

  return false;
};
