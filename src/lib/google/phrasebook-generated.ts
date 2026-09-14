/*
   GENERATED FILE — produced by scripts/build-phrasebook.mjs.

   Machine translations of the reviewed English public-health phrasebook, one
   entry per language and severity band, committed rather than produced at
   request time.

   Why committed: the Gemini free tier allows twenty generate requests per day
   per model. Translating eleven fixed strings on every language switch spends
   that in a handful of clicks and then serves English for the rest of the day,
   and it spends it competing with the one call that genuinely cannot be
   precomputed — reading a photograph nobody has seen before.

   Currently empty. Run the generator once the daily quota allows:

     set -a; . ./.env.local; set +a
     node scripts/build-phrasebook.mjs

   Until then the advisory falls back to reviewed English for the eight
   non-corridor languages and says so on screen. That is the honest failure:
   English clearly labelled as English, rather than a silent gap.

   These are NOT reviewed copy. English, Hindi, Punjabi and Urdu carry
   human-reviewed text in languages.ts and are never generated here.
*/

import type { PublicMessage, SeverityBand } from "./languages";

export interface GeneratedEntry extends PublicMessage {
  /** The model that produced this translation. */
  model: string;
}

export const GENERATED_PHRASEBOOK: Record<
  string,
  Partial<Record<SeverityBand, GeneratedEntry>>
> = {};
