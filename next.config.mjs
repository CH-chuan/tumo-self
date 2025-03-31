/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enhanced development experience
  reactStrictMode: true,
  
  // Image optimization configuration
  images: {
    remotePatterns: [
      {
        protocol: 'http',
        hostname: 'localhost',
      },
    ],
    dangerouslyAllowSVG: true,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
  
  // Enable detailed fetch logging
  logging: {
    fetches: {
      fullUrl: true,
    },
  },
  
  // Development indicators
  devIndicators: {
    position: 'bottom-left',
  },

  // Exclude shadcn-examples directory from the build
  pageExtensions: ['js', 'jsx', 'ts', 'tsx'],
  distDir: '.next',
  onDemandEntries: {
    // Control how Next.js keeps pages in memory
    maxInactiveAge: 60 * 1000,
    pagesBufferLength: 2,
  },
  
  // Use webpack to optimize the build and reduce function size
  webpack: (config, { isServer }) => {
    // Exclude shadcn-examples directory from being processed
    config.watchOptions = {
      ...config.watchOptions,
      ignored: /shadcn-examples/,
    };
    
    // Optimize serverless function size by excluding large dependencies
    if (isServer) {
      // Mark certain packages as external to reduce bundle size
      const originalExternals = config.externals;
      config.externals = [
        ...(Array.isArray(originalExternals) ? originalExternals : [originalExternals]),
        // Add large packages to be excluded from the serverless bundle
        '@aws-sdk/client-s3',
        '@aws-sdk/s3-request-presigner',
        'sharp',
        // Add any other large packages that are causing size issues
      ];
    }
    
    return config;
  },
  
  // Ensure static files in the public directory are properly served
  // This is particularly important for accessing generated media files
  output: 'standalone',
  
  // Configure serverless function execution time for image generation
  serverRuntimeConfig: {
    // This will be available only on the server side
    generateImagesTimeout: 60, // 60 seconds for image generation
  },
};

export default nextConfig;
