import { z } from "zod";

import type { Bound } from "../domain/search-range.js";
import { dayWritten } from "../domain/time-zone.js";

/** An instant with its offset, or a day alone, which means the whole of it locally. */
export const bound = z.union([z.iso.date(), z.iso.datetime({ offset: true })]);

export const asBound = (written: string | undefined): Bound | undefined => {
  if (written === undefined) return undefined;
  return /^\d{4}-\d{2}-\d{2}$/u.test(written)
    ? { day: dayWritten(written) }
    : { at: new Date(written) };
};
