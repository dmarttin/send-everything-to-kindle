import type { Metadata } from "next";
import { Alegreya, Work_Sans } from "next/font/google";
import "./globals.css";
import SiteHeader from "@/app/components/SiteHeader";

const display = Alegreya({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
});

const body = Work_Sans({
  variable: "--font-body",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Send Everything to Kindle",
  description: "Send any article, thread, or URL to your Kindle in one step.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${display.variable} ${body.variable}`}>
        <div className="page">
          <SiteHeader />
          <main>{children}</main>
        </div>
      </body>
    </html>
  );
}
