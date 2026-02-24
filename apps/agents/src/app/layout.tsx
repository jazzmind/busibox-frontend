import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import React from 'react';
import "./globals.css";
import { SessionProvider } from "@jazzmind/busibox-app/components/auth/SessionProvider";
import { ThemeProvider, CustomizationProvider, BusiboxApiProvider } from "@jazzmind/busibox-app";
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

const crossAppPaths = {
  portal: process.env.NEXT_PUBLIC_PORTAL_BASE_PATH || "/portal",
  documents: process.env.NEXT_PUBLIC_DOCUMENTS_BASE_PATH || "/documents",
  agents: process.env.NEXT_PUBLIC_AGENTS_BASE_PATH || "/agents",
  media: process.env.NEXT_PUBLIC_MEDIA_BASE_PATH || "/media",
  chat: process.env.NEXT_PUBLIC_CHAT_BASE_PATH || "/chat",
};
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/agents";

export const metadata: Metadata = {
  title: "Agent Manager",
  description: "Agent Manager",
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
          <BusiboxApiProvider value={{ nextApiBasePath: basePath, crossAppPaths }}>
            <SessionProvider
              appId="busibox-agents"
              portalUrl={process.env.NEXT_PUBLIC_BUSIBOX_PORTAL_URL}
              checkIntervalMs={process.env.NEXT_PUBLIC_AUTH_CHECK_INTERVAL_MS ? Number(process.env.NEXT_PUBLIC_AUTH_CHECK_INTERVAL_MS) : undefined}
              refreshBufferMs={process.env.NEXT_PUBLIC_AUTH_REFRESH_BUFFER_MS ? Number(process.env.NEXT_PUBLIC_AUTH_REFRESH_BUFFER_MS) : undefined}
              tokenExpiresOverrideMs={process.env.NEXT_PUBLIC_TOKEN_EXPIRES_OVERRIDE_MS ? Number(process.env.NEXT_PUBLIC_TOKEN_EXPIRES_OVERRIDE_MS) : undefined}
            >
              <CustomizationProvider apiEndpoint={`${crossAppPaths.portal}/api/portal-customization`}>
                {children}
                <VersionBar />
              </CustomizationProvider>
            </SessionProvider>
          </BusiboxApiProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
