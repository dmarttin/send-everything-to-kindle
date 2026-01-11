"use client";

import { useEffect, useRef, useState } from "react";

type ApiResponse = {
  ok: boolean;
  message: string;
  jobId?: string;
  title?: string;
  author?: string | null;
  sourceUrl?: string;
  sent?: boolean;
  sendMessage?: string;
  filename?: string;
  epubBase64?: string;
};

type HistoryItem = {
  id: string;
  title: string;
  url: string;
  createdAt: string;
  status: "sent" | "ready" | "error";
  message?: string;
};

const historyKey = "send-to-kindle-history";
const kindleEmailKey = "send-to-kindle-email";

function loadHistory(): HistoryItem[] {
  if (typeof window === "undefined") {
    return [];
  }
  try {
    const raw = window.localStorage.getItem(historyKey);
    return raw ? (JSON.parse(raw) as HistoryItem[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(items: HistoryItem[]) {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(historyKey, JSON.stringify(items));
}

function loadKindleEmail(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.localStorage.getItem(kindleEmailKey) ?? "";
}

function saveKindleEmail(value: string) {
  if (typeof window === "undefined") {
    return;
  }
  if (value.trim()) {
    window.localStorage.setItem(kindleEmailKey, value.trim());
  } else {
    window.localStorage.removeItem(kindleEmailKey);
  }
}

function base64ToBlob(base64: string, mimeType: string) {
  const binary = atob(base64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

const formatter = new Intl.DateTimeFormat("en", {
  dateStyle: "medium",
  timeStyle: "short",
});

export default function SendForm() {
  const [url, setUrl] = useState("");
  const [kindleEmail, setKindleEmail] = useState("");
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeTone, setNoticeTone] = useState<"success" | "error" | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [downloadName, setDownloadName] = useState("kindle-export.epub");
  const [isPending, setIsPending] = useState(false);
  const downloadRef = useRef<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
    setKindleEmail(loadKindleEmail());
  }, []);

  useEffect(() => {
    saveHistory(history);
  }, [history]);

  useEffect(() => {
    saveKindleEmail(kindleEmail);
  }, [kindleEmail]);

  useEffect(() => {
    if (downloadRef.current && downloadRef.current !== downloadUrl) {
      URL.revokeObjectURL(downloadRef.current);
    }
    downloadRef.current = downloadUrl;

    return () => {
      if (downloadRef.current) {
        URL.revokeObjectURL(downloadRef.current);
      }
    };
  }, [downloadUrl]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsPending(true);
    setNotice(null);
    setNoticeTone(null);

    try {
      const response = await fetch("/api/process", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url, kindleEmail }),
      });

      const data = (await response.json()) as ApiResponse;

      if (!response.ok || !data.ok) {
        setNotice(data.message || "Unable to process the URL.");
        setNoticeTone("error");
        return;
      }

      if (data.epubBase64) {
        const blob = base64ToBlob(data.epubBase64, "application/epub+zip");
        setDownloadUrl(URL.createObjectURL(blob));
        setDownloadName(data.filename ?? "kindle-export.epub");
      }

      setNotice(data.message);
      setNoticeTone("success");
      setUrl("");

      const newItem: HistoryItem = {
        id: data.jobId ?? crypto.randomUUID(),
        title: data.title ?? data.sourceUrl ?? url,
        url: data.sourceUrl ?? url,
        createdAt: new Date().toISOString(),
        status: data.sent ? "sent" : "ready",
        message: data.sendMessage,
      };

      setHistory((prev) => [newItem, ...prev].slice(0, 10));
    } catch (error) {
      setNotice("Processing failed. Try again.");
      setNoticeTone("error");
      setHistory((prev) => [
        {
          id: crypto.randomUUID(),
          title: url,
          url,
          createdAt: new Date().toISOString(),
          status: "error",
          message: error instanceof Error ? error.message : "Request failed.",
        },
        ...prev,
      ]);
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="form-stack">
      <div className="panel">
        <h1>Send a URL</h1>
        <p className="muted">
          Paste a link and we will extract, clean, and package it into a Kindle-ready EPUB.
        </p>
        <form className="form" onSubmit={handleSubmit}>
          <div className="form-row">
            <label className="label" htmlFor="url">
              URL to send
            </label>
            <input
              className="input"
              id="url"
              name="url"
              type="url"
              placeholder="https://example.com/article"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              required
            />
          </div>
          <div className="form-row">
            <label className="label" htmlFor="kindleEmail">
              Kindle email (optional)
            </label>
            <input
              className="input"
              id="kindleEmail"
              name="kindleEmail"
              type="email"
              placeholder="yourname@kindle.com"
              value={kindleEmail}
              onChange={(event) => setKindleEmail(event.target.value)}
            />
            <p className="muted">We only send to kindle.com or free.kindle.com addresses.</p>
          </div>
          {notice ? (
            <div className={`notice ${noticeTone === "error" ? "error" : "success"}`}>
              {notice}
            </div>
          ) : null}
          <div className="hero-actions">
            <button className="button primary" type="submit" disabled={isPending}>
              {isPending ? "Processing..." : "Send to Kindle"}
            </button>
            {downloadUrl ? (
              <a className="button ghost" href={downloadUrl} download={downloadName}>
                Download EPUB
              </a>
            ) : null}
          </div>
          <p className="muted">
            If SMTP is not configured, use the download button to send manually.
          </p>
        </form>
      </div>

      <section className="section">
        <h2 className="section-title">Recent sends</h2>
        {history.length ? (
          <div className="list">
            {history.map((item) => (
              <div className="list-item" key={item.id}>
                <strong>{item.title}</strong>
                <small>{item.url}</small>
                <div className={`status ${item.status}`}>
                  {item.status === "sent"
                    ? "Sent"
                    : item.status === "ready"
                      ? "Ready"
                      : "Error"}
                </div>
                <small>{formatter.format(new Date(item.createdAt))}</small>
              </div>
            ))}
          </div>
        ) : (
          <p className="muted">No URLs processed yet.</p>
        )}
      </section>
    </div>
  );
}
