import type { Metadata } from "next";

/*
   The page for this route is a client component, and a client component
   cannot export `metadata`. This thin server layout carries the title and
   description so the route is not left with the site-wide default.
*/
export const metadata: Metadata = {
  title: "Operator console",
  description:
    "Live detection, forecast and attribution for a single transboundary pollution episode, switchable between the India and Thailand corridors.",
};

export default function ConsoleLayout({ children }: LayoutProps<"/console">) {
  return children;
}
