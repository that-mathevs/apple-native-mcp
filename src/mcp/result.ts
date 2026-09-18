import type { NamedFailure } from "../domain/failure.js";

/**
 * What a tool answers with.
 *
 * Every result is a record, carried in `structuredContent` and mirrored as JSON text for
 * clients that only read `content`. Text the user didn't write is always a field of a
 * record, so a hostile body can't pose as another record or as the server speaking
 * (ADR-0006: one crafted email forged both a fork's "external content" banner and another's
 * `||` separators).
 */
export type ToolResult = {
  content: { type: "text"; text: string }[];
  structuredContent: Record<string, unknown>;
  isError?: boolean;
};

const asResult = (record: Record<string, unknown>, isError?: boolean): ToolResult => ({
  content: [{ type: "text", text: JSON.stringify(record) }],
  structuredContent: record,
  ...(isError === undefined ? {} : { isError }),
});

export const reporting = (record: Record<string, unknown>): ToolResult => asResult(record);

export const refusing = (failure: NamedFailure): ToolResult =>
  asResult({ failure: { ...failure } }, true);
