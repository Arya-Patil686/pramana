import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /*
     Standalone output traces the module graph and emits only what the server
     actually reaches, which is what makes the Cloud Run image small enough to
     cold-start quickly. Without it the runtime stage would have to carry the
     whole of node_modules.
  */
  output: "standalone",
};

export default nextConfig;
