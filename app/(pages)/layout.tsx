import type {Metadata} from "next";
import React from "react";
import Header from "@/components/front/Header";
import NotificationBar from "@/components/front/ui/NotificationBar";
import FooterQuote from "@/components/front/FooterQuote";

export const metadata: Metadata = {
    title: "PLI Market Place",
    description: "Real-time courses and institute marketplace",
};

export default function RootLayout({children}: Readonly<{ children: React.ReactNode; }>) {
    return (
        <div className='min-h-screen w-full m-0 flex flex-col'>
            <NotificationBar/>
            <Header/>
            <main>{children}</main>
            <FooterQuote/>
        </div>
    );
}

