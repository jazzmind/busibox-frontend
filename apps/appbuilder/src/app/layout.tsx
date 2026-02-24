import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import React from "react";
import "./globals.css";
import { SessionProvider } from "@jazzmind/busibox-app/components/auth/SessionProvider";
import { ThemeProvider, CustomizationProvider } from "@jazzmind/busibox-app";
import { FetchWrapper } from "@jazzmind/busibox-app";
import { VersionBar } from "@jazzmind/busibox-app";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Busibox App Builder",
  description: "Build and deploy Busibox apps with conversational AI",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const portalUrl = process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL || process.env.NEXT_PUBLIC_AI_PORTAL_URL || '';
  const appId = process.env.APP_NAME || 'busibox-appbuilder';
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <FetchWrapper skipAuthUrls={['/api/auth/refresh', '/api/auth/exchange', '/api/auth/token', '/api/session', '/api/auth/session', '/api/logout', '/api/health', '/api/sso', '/portal/api/sso/refresh']} />
        <ThemeProvider>
          <SessionProvider
            appId={appId}
            portalUrl={portalUrl}
            basePath={basePath}
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
