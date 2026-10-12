import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["ws"],
  // The CLI checker spawns a detached child process. In restricted CI/runtime
  // environments that process can exit before emitting --showConfig JSON.
  // TypeScript 5 exposes the compiler API, so use Next's in-process checker.
  experimental: {
    useTypeScriptCli: false,
  },
  // @solana/kit-plugin-payer's browser bundle has a spurious `import 'fs'`
  // from the payerFromFile export. Stub it out for the client bundle.
  turbopack: {
    resolveAlias: {
      fs: { browser: "./empty-module.js" },
    },
  },
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = { ...config.resolve.fallback, fs: false };
    }
    return config;
  },
};

export default nextConfig;
