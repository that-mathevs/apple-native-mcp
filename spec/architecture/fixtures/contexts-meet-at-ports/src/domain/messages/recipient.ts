import { normalise } from "../contacts/handle.js";

export const recipient = (handle: string): string => normalise(handle);
