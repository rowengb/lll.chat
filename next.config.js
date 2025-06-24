/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // 🚀 HYPERSPEED OPTIMIZATIONS
  poweredByHeader: false, // Remove X-Powered-By header
  compress: true, // Enable gzip compression
  
  // Server external packages for Next.js 15
  serverExternalPackages: [
    'canvas',
    'jsdom',
    'sharp'
  ],
  
  // 🎯 COMPILER OPTIMIZATIONS (disabled for Next.js 15 compatibility)
  // compiler: {
  //   removeConsole: process.env.NODE_ENV === 'production' ? {
  //     exclude: ['error', 'warn'] // Keep error/warn logs
  //   } : false,
  // },
  
  // ⚡ ADVANCED BUNDLE OPTIMIZATION (Next.js 15 + HYPERSPEED)
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      '@radix-ui/react-dialog',
      '@radix-ui/react-dropdown-menu',
      'framer-motion',
      'react-markdown',
      'rehype-highlight',
      'remark-gfm'
    ],
    // Removed optimizeCss: true - causing critters module conflicts in Next.js 15
  },
  
  // 🚀 HYPERSPEED WEBPACK OPTIMIZATIONS (React 19 + Next.js 15)
  webpack: (config, { dev, isServer }) => {
    // Basic fallbacks for Node.js modules
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        path: false,
        os: false,
      };
    }

    // 🔥 PRODUCTION HYPERSPEED OPTIMIZATIONS (simplified for Next.js 15 compatibility)
    if (!dev) {
      // Enhanced tree shaking (compatible with Next.js 15)
      config.optimization.usedExports = true;
      config.optimization.sideEffects = false;
      
      // Let Next.js 15 handle code splitting automatically
      // Manual splitChunks can conflict with Next.js 15's optimizations
    }

    return config;
  },

  // 📱 HYPERSPEED HEADERS FOR PERFORMANCE
  headers: async () => [
    {
      source: '/(.*)',
      headers: [
        {
          key: 'X-DNS-Prefetch-Control',
          value: 'on'
        },
        {
          key: 'X-Content-Type-Options',
          value: 'nosniff'
        },
      ]
    },
    // Cache service worker aggressively
    {
      source: '/sw-hyperspeed.js',
      headers: [
        {
          key: 'Cache-Control',
          value: 'public, max-age=31536000, immutable'
        }
      ]
    },
  ],
  
  // 🚀 HYPERSPEED REDIRECTS
  async redirects() {
    return [
      // Redirect old app route to optimized chat route
      {
        source: '/app',
        destination: '/chat/new',
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/decide",
        destination: "https://us.i.posthog.com/decide",
      },
    ];
  },
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
};

module.exports = nextConfig;
