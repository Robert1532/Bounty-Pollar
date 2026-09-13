import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  devIndicators: false,
  serverExternalPackages: ['@stellar/stellar-sdk', 'bcryptjs'],
  experimental: {
    // El body de las rutas de API se mantiene chico a proposito.
    serverActions: { bodySizeLimit: '1mb' },
  },
};

export default nextConfig;
