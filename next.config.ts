import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

// Donne accès aux bindings Cloudflare pendant `next dev`
initOpenNextCloudflareForDev();

const withPWA = withPWAInit({
  dest: "public",
  // Le plugin PWA passe par webpack : désactivé en dev (Turbopack), actif au build (`next build --webpack`)
  disable: process.env.NODE_ENV === "development",
  register: true,
});

const nextConfig: NextConfig = {
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'www.dropbox.com',
      },
    ],
  },
  async redirects() {
    return [
      {
        source: '/login',
        destination: '/pro/login',
        permanent: true,
      },
      {
        source: '/auth/login',
        destination: '/pro/login',
        permanent: true,
      },
    ];
  },
};

export default withPWA(nextConfig);
