import { JSDOM } from "jsdom";

export type SummaryResult = {
  heading: string;
  summary: string;
  bullets: string[];
  language?: string;
};

type SummaryInput = {
  title: string;
  html: string;
};

function extractTextFromHtml(html: string): string {
  const dom = new JSDOM(html);
  return dom.window.document.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}

function extractJsonBlock(content: string): string | null {
  const start = content.indexOf("{");
  const end = content.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    return null;
  }
  return content.slice(start, end + 1);
}

function normalizeSummary(result: SummaryResult): SummaryResult {
  const heading = result.heading?.trim() || "Summary";
  const summary = result.summary?.trim() || "";
  const bullets = Array.isArray(result.bullets) ? result.bullets.filter(Boolean) : [];
  const trimmed = bullets
    .map((item) => item.trim().replace(/^[-*\\u2022\\d+\\.\\s]+/, ""))
    .filter(Boolean)
    .slice(0, 3);
  while (trimmed.length < 3) {
    trimmed.push("Key point missing.");
  }

  return {
    heading,
    summary,
    bullets: trimmed,
    language: result.language?.trim(),
  };
}

export async function summarizeContent(input: SummaryInput): Promise<SummaryResult | null> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return null;
  }

  const text = extractTextFromHtml(input.html);
  if (!text) {
    return null;
  }

  const promptText = text.slice(0, 12000);

  const payload = {
    model: "xiaomi/mimo-v2-flash:free",
    temperature: 0.2,
    max_tokens: 500,
    messages: [
      {
        role: "system",
        content:
          "You summarize articles for Kindle. Use the same language as the input. " +
          "Be specific and factual. Return ONLY valid JSON.",
      },
      {
        role: "user",
        content:
          "Summarize the following content. Output JSON with keys: " +
          "heading (localized title for the summary section), " +
          "summary (2-3 sentences), bullets (array of exactly 3 bullet points), " +
          "language (name of the language).\n\n" +
          `Title: ${input.title}\n` +
          `Content: ${promptText}`,
      },
    ],
  };

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };

  if (process.env.OPENROUTER_SITE_URL) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }

  if (process.env.OPENROUTER_APP_NAME) {
    headers["X-Title"] = process.env.OPENROUTER_APP_NAME;
  }

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers,
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Summary request failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    return null;
  }

  const jsonBlock = extractJsonBlock(content);
  if (!jsonBlock) {
    return null;
  }

  const parsed = JSON.parse(jsonBlock) as SummaryResult;
  return normalizeSummary(parsed);
}
