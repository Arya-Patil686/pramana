import type { Metadata } from "next";

/*
   The page for this route is a client component, and a client component
   cannot export `metadata`. This thin server layout carries the title and
   description so the route is not left with the site-wide default.
*/
export const metadata: Metadata = {
  title: "Attribution certificate",
  description:
    "The provenance block, Merkle leaves and model pin for an attribution, with an in-browser verifier that recomputes the root from published pre-images.",
};

export default function CertificateLayout({ children }: LayoutProps<"/certificate">) {
  return children;
}
