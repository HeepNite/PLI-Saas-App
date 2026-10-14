import type {Metadata} from "next";

/**
 * Layout raíz de la app.
 * - Providers: Clerk (auth), I18nProvider (i18n cliente), ThemeProvider (tema).
 * - Monta el widget del asistente global con textos traducibles.
 * - Para textos en server, usar tServer() (lib/i18n-server.ts).
 */

import "./globals.css";
import React from "react";
import {ThemeProvider} from "next-themes";
import AssistantWidgetMountI18n from "@/components/front/AssistantWidgetMountI18n";
import { ClerkProvider } from "@clerk/nextjs";
import { I18nProvider } from "@/lib/i18n";
import { cookies } from "next/headers";
import FloatingTopHomeButton from "@/components/front/ui/FloatingTopHomeButton";
import SmoothScroll from "@/components/front/ui/SmoothScroll";
import { FloatingChromeProvider } from "@/components/front/ui/FloatingChromeVisibility";


export const metadata: Metadata = {
    title: "Palladium Latin Institute",
    description: "Artistic Teaching Platform",
    metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"),
    icons: {
        icon: "/favicon.ico",
        shortcut: "/favicon.ico",
        apple: "/favicon.ico",
    },
};

export default async function RootLayout({children,}: Readonly<{ children: React.ReactNode; }>) {
    const lang = (await cookies()).get("lang")?.value;
    const initialLocale = lang === "es" ? "es" : "en";
    return (
        <html lang="en" suppressHydrationWarning>
        <head>
          <script
            dangerouslySetInnerHTML={{
              __html: `(function(){if(/[?&]qrBooking=1/.test(location.search)){document.documentElement.dataset.qrBooking="true"}})()`,
            }}
          />
        </head>
        <body className="scroll-smooth">
        <ClerkProvider>
          <I18nProvider initialLocale={initialLocale}>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                <FloatingChromeProvider>
                    {children}
                    <SmoothScroll />
                    <FloatingTopHomeButton />
                    {/* Floating assistant widget mounted globally (client-only wrapper, i18n-aware) */}
                    <AssistantWidgetMountI18n />
                </FloatingChromeProvider>
            </ThemeProvider>
          </I18nProvider>
        </ClerkProvider>
        </body>
        </html>
    );
}
