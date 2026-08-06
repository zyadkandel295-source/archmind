/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["@archmind/shared"],
  experimental: {
    typedRoutes: false,
    optimizePackageImports: ["lucide-react", "framer-motion", "highlight.js"]
  },
  compiler: {
    removeConsole: process.env.NODE_ENV === "production" ? { exclude: ["error", "warn"] } : false
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_PLATFORM_URL: process.env.NEXT_PUBLIC_PLATFORM_URL
  },
  async rewrites() {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (!apiUrl) return [];
    return [
      {
        source: "/api/:path*",
        destination: `${apiUrl}/api/:path*`
      }
    ];
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains; preload" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
