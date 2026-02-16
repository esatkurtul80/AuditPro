import type { NextConfig } from "next";
import fs from 'fs';
import path from 'path';

// Get version from version.md
let appVersion = "v0.0.0";
try {
  const versionFile = fs.readFileSync(path.join(process.cwd(), 'version.md'), 'utf8');
  // Look for the first line starting with ## v
  // Look for the "Current Version" line first
  const currentVersionMatch = versionFile.match(/\*\*Current Version:\*\* (v\d+\.\d+\.\d+)/);
  
  if (currentVersionMatch && currentVersionMatch[1]) {
    appVersion = currentVersionMatch[1];
  } else {
    // Fallback to the first header
    const match = versionFile.match(/^#+ (v\d+\.\d+\.\d+)/m);
    if (match && match[1]) {
      appVersion = match[1];
    }
  }
  console.log(`Build Version: ${appVersion}`);
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
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
    ],
  },
};

export default nextConfig;
