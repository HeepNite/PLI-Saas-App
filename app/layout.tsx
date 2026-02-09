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


export const metadata: Metadata = {
    title: "Palladium Latin Institute",
    description: "Artistic Teaching Platform",
};

export default async function RootLayout({children,}: Readonly<{ children: React.ReactNode; }>) {
    const lang = (await cookies()).get("lang")?.value;
    const initialLocale = lang === "es" ? "es" : "en";
    return (
        <html lang="en" suppressHydrationWarning>

        <body className="scroll-smooth">
        <ClerkProvider>
          <I18nProvider initialLocale={initialLocale}>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                {children}
                <SmoothScroll />
                <FloatingTopHomeButton />
                {/* Floating assistant widget mounted globally (client-only wrapper, i18n-aware) */}
                <AssistantWidgetMountI18n />
            </ThemeProvider>
          </I18nProvider>
        </ClerkProvider>
        </body>
        </html>
    );
}
