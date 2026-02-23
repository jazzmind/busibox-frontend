"use client";

import React from "react";
import {
  BusiboxApiProvider,
  CustomizationProvider,
  ThemeProvider,
} from "@jazzmind/busibox-app";
import type { PortalCustomization } from "@jazzmind/busibox-app";

// Default customization - update these for your app
const defaultCustomization: PortalCustomization = {
  companyName: "Busibox",
  siteName: "App Builder",
  slogan: "Build apps with AI",
  logoUrl: null,
  faviconUrl: null,
  primaryColor: "#0f172a", // slate-900
  secondaryColor: "#334155", // slate-700
  textColor: "#ffffff",
  addressLine1: "",
  addressLine2: null,
  addressCity: null,
  addressState: "",
  addressZip: null,
  addressCountry: "",
  supportEmail: null,
  supportPhone: null,
  customCss: null,
};

export function Providers({ children }: { children: React.ReactNode }) {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

  return (
    <ThemeProvider>
      <BusiboxApiProvider
        value={{ nextApiBasePath: basePath, services: {}, serviceRequestHeaders: {} }}
      >
        <CustomizationProvider initialCustomization={defaultCustomization}>
          {children}
        </CustomizationProvider>
      </BusiboxApiProvider>
    </ThemeProvider>
  );
}
