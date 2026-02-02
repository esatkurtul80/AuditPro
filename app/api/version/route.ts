
import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    try {
        const versionPath = path.join(process.cwd(), 'version.md');
        let version = 'v0.0.0';
        
        if (fs.existsSync(versionPath)) {
             const fileContent = fs.readFileSync(versionPath, 'utf8');
             // Improve regex to be robust
             const match = fileContent.match(/^## (v\d+\.\d+\.\d+)/m);
             if (match && match[1]) {
                 version = match[1];
             }
        }
        
        return NextResponse.json({ version });
    } catch (error) {
        console.error("Version read error:", error);
        return NextResponse.json({ version: 'unknown' }, { status: 500 });
    }
}
