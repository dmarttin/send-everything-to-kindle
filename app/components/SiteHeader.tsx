import Link from "next/link";

export default function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container nav">
        <Link className="logo" href="/">
          <span className="logo-mark">SE</span>
          <span>
            Send <em>Everything</em> to Kindle
          </span>
        </Link>
        <nav className="nav-links">
          <Link href="/send">Send a link</Link>
        </nav>
      </div>
    </header>
  );
}
