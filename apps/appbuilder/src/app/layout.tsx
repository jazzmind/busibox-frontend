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
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <FetchWrapper skipAuthUrls={['/api/auth/session']} />
        <ThemeProvider>
          <SessionProvider
            appId="busibox-appbuilder"
            portalUrl={process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL}
            exchangeEndpoint="/api/auth/session"
            refreshEndpoint="/api/auth/session"
            checkIntervalMs={process.env.NEXT_PUBLIC_AUTH_CHECK_INTERVAL_MS ? Number(process.env.NEXT_PUBLIC_AUTH_CHECK_INTERVAL_MS) : undefined}
            refreshBufferMs={process.env.NEXT_PUBLIC_AUTH_REFRESH_BUFFER_MS ? Number(process.env.NEXT_PUBLIC_AUTH_REFRESH_BUFFER_MS) : undefined}
            tokenExpiresOverrideMs={process.env.NEXT_PUBLIC_TOKEN_EXPIRES_OVERRIDE_MS ? Number(process.env.NEXT_PUBLIC_TOKEN_EXPIRES_OVERRIDE_MS) : undefined}
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
