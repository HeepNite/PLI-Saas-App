import type {Metadata} from "next";

import "./globals.css";
import React from "react";
import {ThemeProvider} from "next-themes";


export const metadata: Metadata = {
    title: "Palladium Latin Institute",
    description: "Artistic Teaching Platform",
};

export default function RootLayout({children,}: Readonly<{ children: React.ReactNode; }>) {
    return (
        <html lang="en" suppressHydrationWarning>

        <body>
        <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
        >
            {children}
        </ThemeProvider>
        </body>
        </html>
    );
}
