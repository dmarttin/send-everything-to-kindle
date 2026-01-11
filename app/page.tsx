import Link from "next/link";

export default function Home() {
  return (
    <div className="container">
      <section className="hero">
        <div>
          <h1>Send anything worth finishing to your Kindle.</h1>
          <p>
            Paste a URL, let the pipeline clean it up, and get a Kindle-ready EPUB in
            your inbox. Built for people who read deep.
          </p>
          <div className="hero-actions">
            <Link className="button primary" href="/send">
              Send a link
            </Link>
            <Link className="button ghost" href="#pipeline">
              See how it works
            </Link>
          </div>
        </div>
        <div className="hero-card">
          <strong>Flow in four taps</strong>
          <ul>
            <li>1. Drop any article or thread.</li>
            <li>2. We clean the markup and images.</li>
            <li>3. A Kindle-optimized EPUB is generated.</li>
            <li>4. It lands in your Kindle inbox.</li>
          </ul>
        </div>
      </section>

      <section className="section" id="pipeline">
        <h2 className="section-title">Phase-ready pipeline</h2>
        <div className="grid">
          <div className="card">
            <strong>Magic link login</strong>
            <p className="muted">No passwords. Just your email and a Kindle address.</p>
          </div>
          <div className="card">
            <strong>Queue-aware jobs</strong>
            <p className="muted">Every URL becomes a job with visible status.</p>
          </div>
          <div className="card">
            <strong>Serverless-first</strong>
            <p className="muted">Built for Vercel with an async-friendly pipeline.</p>
          </div>
        </div>
      </section>
    </div>
  );
}
