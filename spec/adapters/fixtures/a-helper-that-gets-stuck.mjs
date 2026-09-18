#!/usr/bin/env node
// A helper that writes down each start and each request it gets, answers most at once, takes its
// time over some, and gets stuck on others: once stuck it answers nothing more, as a real helper
// serving one request at a time would. A scenario names the slow and the stuck in its environment:
// A_HELPER_THAT_GETS_STUCK_ON="request,request" and A_HELPER_THAT_GETS_STUCK_SLOW="request:ms".
import { appendFileSync } from "node:fs";
import process from "node:process";
import { createInterface } from "node:readline";
import { setTimeout } from "node:timers";

const log = process.env.A_HELPER_THAT_GETS_STUCK_LOG ?? "";
const stuckOn = (process.env.A_HELPER_THAT_GETS_STUCK_ON ?? "").split(",");
const slow = new Map(
  (process.env.A_HELPER_THAT_GETS_STUCK_SLOW ?? "")
    .split(",")
    .filter((entry) => entry !== "")
    .map((entry) => {
      const [request = "", milliseconds = "0"] = entry.split(":");
      return [request, Number(milliseconds)];
    }),
);

appendFileSync(log, "started\n");
let stuck = false;
let busy = false;
/** @type {string[]} */
const waiting = [];

// One request at a time, as the real helper answers them: a slow one holds up the rest.
const takeNext = () => {
  if (busy || stuck) return;
  const line = waiting.shift();
  if (line === undefined) return;

  const id = /"id":"(?<id>[^"]*)"/u.exec(line)?.groups?.id ?? null;
  const request = /"request":"(?<request>[^"]*)"/u.exec(line)?.groups?.request ?? "";
  appendFileSync(log, `${request}\n`);
  if (stuckOn.includes(request)) {
    stuck = true;
    return;
  }

  busy = true;
  setTimeout(() => {
    const response = { id, protocolVersion: 1, result: { state: "granted" } };
    process.stdout.write(`${JSON.stringify(response)}\n`);
    busy = false;
    takeNext();
  }, slow.get(request) ?? 0);
};

createInterface({ input: process.stdin }).on("line", (line) => {
  waiting.push(line);
  takeNext();
});
