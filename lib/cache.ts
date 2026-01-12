import type { NormalizedContent } from "@/lib/extract";
import type { SummaryResult } from "@/lib/summary";

export type CachedEpub = {
  key: string;
  normalized: NormalizedContent;
  summary: SummaryResult | null;
  filename: string;
  buffer: Buffer;
  createdAt: number;
  expiresAt: number;
};

type InFlight = {
  promise: Promise<CachedEpub>;
  expiresAt: number;
};

const cache = new Map<string, CachedEpub>();
const inflight = new Map<string, InFlight>();

const ttlMs = 1000 * 60 * 60;

function isFresh(expiresAt: number) {
  return Date.now() < expiresAt;
}

export async function getOrBuildEpub(
  key: string,
  builder: () => Promise<CachedEpub>,
): Promise<CachedEpub> {
  const existing = cache.get(key);
  if (existing && isFresh(existing.expiresAt)) {
    return existing;
  }

  const inflightEntry = inflight.get(key);
  if (inflightEntry && isFresh(inflightEntry.expiresAt)) {
    return inflightEntry.promise;
  }

  const promise = builder()
    .then((result) => {
      cache.set(key, result);
      inflight.delete(key);
      return result;
    })
    .catch((error) => {
      inflight.delete(key);
      throw error;
    });

  inflight.set(key, { promise, expiresAt: Date.now() + ttlMs });
  return promise;
}

export function buildCachedEpub(
  data: Omit<CachedEpub, "createdAt" | "expiresAt">,
): CachedEpub {
  const now = Date.now();
  return {
    ...data,
    createdAt: now,
    expiresAt: now + ttlMs,
  };
}
