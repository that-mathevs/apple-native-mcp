import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";

import type { WriteCapability } from "../domain/settings.js";
import { refusing, type ToolResult } from "./result.js";

type JsonSchema = { type: "object"; [key: string]: unknown };

/** One operation the server can offer, as a client sees it and as the server calls it. */
export type Tool = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly inputSchema: JsonSchema;
  readonly outputSchema: JsonSchema;
  readonly annotations: ToolAnnotations;
  /**
   * The write capability that switches this tool on, which a tool that only reads has none of.
   * It has to be written either way, so that forgetting it is an error and not a tool left on.
   */
  readonly capability: WriteCapability | undefined;
  readonly call: (args: unknown) => Promise<ToolResult>;
};

type ToolDefinition<Input extends z.ZodRawShape> = {
  readonly name: string;
  readonly title: string;
  readonly description: string;
  readonly input: Input;
  readonly output: z.ZodRawShape;
  readonly annotations: ToolAnnotations;
  readonly capability: WriteCapability | undefined;
  readonly call: (request: z.infer<z.ZodObject<Input>>) => Promise<ToolResult>;
};

const asJsonSchema = (shape: z.ZodRawShape, io: "input" | "output"): JsonSchema =>
  z.toJSONSchema(z.object(shape), { io }) as JsonSchema;

/** A tool from its schemas, so what it accepts is written once and is what it is called with. */
export const tool = <Input extends z.ZodRawShape>(definition: ToolDefinition<Input>): Tool => {
  const input = z.object(definition.input);
  const output = z.object(definition.output);

  return {
    name: definition.name,
    title: definition.title,
    description: definition.description,
    inputSchema: asJsonSchema(definition.input, "input"),
    outputSchema: asJsonSchema(definition.output, "output"),
    annotations: definition.annotations,
    capability: definition.capability,
    call: async (args) => {
      const read = input.safeParse(args);

      if (!read.success) {
        return refusing({
          code: "arguments-invalid",
          sentence: `Nothing was done: the arguments to ${definition.name} are not valid.`,
          evidence: z.prettifyError(read.error),
        });
      }

      const result = await definition.call(read.data);
      const record = output.safeParse(result.structuredContent);

      if (result.isError !== true && !record.success) {
        return refusing({
          code: "result-invalid",
          sentence: `${definition.name} answered with a record that does not match its schema.`,
          evidence: z.prettifyError(record.error),
        });
      }

      return result;
    },
  };
};
