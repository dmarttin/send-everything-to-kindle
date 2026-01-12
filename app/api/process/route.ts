import { NextResponse } from "next/server";
import { canonicalizeUrl } from "@/lib/url";
import { buildCachedEpub, getOrBuildEpub } from "@/lib/cache";
import { extractContent } from "@/lib/extract";
import { generateEpub } from "@/lib/epub";
import { sendToKindle } from "@/lib/mailer";
import { summarizeContent } from "@/lib/summary";
import { validateKindleEmail, validateUrl } from "@/lib/validators";

export const runtime = "nodejs";

type RequestBody = {
  url?: string;
  kindleEmail?: string;
};

function logEvent(event: string, data: Record<string, unknown>) {
  console.log(JSON.stringify({ event, ...data, ts: new Date().toISOString() }));
}

export async function POST(req: Request) {
  let body: RequestBody | null = null;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body." }, { status: 400 });
  }

  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const urlError = validateUrl(url);
  if (urlError) {
    return NextResponse.json({ ok: false, message: urlError }, { status: 400 });
  }

  const canonicalUrl = canonicalizeUrl(url);
  const kindleEmail = typeof body?.kindleEmail === "string" ? body.kindleEmail.trim() : "";
  const kindleError = validateKindleEmail(kindleEmail);
  if (kindleError) {
    return NextResponse.json({ ok: false, message: kindleError }, { status: 400 });
  }

  try {
    const jobId = crypto.randomUUID();
    const startedAt = Date.now();
    logEvent("job_start", { jobId, url: canonicalUrl });

    const cached = await getOrBuildEpub(canonicalUrl, async () => {
      const extractStart = Date.now();
      const normalized = await extractContent(canonicalUrl);
      logEvent("extract_done", { jobId, ms: Date.now() - extractStart });

      let summary = null;
      const summaryStart = Date.now();
      try {
        summary = await summarizeContent({ title: normalized.title, html: normalized.contentHtml });
      } catch (error) {
        logEvent("summary_error", { jobId, message: error instanceof Error ? error.message : error });
      }
      logEvent("summary_done", { jobId, ms: Date.now() - summaryStart, used: Boolean(summary) });

      const epubStart = Date.now();
      const { buffer, filename } = await generateEpub(normalized, summary);
      logEvent("epub_done", { jobId, ms: Date.now() - epubStart });

      return buildCachedEpub({
        key: canonicalUrl,
        normalized,
        summary,
        filename,
        buffer,
      });
    });

    const { buffer, filename } = cached;
    const defaultEmail = process.env.DEFAULT_KINDLE_EMAIL ?? "";
    const defaultEmailError = defaultEmail ? validateKindleEmail(defaultEmail) : null;
    const resolvedEmail = kindleEmail || (!defaultEmailError ? defaultEmail : "");
    const sendStart = Date.now();
    const sendResult = await sendToKindle({
      to: resolvedEmail || null,
      filename,
      buffer,
      title: cached.normalized.title,
      sourceUrl: cached.normalized.sourceUrl,
    });
    logEvent("send_done", { jobId, ms: Date.now() - sendStart, sent: sendResult.sent });
    logEvent("job_done", { jobId, ms: Date.now() - startedAt });

    return NextResponse.json({
      ok: true,
      message: sendResult.sent ? "Sent to Kindle." : "EPUB ready to download.",
      jobId,
      title: cached.normalized.title,
      author: cached.normalized.author,
      sourceUrl: cached.normalized.sourceUrl,
      sent: sendResult.sent,
      sendMessage: sendResult.message,
      filename,
      epubBase64: buffer.toString("base64"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed.";
    logEvent("job_error", { message });
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
