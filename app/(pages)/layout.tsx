import type {Metadata} from "next";
import React from "react";
import PublicLayout from "@/components/layouts/PublicLayout";

export const metadata: Metadata = {
    title: "PLI Market Place",
    description: "Real-time courses and institute marketplace",
};

export default function RootLayout({children}: Readonly<{ children: React.ReactNode; }>) {
    return <PublicLayout>{children}</PublicLayout>;
}
