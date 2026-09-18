#!/usr/bin/env node
// A helper that answers every request with the result a scenario put in its environment, so the
// adapter's reading of an answer can be specified without the real helper or a real prompt.
import process from "node:process";
import { createInterface } from "node:readline";

createInterface({ input: process.stdin }).on("line", (line) => {
  const id = /"id":"(?<id>[^"]*)"/u.exec(line)?.groups?.id ?? null;
  const result = process.env.A_HELPER_THAT_ANSWERS_RESULT ?? "{}";
  process.stdout.write(`{"id":${JSON.stringify(id)},"protocolVersion":1,"result":${result}}\n`);
});
