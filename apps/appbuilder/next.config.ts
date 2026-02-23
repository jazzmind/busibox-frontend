import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: false,
  },

  experimental: {
    esmExternals: true,
  },

  pageExtensions: ["tsx", "ts", "jsx", "js"],

  basePath: process.env.NEXT_PUBLIC_BASE_PATH || "",
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || "",
  trailingSlash: false,

  output: 'standalone',

  // Transpile busibox-app (handles symlinked package)
  transpilePackages: ["@jazzmind/busibox-app"],
};

export default nextConfig;
