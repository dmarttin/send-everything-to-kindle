import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";
import sanitizeHtml from "sanitize-html";
import { escapeHtml } from "@/lib/text";

export type NormalizedContent = {
  title: string;
  author?: string | null;
  sourceUrl: string;
  contentHtml: string;
};

const allowedTags = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "pre",
  "code",
  "strong",
  "em",
  "b",
  "i",
  "a",
  "img",
  "figure",
  "figcaption",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

const allowedAttributes: sanitizeHtml.IOptions["allowedAttributes"] = {
  a: ["href", "rel", "target"],
  img: ["src", "alt", "title"],
};

const allowedSchemes = ["http", "https"];

function absolutizeUrl(value: string | undefined, baseUrl: string): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return undefined;
  }
}

function sanitizeContent(html: string, baseUrl: string): string {
  return sanitizeHtml(html, {
    allowedTags,
    allowedAttributes,
    allowedSchemes,
    transformTags: {
      a: (tagName, attribs) => {
        const href = absolutizeUrl(attribs.href, baseUrl);
        return {
          tagName,
          attribs: {
            href: href ?? "",
            rel: "noopener noreferrer",
            target: "_blank",
          },
        };
      },
      img: (tagName, attribs) => {
        const src = absolutizeUrl(attribs.src, baseUrl);
        return {
          tagName,
          attribs: {
            src: src ?? "",
            alt: attribs.alt ?? "",
          },
        };
      },
    },
  });
}

function isThreadUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ["twitter.com", "x.com"].includes(parsed.hostname);
  } catch {
    return false;
  }
}

async function fetchWithTimeout(url: string, timeoutMs = 15000): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Send to Kindle) AppleWebKit/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJinaText(url: string): Promise<string> {
  const parsed = new URL(url);
  const prefix = parsed.protocol === "https:" ? "https://r.jina.ai/https://" : "https://r.jina.ai/http://";
  const proxied = `${prefix}${parsed.host}${parsed.pathname}${parsed.search}`;
  return fetchWithTimeout(proxied, 15000);
}

function wrapPlainText(text: string): string {
  const trimmed = text.trim();
  if (!trimmed) {
    return "<p>Unable to extract content.</p>";
  }

  const chunks = trimmed.split(/\n{2,}/g);
  const paragraphs = chunks
    .map((chunk) => chunk.replace(/\n/g, " ").trim())
    .filter(Boolean)
    .map((chunk) => `<p>${escapeHtml(chunk)}</p>`)
    .join("");

  return paragraphs || "<p>Unable to extract content.</p>";
}

export async function extractContent(sourceUrl: string): Promise<NormalizedContent> {
  let html = "";
  try {
    html = await fetchWithTimeout(sourceUrl, 20000);
  } catch {
    const fallbackText = await fetchJinaText(sourceUrl).catch(() => "");
    return {
      title: new URL(sourceUrl).hostname,
      author: null,
      sourceUrl,
      contentHtml: wrapPlainText(fallbackText),
    };
  }

  const dom = new JSDOM(html, { url: sourceUrl });
  const documentTitle = dom.window.document.title || new URL(sourceUrl).hostname;
  const reader = new Readability(dom.window.document);
  const article = reader.parse();

  if (article?.content) {
    const cleaned = sanitizeContent(article.content, sourceUrl);
    return {
      title: article.title || documentTitle,
      author: article.byline ?? null,
      sourceUrl,
      contentHtml: cleaned,
    };
  }

  const plainText = isThreadUrl(sourceUrl)
    ? await fetchJinaText(sourceUrl).catch(() => dom.window.document.body?.textContent ?? "")
    : dom.window.document.body?.textContent ?? "";

  return {
    title: documentTitle || sourceUrl,
    author: null,
    sourceUrl,
    contentHtml: wrapPlainText(plainText),
  };
}
