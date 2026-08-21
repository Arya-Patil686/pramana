import type { Metadata } from "next";

/*
   The page for this route is a client component, and a client component
   cannot export `metadata`. This thin server layout carries the title and
   description so the route is not left with the site-wide default.
*/
export const metadata: Metadata = {
  title: "Counterfactual simulator",
  description:
    "Suppress named upwind districts and re-solve the receptor forecast: peak delta, GRAP stage avoided, and exposure-hours averted.",
};

export default function CounterfactualLayout({ children }: LayoutProps<"/counterfactual">) {
  return children;
}
