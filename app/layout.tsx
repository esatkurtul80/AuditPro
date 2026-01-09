import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { PageTransition } from "@/components/page-transition";
import { ServiceWorkerUpdater } from "@/components/service-worker-updater";
import { GlobalBottomNavWrapper } from "@/components/global-bottom-nav-wrapper";
import { GlobalHeader } from "@/components/global-header";

import NextTopLoader from "nextjs-toploader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "white" },
    { media: "(prefers-color-scheme: dark)", color: "black" },
  ],
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export const metadata: Metadata = {
  title: "AuditPro",
  description: "Profesyonel mağaza denetim ve aksiyon takip sistemi",
  icons: {
    icon: "/login-assets-new/logo.png",
    apple: "/login-assets-new/logo.png",
  },
  appleWebApp: {
    capable: false,
    title: "AuditPro",
    statusBarStyle: "default",
  },
  other: {
    // 'mobile-web-app-capable': 'no', // Disabled to allow Android PWA to work
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <NextTopLoader
              color="#2563eb"
              height={2}
              showSpinner={false}
              speed={200}
              easing="ease"
              shadow={false}
            />
            <GlobalHeader />
            <PageTransition>
              {children}
            </PageTransition>
            <GlobalBottomNavWrapper />
            <Toaster />
            <ServiceWorkerUpdater />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

