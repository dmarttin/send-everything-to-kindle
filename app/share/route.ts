import { NextResponse } from "next/server";
import { validateUrl } from "@/lib/validators";

function extractUrl(value: string): string | null {
  const match = value.match(/https?:\/\/[^\s]+/i);
  if (!match) {
    return null;
  }
  return match[0];
}

function normalizeCandidate(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function resolveSharedUrl(formData: FormData): string | null {
  const directUrl = normalizeCandidate(formData.get("url"));
  if (directUrl && !validateUrl(directUrl)) {
    return directUrl;
  }

  const text = normalizeCandidate(formData.get("text"));
  if (text) {
    const extracted = extractUrl(text);
    if (extracted && !validateUrl(extracted)) {
      return extracted;
    }
  }

  const title = normalizeCandidate(formData.get("title"));
  if (title) {
    const extracted = extractUrl(title);
    if (extracted && !validateUrl(extracted)) {
      return extracted;
    }
  }

  return null;
}

export async function POST(req: Request) {
  const formData = await req.formData();
  const sharedUrl = resolveSharedUrl(formData);
  const redirectUrl = new URL("/send", req.url);

  if (sharedUrl) {
    redirectUrl.searchParams.set("url", sharedUrl);
  }
  redirectUrl.searchParams.set("auto", "1");

  return NextResponse.redirect(redirectUrl, 303);
}

export async function GET(req: Request) {
  const redirectUrl = new URL("/send", req.url);
  const params = new URL(req.url).searchParams;
  const directUrl = params.get("url");
  const text = params.get("text");
  const candidate = directUrl || (text ? extractUrl(text) : null);

  if (candidate && !validateUrl(candidate)) {
    redirectUrl.searchParams.set("url", candidate);
  }

  if (params.get("auto") === "1") {
    redirectUrl.searchParams.set("auto", "1");
  }
  return NextResponse.redirect(redirectUrl);
}
