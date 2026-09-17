import { event } from "./event.js";

export const occurrencesOf = (): readonly string[] => [event()].flat();
