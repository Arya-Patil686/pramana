import type { Metadata, Viewport } from "next";
import {
  Newsreader,
  IBM_Plex_Sans,
  IBM_Plex_Mono,
  Poppins,
} from "next/font/google";
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

/*
   Poppins is the display face: geometric, quiet at weight 600, and legible
   from a caption to a headline. It also sits naturally beside Google's own
   product typography, which is the register this is being read in.
*/
const poppins = Poppins({
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
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
  themeColor: "#f7f1dc",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // Browser extensions (LanguageTool, Grammarly and friends) inject
    // attributes onto <html> before React hydrates. Suppressing here stops a
    // spurious mismatch warning; it does not mask mismatches in our own tree.
    <html
      lang="en"
      suppressHydrationWarning
      className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable} ${poppins.variable} antialiased`}
    >
      <body className="min-h-screen bg-[var(--color-stain-0)] text-[var(--color-ink)]">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[200] focus:border-2 focus:border-[var(--color-ink)] focus:bg-[var(--color-mark-bronze)] focus:px-3 focus:py-2 focus:text-sm"
        >
          Skip to content
        </a>
        <SmoothScroll>
          <NavBar />
          <main id="main">{children}</main>
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
