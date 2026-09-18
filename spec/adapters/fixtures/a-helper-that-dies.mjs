#!/usr/bin/env node
// A helper that takes each request, writes down that it got it, and dies without answering: what
// a crash between doing the work and saying so looks like from the server's side.
import { appendFileSync } from "node:fs";
import process from "node:process";
import { createInterface } from "node:readline";

createInterface({ input: process.stdin }).on("line", (line) => {
  appendFileSync(process.env.A_HELPER_THAT_DIES_LOG, `${line}\n`);
  process.exit(1);
});
