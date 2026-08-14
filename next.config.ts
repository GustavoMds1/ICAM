import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Empacotamento autocontido, usado só pela imagem Docker (o Dockerfile define
  // DOCKER_BUILD=true). Em hospedagem que roda `next start` — Render, por
  // exemplo — `output: 'standalone'` é uma combinação não suportada: o próprio
  // Next avisa que "next start" não funciona com ela.
  output: process.env.DOCKER_BUILD === 'true' ? 'standalone' : undefined,
  // Drivers de banco carregam binários e WebAssembly: precisam ficar fora do
  // empacotamento do servidor para funcionar em produção.
  serverExternalPackages: ['pg', '@electric-sql/pglite', 'mammoth'],
  poweredByHeader: false,
  eslint: { ignoreDuringBuilds: false },
  typescript: { ignoreBuildErrors: false },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          {
            key: 'Content-Security-Policy',
            value:
              "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
