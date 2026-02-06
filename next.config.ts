import type { NextConfig } from "next";
import fs from 'fs';
import path from 'path';

// Get version from version.md
let appVersion = "v0.0.0";
try {
  const versionFile = fs.readFileSync(path.join(process.cwd(), 'version.md'), 'utf8');
  // Look for the first line starting with ## v
  const match = versionFile.match(/^## (v\d+\.\d+\.\d+)/m);
  if (match && match[1]) {
    appVersion = match[1];
    console.log(`Build Version: ${appVersion}`);
  }
} catch (error) {
  console.warn("Could not read version.md file", error);
}

const nextConfig: NextConfig = {
  // Trigger rebuild for API updates V2
  reactStrictMode: false,
  output: "standalone",
  env: {
    NEXT_PUBLIC_APP_VERSION: appVersion,
  },
  images: {
    // Optimization enabled for better LCP
  },
  /* experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "recharts",
      "framer-motion",
    ],
  }, */
  // headers removed to fix auth network error
};

export default nextConfig;
