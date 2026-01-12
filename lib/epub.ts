import fs from "fs/promises";
import os from "os";
import path from "path";
import Epub from "epub-gen";
import { escapeHtml, slugify } from "@/lib/text";
import type { NormalizedContent } from "@/lib/extract";
import type { SummaryResult } from "@/lib/summary";

type EpubResult = {
  buffer: Buffer;
  filename: string;
};

function buildSummaryHtml(summary: SummaryResult): string {
  const heading = escapeHtml(summary.heading || "Summary");
  const bullets = summary.bullets
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("");

  return `<section class=\"summary\"><h2>${heading}</h2><p>${escapeHtml(
    summary.summary,
  )}</p><ul>${bullets}</ul></section>`;
}

function buildEpubHtml(content: NormalizedContent, summary: SummaryResult | null): string {
  const title = escapeHtml(content.title || "Untitled");
  const author = content.author ? `<p><strong>${escapeHtml(content.author)}</strong></p>` : "";
  const sourceUrl = escapeHtml(content.sourceUrl);
  const source = `<p>Source: <a href="${sourceUrl}">${sourceUrl}</a></p>`;
  const summaryHtml = summary ? buildSummaryHtml(summary) : "";

  return `<article><h1>${title}</h1>${author}${source}${summaryHtml}${content.contentHtml}</article>`;
}

const baseCss = `
  body { font-family: "Georgia", serif; line-height: 1.65; padding: 0 8%; }
  h1 { font-size: 1.9em; margin: 0 0 0.4em; }
  h2 { font-size: 1.3em; margin: 1.2em 0 0.4em; }
  p { margin: 0 0 0.9em; }
  ul { margin: 0.6em 0 1em 1.1em; }
  li { margin-bottom: 0.4em; }
  img { max-width: 100%; height: auto; }
  a { color: #b94a1f; text-decoration: underline; }
  blockquote { margin: 1em 1.2em; padding-left: 1em; border-left: 3px solid #ddd; }
  .summary { border: 1px solid #e6ddcf; background: #faf4ea; padding: 1em; border-radius: 8px; }
`;

export async function generateEpub(
  content: NormalizedContent,
  summary: SummaryResult | null,
): Promise<EpubResult> {
  const title = content.title || "Kindle Export";
  const safeTitle = slugify(title);
  const filename = `${safeTitle}.epub`;
  const tempDir = path.join(os.tmpdir(), "send-to-kindle-epub");
  await fs.mkdir(tempDir, { recursive: true });
  const outputPath = path.join(tempDir, `${safeTitle}-${Date.now()}.epub`);
  const templateRoot = path.join(process.cwd(), "lib", "epub-templates");
  const opfTemplatePath = path.join(templateRoot, "epub2", "content.opf.ejs");
  const ncxTemplatePath = path.join(templateRoot, "toc.ncx.ejs");
  const htmlTocTemplatePath = path.join(templateRoot, "epub2", "toc.xhtml.ejs");

  const epub = new Epub(
    {
      title,
      author: content.author ?? "Unknown",
      publisher: "Send to Kindle",
      lang: "en",
      css: baseCss,
      tempDir,
      version: 2,
      customOpfTemplatePath: opfTemplatePath,
      customNcxTocTemplatePath: ncxTemplatePath,
      customHtmlTocTemplatePath: htmlTocTemplatePath,
      content: [
        {
          title,
          data: buildEpubHtml(content, summary),
        },
      ],
    },
    outputPath,
  );

  await epub.promise;
  const buffer = await fs.readFile(outputPath);
  await fs.unlink(outputPath).catch(() => undefined);

  return { buffer, filename };
}
