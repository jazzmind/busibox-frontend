import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow resolving npm-linked workspace packages outside this repo root.
    externalDir: true,
  },
  
  output: 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  assetPrefix: process.env.NEXT_PUBLIC_BASE_PATH || '',

  serverExternalPackages: [
    '@zilliz/milvus2-sdk-node',
    '@grpc/grpc-js',
    '@grpc/proto-loader',
    'ssh2',
  ],

  // Transpile workspace packages used by portal
  transpilePackages: ['@jazzmind/busibox-app'],

  async redirects() {
    return [
      {
        source: '/',
        destination: '/home',
        permanent: false,
      },
    ];
  },

};

export default nextConfig;
