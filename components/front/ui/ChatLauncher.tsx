"use client"
import React from "react"
import { useRouter } from "next/navigation"

export default function ChatLauncher({ className = "" }: { className?: string }) {
  const router = useRouter()

  const openAssistant = () => {
    try {
      // Notify AssistantWidget if mounted
      window.dispatchEvent(new CustomEvent("assistant:open"))
    } catch {}
    // Optional: also navigate to a dedicated chat route if you have one
    try {
      router.prefetch?.("/chat")
    } catch {}
  }

  return (
    <button
      type="button"
      onClick={openAssistant}
      className={`rounded-md bg-[var(--brand,#111)] text-white px-4 py-2 ${className}`}
      aria-label="Abrir chat con el asistente"
    >
      Hablar con el asistente
    </button>
  )
}
