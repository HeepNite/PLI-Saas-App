"use client"
import React from "react"

export default function ChatPage() {
  return (
    <div className="min-h-[60vh] mx-auto max-w-2xl w-full px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold">Chat del Asistente</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-300">
        Esta es una página base para el chat. Al hacer clic en "Iniciar chat" en el widget,
        llegarás aquí. Si quieres, integro el Vercel AI SDK (streaming) y un endpoint `/api/chat`.
      </p>

      <div className="mt-6 border rounded-md p-4 text-sm text-neutral-600 dark:text-neutral-300">
        <p>
          Placeholder del chat. Próximos pasos:
        </p>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>Agregar `ai` y `openai` al proyecto.</li>
          <li>Crear `app/api/chat/route.ts` con `streamText`.</li>
          <li>Montar un cliente con `useChat` aquí para tener mensajes en tiempo real.</li>
        </ol>
      </div>
    </div>
  )
}
