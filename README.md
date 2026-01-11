# PRD - Send to Kindle Web App (No-DB Edition)

## 1. Product Vision

A personal web app that lets anyone **send web content to their Kindle** by pasting a URL. The system extracts the content, cleans it, converts it into a **Kindle-optimized EPUB**, and either:

- Sends it to a Kindle email via SMTP (if configured), or
- Provides a direct EPUB download.

User flow:

1. User submits a URL (article, Twitter/X thread, etc.)
2. System extracts and cleans the content
3. Generates an EPUB
4. Sends via email or offers a download

In **v2**, the same flow must work from the **mobile Share Sheet** (Safari / Twitter/X) with no extra taps.

---

## 2. Goals

### Primary Goal

- Reduce the action of sending long-form content to Kindle to **a single step**.

### Secondary Goals

- Produce EPUBs that read better than Amazon's native webpage sending
- Keep the pipeline clean, modular, and easy to extend
- Stay serverless-friendly (Vercel-compatible)

---

## 3. Scope by Version

### v1 (MVP, no DB)

- Single-user, no login
- URL submission via web UI
- Optional Kindle email per send (stored locally in browser)
- Article & blog support
- EPUB generation
- Email delivery if SMTP configured
- EPUB download fallback
- Local send history (browser storage)

### v2

- Mobile Share Sheet support (Safari / Twitter/X)
- One-tap sending (no confirmation UI)
- Improved Twitter/X thread handling
- Optional multi-user mode (future)

---

## 4. Users

### Target User

- Advanced user
- Frequent Kindle reader
- Uses both mobile and desktop
- Consumes long-form content saved "to read later"

---

## 5. Functional Requirements

### 5.1 URL Input

- Manual URL input from web UI
- Basic validation
- Immediate feedback on submission

### 5.2 Kindle Email (Optional)

- User can input a Kindle email per send
- Stored locally in browser (no server persistence)
- Validation for `@kindle.com` or `@free.kindle.com`

### 5.3 Content Extraction

- URL type detection:
  - Article
  - Twitter/X thread (MVP)
- Extract:
  - Title
  - Author (if available)
  - Publication date (if available)
  - Main content (clean HTML)

### 5.4 Content Normalization

All content must be converted into a **common internal model**:

```json
{
  "title": "",
  "author": "",
  "source_url": "",
  "content_html": ""
}
```

Rules:

- Remove ads, cookie banners, embeds
- Keep relevant images
- Reorder threads chronologically
- Add a header referencing the original source

### 5.5 EPUB Generation

- Convert normalized HTML to EPUB
- Kindle-optimized template:
  - Generous margins
  - Readable typography
  - Auto-generated table of contents
- Proper EPUB metadata

### 5.6 Kindle Delivery (Optional)

- If SMTP is configured, send EPUB via email
- EPUB as email attachment
- Fixed subject line (e.g. `Send to Kindle`)
- Graceful SMTP error handling

### 5.7 Download Fallback

- If SMTP is not configured, provide a direct EPUB download

### 5.8 Local Send History

- Store history in browser only (localStorage)
- Track:
  - Original URL
  - Title
  - Send date
  - Status (sent / ready / error)

---

## 6. Non-Functional Requirements

- End-to-end processing time < 30s
- Fault-tolerant pipeline
- Clear logging (scraping / EPUB / email)
- Works without server-side persistence

---

## 7. Technical Architecture

### Frontend

- Next.js (App Router)
- Minimal UI, mobile-first
- Local storage for settings/history
- Prepared for Web Share Target API (v2)

### Backend

- API Routes for processing
- Scraping and EPUB generation in Node runtime
- No database

### Infrastructure

- Vercel deployment
- Temporary file storage in `/tmp`

---

## 8. Data Model (Local Only)

```ts
type LocalSettings = {
  kindleEmail?: string;
};

type LocalJob = {
  id: string;
  url: string;
  title: string;
  status: "sent" | "ready" | "error";
  createdAt: string;
};
```

---

## TASK LIST - PHASED & AI-EXECUTABLE

Each phase is independent and does not require a database.

---

## PHASE 0 - Base Setup

**Goal:** Deployable skeleton on Vercel

- Initialize Next.js project
- Configure environment variables
- Setup linting and formatting
- Create minimal home page
- Initial Vercel deployment

---

## PHASE 1 - URL Input & Local Settings

**Goal:** Accept URLs and store Kindle email locally

- URL input form
- URL validation
- Optional Kindle email input
- Store Kindle email in localStorage
- Immediate feedback UI

---

## PHASE 2 - Scraping & Extraction

**Goal:** Extract meaningful content

- Detect URL type
- Implement article extractor
- Implement Twitter/X thread extractor (MVP)
- Generic fallback extractor
- Normalize content to common model
- Test with real-world URLs

---

## PHASE 3 - EPUB Generation

**Goal:** Generate high-quality EPUBs

- Convert HTML -> EPUB
- Create base EPUB template
- Set correct metadata
- Store EPUB temporarily
- Allow download

---

## PHASE 4 - Kindle Delivery

**Goal:** Optional automatic delivery

- Configure SMTP
- Send EPUB via email
- Handle delivery errors
- Report status back to UI

---

## PHASE 5 - Local History

**Goal:** Visibility and trust

- Store send history in browser
- List recent sends
- Clear status indicators
- Optional manual retry

---

## PHASE 6 - v2: Mobile Share Support

**Goal:** One-tap sending from mobile apps

- Implement Web Share Target API
- `/share` endpoint
- Receive shared URL
- Trigger full pipeline automatically
- Minimal success/error feedback

---

## 9. Known Risks

- Twitter/X markup changes
- Anti-scraping defenses
- Email deliverability issues
- Long processing times for heavy pages

Mitigation:

- Fallback extractors
- Timeouts
- Retries
- Logging and monitoring

---

## 10. Future Extensions (Out of Scope)

- AI-generated summaries
- Collections & tagging
- Multi-user accounts with DB
- RSS -> Kindle automation
- Annotations & highlights

---

## 11. Definition of Done (v1)

- URL -> EPUB -> Kindle/download in under 30 seconds
- Clean, readable EPUB
- Visible send history in browser
- Works on desktop and mobile
- Stable Vercel deployment
