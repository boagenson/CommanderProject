/**
 * Low-level Scryfall HTTP client.
 *
 * Scryfall asks for 50–100ms between requests (≈10/s) and returns 429 when
 * clients go faster. Every request goes through a single serial queue with a
 * minimum spacing, identical in-flight GETs are de-duplicated, and successful
 * GET responses are memoized for the session.
 * https://scryfall.com/docs/api
 */
import type { ScryfallError } from "./types";

export const SCRYFALL_API = "https://api.scryfall.com";
const MIN_SPACING_MS = 100;
const MAX_RETRIES = 3;
const RESPONSE_TTL_MS = 30 * 60 * 1000;

export class ScryfallApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    details: string,
  ) {
    super(details);
    this.name = "ScryfallApiError";
  }
}

export class ScryfallNetworkError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ScryfallNetworkError";
  }
}

type Task = () => Promise<void>;
const queue: Task[] = [];
let running = false;
let lastRequestAt = 0;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function drain() {
  if (running) return;
  running = true;
  while (queue.length) {
    const task = queue.shift()!;
    const wait = lastRequestAt + MIN_SPACING_MS - Date.now();
    if (wait > 0) await sleep(wait);
    lastRequestAt = Date.now();
    await task();
  }
  running = false;
}

function schedule<T>(fn: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    queue.push(() => fn().then(resolve, reject));
    void drain();
  });
}

const responseCache = new Map<string, { at: number; value: Promise<unknown> }>();

interface RequestOptions {
  method?: "GET" | "POST";
  body?: unknown;
  signal?: AbortSignal;
  /** Skip the in-memory response cache. */
  noCache?: boolean;
}

async function rawRequest<T>(url: string, opts: RequestOptions): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response;
    try {
      res = await schedule(() =>
        fetch(url, {
          method: opts.method ?? "GET",
          headers: {
            Accept: "application/json",
            ...(opts.body ? { "Content-Type": "application/json" } : {}),
          },
          body: opts.body ? JSON.stringify(opts.body) : undefined,
          signal: opts.signal,
        }),
      );
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      if (attempt < MAX_RETRIES) {
        await sleep(400 * 2 ** attempt);
        continue;
      }
      throw new ScryfallNetworkError(
        "Couldn't reach Scryfall. Check your connection and try again.",
      );
    }

    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers.get("Retry-After"));
        await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 500 * 2 ** attempt);
        continue;
      }
    }

    const json = (await res.json().catch(() => null)) as T | ScryfallError | null;
    if (!res.ok || !json || (json as ScryfallError).object === "error") {
      const err = json as ScryfallError | null;
      throw new ScryfallApiError(
        err?.status ?? res.status,
        err?.code ?? "unknown",
        err?.details ?? `Scryfall request failed (${res.status}).`,
      );
    }
    return json as T;
  }
}

/** Perform a Scryfall request. GETs are cached and de-duplicated. */
export function scryfallRequest<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const url = path.startsWith("http") ? path : `${SCRYFALL_API}${path}`;
  const cacheable = (opts.method ?? "GET") === "GET" && !opts.noCache && !opts.signal;
  if (cacheable) {
    const hit = responseCache.get(url);
    if (hit && Date.now() - hit.at < RESPONSE_TTL_MS) return hit.value as Promise<T>;
  }
  const promise = rawRequest<T>(url, opts);
  if (cacheable) {
    responseCache.set(url, { at: Date.now(), value: promise });
    promise.catch(() => responseCache.delete(url));
  }
  return promise;
}

export function clearResponseCache() {
  responseCache.clear();
}

/** Human-friendly message for any error thrown by the Scryfall layer. */
export function describeScryfallError(err: unknown): string {
  if (err instanceof ScryfallNetworkError) return err.message;
  if (err instanceof ScryfallApiError) {
    if (err.status === 404) return err.message || "No matching cards found.";
    if (err.status === 422 || err.status === 400) return `Scryfall couldn't understand that query: ${err.message}`;
    if (err.status === 429) return "Scryfall is rate limiting requests. Wait a moment and try again.";
    return `Scryfall error: ${err.message}`;
  }
  if (err instanceof Error && err.name === "AbortError") return "Request cancelled.";
  return "Something went wrong talking to Scryfall.";
}
