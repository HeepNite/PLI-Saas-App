import type {Metadata} from "next";
import {ClerkProvider} from "@clerk/nextjs";
import React from "react";
import Header from "@/components/front/Header";
import NotificationBar from "@/components/front/ui/NotificationBar";

export const metadata: Metadata = {
    title: "PLI Market Place",
    description: "Real-time courses and institute marketplace",
};

export default function RootLayout({children}: Readonly<{ children: React.ReactNode; }>) {
    return (
        <ClerkProvider>
            <div className='min-h-screen w-full m-0 flex flex-col'>
                <NotificationBar/>
                <Header/>
                <main>{children}</main>
            </div>
        </ClerkProvider>
    );
}

