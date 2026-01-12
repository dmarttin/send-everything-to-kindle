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

function isSubstackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname.endsWith("substack.com");
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

function readMetaContent(document: Document, name: string, attr: "name" | "property" = "name") {
  return document.querySelector(`meta[${attr}=\"${name}\"]`)?.getAttribute("content") ?? "";
}

function normalizeSubstackImages(container: HTMLElement) {
  const images = container.querySelectorAll("img");
  images.forEach((img) => {
    const dataSrc = img.getAttribute("data-src");
    if (!img.getAttribute("src") && dataSrc) {
      img.setAttribute("src", dataSrc);
    }
  });
}

function extractSubstackFromDom(dom: JSDOM, sourceUrl: string): NormalizedContent | null {
  const document = dom.window.document;
  const contentEl =
    document.querySelector("div.body.markup") ||
    document.querySelector("div.available-content") ||
    document.querySelector("article");

  if (!contentEl) {
    return null;
  }

  const cloned = contentEl.cloneNode(true) as HTMLElement;
  cloned.querySelectorAll("[class*=\"subscribe\"], [class*=\"cta\"], [class*=\"subscription\"]").forEach((el) => {
    el.remove();
  });
  normalizeSubstackImages(cloned);

  const title =
    document.querySelector("h1.post-title")?.textContent?.trim() ||
    readMetaContent(document, "og:title", "property") ||
    document.title ||
    new URL(sourceUrl).hostname;

  const author =
    readMetaContent(document, "author") ||
    document.querySelector("span.author-name")?.textContent?.trim() ||
    null;

  const cleaned = sanitizeContent(cloned.innerHTML, sourceUrl);

  return {
    title,
    author,
    sourceUrl,
    contentHtml: cleaned,
  };
}

async function extractTwitterContent(
  sourceUrl: string,
  documentTitle: string,
): Promise<NormalizedContent> {
  const text = await fetchJinaText(sourceUrl).catch(() => "");
  const cleaned = wrapPlainText(text);
  const title = documentTitle || "Thread from X";

  return {
    title,
    author: null,
    sourceUrl,
    contentHtml: cleaned,
  };
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
  const isSubstack = isSubstackUrl(sourceUrl) || html.includes("substackcdn.com");

  if (isSubstack) {
    const substack = extractSubstackFromDom(dom, sourceUrl);
    if (substack) {
      return substack;
    }
  }

  if (isThreadUrl(sourceUrl)) {
    return extractTwitterContent(sourceUrl, documentTitle);
  }

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
