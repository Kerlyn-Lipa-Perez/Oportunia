import type { NextConfig } from "next";
import { CANONICAL_PRODUCTION_URL } from "./src/lib/site/config";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "oportunia-six.vercel.app" }],
        destination: `${CANONICAL_PRODUCTION_URL}/:path*`,
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
