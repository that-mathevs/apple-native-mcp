import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createInterface, type Interface } from "node:readline";

import type { NamedFailure, Outcome } from "../../domain/failure.js";
import { failed, succeeded } from "../../domain/failure.js";

/**
 * The signed Swift helper, one of the two processes this server starts (ADR-0002, ADR-0008).
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

const serverStopping: NamedFailure = {
  code: "helper-stopped",
  sentence: "The server is stopping, so the helper was not started.",
};

const notStarted = (evidence: string): NamedFailure => ({
  code: "helper-not-started",
  sentence: "The helper was not started: checking which helper to launch broke.",
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
  readonly #helperToLaunch: () => Promise<Outcome<string>>;
  #session: Promise<Outcome<Session>> | undefined;
  #nextId = 0;
  #stopping = false;

  /**
   * @param helperToLaunch asked before every start, restarts included, for the path to launch or
   * the failure saying why nothing may be launched (ADR-0003).
   */
  constructor(helperToLaunch: () => Promise<Outcome<string>>) {
    this.#helperToLaunch = helperToLaunch;
  }

  /**
   * Ask for something that changes a store, which is asked exactly once. A helper that died
   * may have died after doing it, and sending it again would do it twice.
   */
  async askOnce(request: HelperRequest): Promise<Outcome<Record<string, unknown>>> {
    return await this.#running().ask(this.#identifier(), request);
  }

  /** Ask for a read, which is asked again once if the helper died before answering. */
  async ask(request: HelperRequest): Promise<Outcome<Record<string, unknown>>> {
    const first = await this.#askRunning(request);
    if (first.ok || first.failure.code !== "helper-stopped") return first;

    return await this.#askRunning(request);
  }

  /** End the helper, and start no other: a start already under way is ended when it lands. */
  stop(): void {
    this.#stopping = true;
    const session = this.#session;
    this.#session = undefined;
    void session?.then((started) => {
      if (started.ok) started.value.end();
    });
  }

  async #askRunning(request: HelperRequest): Promise<Outcome<Record<string, unknown>>> {
    const session = await this.#running();
    if (!session.ok) return session;

    return await session.value.ask(this.#identifier(), request);
  }

  #identifier(): string {
    this.#nextId += 1;
    return String(this.#nextId);
  }

  /** The running session, or one started now; calls arriving together share one start. */
  async #running(): Promise<Outcome<Session>> {
    if (this.#stopping) return failed(serverStopping);

    const current = this.#session;
    if (current !== undefined) {
      const session = await current;
      if (session.ok && session.value.stopped === undefined) return session;
      if (this.#session !== current) return await this.#running();
    }

    const starting = this.#start();
    this.#session = starting;
    return await starting;
  }

  /** Never rejects: a start that breaks is a failure, so the next call checks afresh. */
  async #start(): Promise<Outcome<Session>> {
    try {
      const path = await this.#helperToLaunch();
      return path.ok ? succeeded(new Session(path.value)) : path;
    } catch (error) {
      return failed(notStarted(String(error)));
    }
  }
}
