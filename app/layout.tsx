import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";
import { OfflineIndicator } from "@/components/offline-indicator";
import { PageTransition } from "@/components/page-transition";
import NextTopLoader from "nextjs-toploader";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AuditPro - Mağaza Denetim Sistemi",
  description: "Profesyonel mağaza denetim ve aksiyon takip sistemi",
  icons: {
    icon: "/login-assets-new/logo.png",
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
            <PageTransition>
              {children}
            </PageTransition>
            <Toaster />
            <OfflineIndicator />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}

