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
              __html: `(function(){if(/[?&]qrBooking=1/.test(location.search)&&window.innerWidth<1024){var d=document.createElement("div");d.id="qr-boot-loader";d.style.cssText="position:fixed;inset:0;z-index:99999;background:#000;display:flex;align-items:center;justify-content:center";d.innerHTML='<div style="display:flex;flex-direction:column;align-items:center;gap:12px"><div style="width:32px;height:32px;border:2px solid rgba(255,255,255,.3);border-top-color:#fff;border-radius:50%;animation:qrspin 1s linear infinite"></div><p style="font-size:14px;color:rgba(255,255,255,.7)">Loading your booking\\u2026</p></div><style>@keyframes qrspin{to{transform:rotate(360deg)}}</style>';document.documentElement.appendChild(d)}})()`,
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
