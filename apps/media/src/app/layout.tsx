import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@jazzmind/busibox-app/components/auth/SessionProvider";
import { ThemeProvider, CustomizationProvider } from "@jazzmind/busibox-app";
import { FetchWrapper } from "@jazzmind/busibox-app";
import { VersionBar } from "@jazzmind/busibox-app";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    template: "%s | Busibox Media",
    default: "Busibox Media | Video Library",
  },
  description: "Busibox Media Library - Generate and manage AI videos.",
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
      { url: '/favicon.ico' },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <FetchWrapper skipAuthUrls={['/api/auth/refresh', '/api/auth/session', '/api/session', '/api/auth/logout', '/api/sso/token', '/api/sso/refresh', '/portal/api/sso/refresh']} />
        <ThemeProvider>
          <SessionProvider
            appId={process.env.APP_NAME || 'busibox-media'}
            portalUrl={process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || process.env.NEXT_PUBLIC_AI_PORTAL_URL}
            basePath={process.env.NEXT_PUBLIC_BASE_PATH}
          >
            <CustomizationProvider>
              {children}
              <VersionBar />
            </CustomizationProvider>
          </SessionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
