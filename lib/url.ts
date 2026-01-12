const trackingParams = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "utm_id",
  "ref",
  "source",
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "r",
  "triedRedirect",
  "publication_id",
  "post_id",
  "isFreemail",
]);

export function canonicalizeUrl(rawUrl: string): string {
  const url = new URL(rawUrl);
  const keys = Array.from(url.searchParams.keys());
  for (const key of keys) {
    const lower = key.toLowerCase();
    if (lower.startsWith("utm_") || trackingParams.has(lower)) {
      url.searchParams.delete(key);
    }
  }
  url.hash = "";
  return url.toString();
}
