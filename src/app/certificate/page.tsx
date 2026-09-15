import { CertificateView } from "@/components/certificate/certificate-view";
import { runEpisode } from "@/lib/pipeline/episode";

/*
   Certificates are sealed at request time from the pipeline's own inputs —
   the recorded episode replay and the live field — rather than read from a
   file of pre-written hashes. Open the page twice with unchanged inputs and
   the roots match; change an input and the leaf that moved says which.
*/

export const dynamic = "force-dynamic";

export default async function CertificatePage() {
  const [episode, live] = await Promise.all([runEpisode("episode"), runEpisode("live")]);

  return (
    <CertificateView
      certificates={[episode.certificate, live.certificate]}
      episodeLabels={{
        [episode.certificate.episodeId]: "3 November episode, recorded 925 hPa field",
        [live.certificate.episodeId]: "Live corridor, current 925 hPa field",
      }}
    />
  );
}
