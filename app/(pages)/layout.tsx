import type {Metadata} from "next";
import {ClerkProvider} from "@clerk/nextjs";
import React from "react";
import Header from "@/components/front/Header";
import NotificationBar from "@/components/front/ui/NotificationBar";
import FooterQuote from "@/components/front/FooterQuote";
import AssistantWidget from "@/components/front/AssistantWidget";


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
                <AssistantWidget
                    videoSrc="/videos/assistant.mp4"
                    poster="/images/assistant-poster.jpg"
                    title="¡Hola! Soy tu asistente. Puedo ayudarte a empezar o elegir cómo contactar."
                    ctaLabel="Iniciar chat"
                    startHref="/chat"
                    links={[
                        { label: "WhatsApp", href: "https://wa.me/0000000000" },
                        { label: "Email", href: "mailto:hola@tu-dominio.com" },
                        { label: "Agendar demo", href: "https://calendly.com/tu-enlace" },
                    ]}
                />
                <FooterQuote/>
            </div>
        </ClerkProvider>
    );
}

