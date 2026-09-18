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

/**
 * A request's time budget, from when it is sent: well past the two seconds the helper gives a read
 * of the reminders, and well short of the sixty a client waits for a tool at the least (#25).
 */
const defaultTimeBudget = 10_000;

/** How a request is asked. */
export type Asking = {
  /** A request that waits on a person, such as a permission prompt, has no time budget. */
  readonly waitsOnTheUser?: boolean;
};

const helperTimedOut = (request: HelperRequest, timeBudget: number): NamedFailure => ({
  code: "helper-timed-out",
  sentence:
    `The helper did not answer within ${String(timeBudget / 1000)} seconds, so it was stopped; ` +
    "the next request starts a fresh one.",
  evidence: request.request,
});

/** A request still waiting its turn when the helper stopped: it never reached the helper. */
const notAsked = (evidence: string): NamedFailure => ({
  code: "helper-not-asked",
  sentence: "The helper stopped before this request reached it, and a fresh one did not answer.",
  evidence,
});

/**
 * Whether a request went unanswered after it reached the helper, which then stopped or was
 * stopped. A write in that state may have happened, so it is reported as unconfirmed, never sent
 * again.
 */
export const wentUnanswered = (failure: NamedFailure): boolean =>
  failure.code === "helper-stopped" || failure.code === "helper-timed-out";

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

/** A request waiting its turn, or the one the helper is answering. */
type Asked = {
  readonly id: string;
  readonly request: HelperRequest;
  readonly timeBudget: number | undefined;
  readonly resolve: (outcome: Outcome<Record<string, unknown>>) => void;
};

/**
 * A helper that is running, and the requests it has been asked.
 *
 * The helper answers one request at a time, so they are sent to it one at a time: a request's
 * time budget then starts when the helper takes it up, and a read waiting behind a slow one, or
 * behind a prompt the user has yet to answer, cannot run out of time and stop a working helper.
 */
class Session {
  readonly #process: ChildProcessWithoutNullStreams;
  readonly #lines: Interface;
  readonly #waiting: Asked[] = [];

  #answering: { readonly asked: Asked; readonly timer: NodeJS.Timeout | undefined } | undefined;
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
    // A helper that exits between two requests closes the pipe under the next one. Unheard, that
    // write's EPIPE would take the whole server down with it (spec/adapters/helper-launch).
    this.#process.stdin.on("error", (error) => {
      this.#stop(error.message);
    });
  }

  get stopped(): string | undefined {
    return this.#stopped;
  }

  /** Ask, within the time budget when there is one. */
  ask(
    id: string,
    request: HelperRequest,
    timeBudget: number | undefined,
  ): Promise<Outcome<Record<string, unknown>>> {
    return new Promise((resolve) => {
      if (this.#stopped !== undefined) {
        resolve(failed(notAsked(this.#stopped)));
        return;
      }
      this.#waiting.push({ id, request, timeBudget, resolve });
      this.#sendNext();
    });
  }

  end(): void {
    this.#lines.close();
    this.#process.stdin.end();
    this.#process.kill();
  }

  #sendNext(): void {
    if (this.#answering !== undefined || this.#stopped !== undefined) return;
    const asked = this.#waiting.shift();
    if (asked === undefined) return;

    // Past its time budget the helper is taken to be stuck: it is stopped, and whatever waits
    // behind it goes to a fresh one.
    const timer =
      asked.timeBudget === undefined
        ? undefined
        : setTimeout(() => {
            if (this.#answering?.asked !== asked) return;
            this.#answering = undefined;
            asked.resolve(failed(helperTimedOut(asked.request, asked.timeBudget ?? 0)));
            this.#stop(`it did not answer ${asked.request.request} in time`);
            this.end();
          }, asked.timeBudget).unref();

    this.#answering = { asked, timer };
    const line = { protocolVersion: spokenProtocolVersion, id: asked.id, ...asked.request };
    this.#process.stdin.write(`${JSON.stringify(line)}\n`);
  }

  #answer(line: string): void {
    let response: Response;
    try {
      response = JSON.parse(line) as Response;
    } catch {
      return;
    }

    const answering = this.#answering;
    if (answering === undefined || response.id !== answering.asked.id) return;

    clearTimeout(answering.timer);
    this.#answering = undefined;

    const { resolve } = answering.asked;
    if (response.failure) resolve(failed(asFailure(response.failure)));
    else if (response.result) resolve(succeeded(response.result));
    else resolve(failed(unreadableAnswer(line)));

    this.#sendNext();
  }

  /**
   * The request the helper had in hand may have been done, so it is reported as stopped; the ones
   * waiting their turn never reached it, so they are reported as not asked, and asked afresh.
   */
  #stop(evidence: string): void {
    this.#stopped ??= evidence;

    const answering = this.#answering;
    this.#answering = undefined;
    if (answering !== undefined) {
      clearTimeout(answering.timer);
      answering.asked.resolve(failed(helperStopped(evidence)));
    }

    for (const asked of this.#waiting.splice(0)) asked.resolve(failed(notAsked(evidence)));
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
  readonly #timeBudget: number;
  #session: Promise<Outcome<Session>> | undefined;
  #nextId = 0;
  #stopping = false;

  /**
   * @param helperToLaunch asked before every start, restarts included, for the path to launch or
   * the failure saying why nothing may be launched (ADR-0003).
   * @param answersWithin each request's time budget in milliseconds, from when it is sent.
   */
  constructor(
    helperToLaunch: () => Promise<Outcome<string>>,
    { answersWithin = defaultTimeBudget }: { readonly answersWithin?: number } = {},
  ) {
    this.#helperToLaunch = helperToLaunch;
    this.#timeBudget = answersWithin;
  }

  /**
   * Ask for something that changes a store, which is asked exactly once. A helper that died
   * may have died after doing it, and sending it again would do it twice.
   */
  async askOnce(request: HelperRequest): Promise<Outcome<Record<string, unknown>>> {
    const first = await this.#askRunning(request);
    // One that never reached the helper was never done, so it is safe to ask afresh.
    if (first.ok || first.failure.code !== "helper-not-asked") return first;

    return await this.#askRunning(request);
  }

  /**
   * Ask for a read, which is asked again once if the helper stopped before answering it. One that
   * timed out is not: asked again, it would only time out again.
   */
  async ask(
    request: HelperRequest,
    asking: Asking = {},
  ): Promise<Outcome<Record<string, unknown>>> {
    const first = await this.#askRunning(request, asking);
    const askAgain =
      !first.ok && ["helper-stopped", "helper-not-asked"].includes(first.failure.code);
    if (!askAgain) return first;

    return await this.#askRunning(request, asking);
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

  async #askRunning(
    request: HelperRequest,
    { waitsOnTheUser = false }: Asking = {},
  ): Promise<Outcome<Record<string, unknown>>> {
    const session = await this.#running();
    if (!session.ok) return session;

    return await session.value.ask(
      this.#identifier(),
      request,
      waitsOnTheUser ? undefined : this.#timeBudget,
    );
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
