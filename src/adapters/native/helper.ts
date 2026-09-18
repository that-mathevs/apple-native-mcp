import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";

/**
 * The one process this server starts: the signed Swift helper (ADR-0002, ADR-0003).
 *
 * It is launched by path with an argument list, never through a shell, and it is spoken to in
 * JSON lines: one request per line, one response per line, matched by identifier. Everything it
 * says on stderr is diagnostic and never protocol.
 */
export const spokenProtocolVersion = 1;

export type HelperRequest = {
  readonly request: string;
  readonly [field: string]: unknown;
};

type Response = {
  readonly id?: unknown;
  readonly result?: Record<string, unknown>;
  readonly failure?: { code?: unknown; sentence?: unknown; setting?: unknown; evidence?: unknown };
};

const helperStopped = (evidence: string): NamedFailure => ({
  code: "helper-stopped",
  sentence: "The helper stopped before it answered, and starting it again did not help.",
  evidence,
});

const unreadableAnswer = (evidence: string): NamedFailure => ({
  code: "helper-answer-unreadable",
  sentence: "The helper answered with something this server could not read.",
  evidence,
});

/** A field the helper sends as text, or nothing: anything else is not text and is left out. */
const text = (value: unknown): string | undefined =>
  typeof value === "string" ? value : undefined;

const asFailure = (failure: NonNullable<Response["failure"]>): NamedFailure => {
  const setting = text(failure.setting);
  const evidence = text(failure.evidence);

  return {
    code: text(failure.code) ?? "helper-failure",
    sentence: text(failure.sentence) ?? "The helper refused the request.",
    ...(setting === undefined ? {} : { setting }),
    ...(evidence === undefined ? {} : { evidence }),
  };
};

type Pending = {
  readonly resolve: (outcome: Outcome<Record<string, unknown>>) => void;
};

/** A helper that is running, and the lines it has been asked to answer. */
class Session {
  readonly #process: ChildProcessWithoutNullStreams;
  readonly #lines: Interface;
  readonly #pending = new Map<string, Pending>();

  #stopped: string | undefined;

  constructor(path: string) {
    this.#process = spawn(path, [], { stdio: ["pipe", "pipe", "pipe"] });
    this.#lines = createInterface({ input: this.#process.stdout });

    this.#lines.on("line", (line) => {
      this.#answer(line);
    });
    this.#process.on("exit", (code, signal) => {
      this.#stop(`the helper exited with ${String(signal ?? code)}`);
    });
    this.#process.on("error", (error) => {
      this.#stop(error.message);
    });
  }

  get stopped(): string | undefined {
    return this.#stopped;
  }

  ask(id: string, request: HelperRequest): Promise<Outcome<Record<string, unknown>>> {
    return new Promise((resolve) => {
      this.#pending.set(id, { resolve });
      this.#process.stdin.write(
        `${JSON.stringify({ protocolVersion: spokenProtocolVersion, id, ...request })}\n`,
      );
    });
  }

  end(): void {
    this.#lines.close();
    this.#process.kill();
  }

  #answer(line: string): void {
    let response: Response;
    try {
      response = JSON.parse(line) as Response;
    } catch {
      return;
    }

    const id = typeof response.id === "string" ? response.id : undefined;
    const waiting = id === undefined ? undefined : this.#pending.get(id);
    if (!waiting || id === undefined) return;

    this.#pending.delete(id);

    if (response.failure) waiting.resolve(failed(asFailure(response.failure)));
    else if (response.result) waiting.resolve(succeeded(response.result));
    else waiting.resolve(failed(unreadableAnswer(line)));
  }

  #stop(evidence: string): void {
    this.#stopped = evidence;
    for (const [id, waiting] of this.#pending) {
      this.#pending.delete(id);
      waiting.resolve(failed(helperStopped(evidence)));
    }
  }
}

/**
 * The helper, kept alive between calls and started again once if it dies.
 *
 * A helper that dies twice is a named failure rather than a restart loop: whatever killed it is
 * not going to be fixed by starting it a third time.
 */
export class Helper {
  readonly #path: string;
  #session: Session | undefined;
  #nextId = 0;

  constructor(path: string) {
    this.#path = path;
  }

  async ask(request: HelperRequest): Promise<Outcome<Record<string, unknown>>> {
    const first = await this.#running().ask(this.#identifier(), request);
    if (first.ok || first.failure.code !== "helper-stopped") return first;

    this.#session = undefined;
    return await this.#running().ask(this.#identifier(), request);
  }

  stop(): void {
    this.#session?.end();
    this.#session = undefined;
  }

  #identifier(): string {
    this.#nextId += 1;
    return String(this.#nextId);
  }

  #running(): Session {
    const session = this.#session;
    if (session && session.stopped === undefined) return session;

    const started = new Session(this.#path);
    this.#session = started;
    return started;
  }
}
