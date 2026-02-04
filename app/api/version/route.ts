
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import packageJson from '@/package.json'; // Direct import to bundle it

export async function GET() {
    try {
        // 1. Try to read from package.json (Most reliable in Next.js bundle)
        if (packageJson && packageJson.version) {
             return NextResponse.json({ version: `v${packageJson.version}` });
        }

        // 2. Fallback to file system (Development mainly)
        const versionPath = path.join(process.cwd(), 'version.md');
        if (fs.existsSync(versionPath)) {
             const fileContent = fs.readFileSync(versionPath, 'utf8');
             // Improve regex to be robust
             const match = fileContent.match(/^## (v\d+\.\d+\.\d+)/m);
             if (match && match[1]) {
                 return NextResponse.json({ version: match[1] });
             }
        }
        
        // 3. Fallback default
        return NextResponse.json({ version: 'v2.2.3' });
    } catch (error) {
        console.error("Version read error:", error);
        // Fallback to a safe version that won't trigger infinite update loop if possible, 
        // or just return current known version
        return NextResponse.json({ version: 'v2.2.3' });
    }
}
