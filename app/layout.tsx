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


export const metadata: Metadata = {
    title: "Palladium Latin Institute",
    description: "Artistic Teaching Platform",
};

export default function RootLayout({children,}: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="en" suppressHydrationWarning>

        <body>
        <ClerkProvider>
          <I18nProvider>
            <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
            >
                {children}
                {/* Floating assistant widget mounted globally (client-only wrapper, i18n-aware) */}
                <AssistantWidgetMountI18n />
            </ThemeProvider>
          </I18nProvider>
        </ClerkProvider>
        </body>
        </html>
    );
}
