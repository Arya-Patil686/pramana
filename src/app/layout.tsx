import type { Metadata, Viewport } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/layout/nav-bar";
import { Footer } from "@/components/layout/footer";
import { SmoothScroll } from "@/components/scroll/smooth-scroll";

/*
   Newsreader carries the editorial voice. Its optical-size axis means the
   display cuts tighten as they scale up rather than just getting bigger, and
   it reads as a document of record instead of a landing page.
   IBM Plex is the instrumentation face. It was commissioned for engineering
   documentation, so it sits correctly next to hashes and station readings.
*/
const newsreader = Newsreader({
  subsets: ["latin"],
  variable: "--font-newsreader",
  display: "swap",
  axes: ["opsz"],
  style: ["normal", "italic"],
});

const plexSans = IBM_Plex_Sans({
  subsets: ["latin"],
  variable: "--font-plex-sans",
  display: "swap",
  weight: ["300", "400", "500", "600"],
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-plex-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: {
    default: "PRAMĀNA · Federated Airshed Attribution",
    template: "%s · PRAMĀNA",
  },
  description:
    "Cryptographically verifiable attribution certificates for cross-border air pollution. Proving whose pollution it is, in a form a rival state can independently reproduce.",
  keywords: [
    "air pollution",
    "source attribution",
    "transboundary pollution",
    "BRICS",
    "federated learning",
    "air quality forecast",
    "GRAP",
    "PM2.5",
    "provenance",
    "Merkle ledger",
  ],
  authors: [{ name: "PRAMĀNA" }],
  openGraph: {
    title: "PRAMĀNA · Federated Airshed Attribution",
    description:
      "Proving whose pollution it is, in a form a rival state can independently reproduce.",
    type: "website",
    locale: "en_IN",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#0b1015",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions (LanguageTool, Grammarly and friends) inject
    // attributes onto <html> before React hydrates. Suppressing here stops a
    // spurious mismatch warning; it does not mask mismatches in our own tree.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable} antialiased`}
    >
      <body className="grain min-h-screen bg-bg-base text-text-primary">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:bg-bg-surface focus:px-3 focus:py-2 focus:text-sm focus:outline focus:outline-accent-verify"
        >
          Skip to content
        </a>
        <SmoothScroll />
        <NavBar />
        <main id="main" className="pt-11">
          {children}
        </main>
        <Footer />
      </body>
    </html>
  );
}
