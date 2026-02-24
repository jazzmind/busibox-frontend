import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { SessionProvider } from "@jazzmind/busibox-app/components/auth/SessionProvider";
import { ThemeProvider, CustomizationProvider, BusiboxApiProvider } from "@jazzmind/busibox-app";
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

const crossAppPaths = {
  portal: process.env.NEXT_PUBLIC_PORTAL_BASE_PATH || "/portal",
  documents: process.env.NEXT_PUBLIC_DOCUMENTS_BASE_PATH || "/documents",
  agents: process.env.NEXT_PUBLIC_AGENTS_BASE_PATH || "/agents",
  media: process.env.NEXT_PUBLIC_MEDIA_BASE_PATH || "/media",
  chat: process.env.NEXT_PUBLIC_CHAT_BASE_PATH || "/chat",
};
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/portal";

export const metadata: Metadata = {
  title: {
    template: "%s | Busibox Portal",
    default: "Busibox Portal | Internal Tools",
  },
  description: "Secure access to AI internal tools and applications.",
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
        <FetchWrapper skipAuthUrls={['/api/auth/session', '/api/logout']} />
        <ThemeProvider>
          <BusiboxApiProvider value={{ nextApiBasePath: basePath, crossAppPaths }}>
            <SessionProvider>
              <CustomizationProvider>
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
