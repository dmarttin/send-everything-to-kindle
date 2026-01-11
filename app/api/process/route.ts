import { NextResponse } from "next/server";
import { extractContent } from "@/lib/extract";
import { generateEpub } from "@/lib/epub";
import { sendToKindle } from "@/lib/mailer";
import { validateKindleEmail, validateUrl } from "@/lib/validators";

export const runtime = "nodejs";

type RequestBody = {
  url?: string;
  kindleEmail?: string;
};

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

  const kindleEmail = typeof body?.kindleEmail === "string" ? body.kindleEmail.trim() : "";
  const kindleError = validateKindleEmail(kindleEmail);
  if (kindleError) {
    return NextResponse.json({ ok: false, message: kindleError }, { status: 400 });
  }

  try {
    const normalized = await extractContent(url);
    const { buffer, filename } = await generateEpub(normalized);
    const defaultEmail = process.env.DEFAULT_KINDLE_EMAIL ?? "";
    const defaultEmailError = defaultEmail ? validateKindleEmail(defaultEmail) : null;
    const resolvedEmail = kindleEmail || (!defaultEmailError ? defaultEmail : "");
    const sendResult = await sendToKindle({
      to: resolvedEmail || null,
      filename,
      buffer,
      title: normalized.title,
      sourceUrl: normalized.sourceUrl,
    });

    return NextResponse.json({
      ok: true,
      message: sendResult.sent ? "Sent to Kindle." : "EPUB ready to download.",
      jobId: crypto.randomUUID(),
      title: normalized.title,
      author: normalized.author,
      sourceUrl: normalized.sourceUrl,
      sent: sendResult.sent,
      sendMessage: sendResult.message,
      filename,
      epubBase64: buffer.toString("base64"),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Processing failed.";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
