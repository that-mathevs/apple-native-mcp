#!/usr/bin/env node
// A helper that refuses every request with the failure code a scenario puts in its environment,
// spelt the way the protocol spells one: words parted by underscores.
import process from "node:process";
import { createInterface } from "node:readline";

createInterface({ input: process.stdin }).on("line", (line) => {
  const id = /"id":"(?<id>[^"]*)"/u.exec(line)?.groups?.id ?? null;
  const code = process.env.A_HELPER_THAT_REFUSES_CODE ?? "request_malformed";
  const failure = { code, sentence: "The helper refused the request.", evidence: "" };
  process.stdout.write(`${JSON.stringify({ id, protocolVersion: 1, failure })}\n`);
});
