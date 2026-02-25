"use client"
import React from "react"

export default function ChatPage() {
  return (
    <div className="min-h-[60vh] mx-auto max-w-2xl w-full px-4 sm:px-6 lg:px-8 py-10">
      <h1 className="text-2xl font-bold">Assistant Chat</h1>
      <p className="mt-2 text-neutral-600 dark:text-neutral-300">
        This is a base page for chat. Clicking “Start chat” in the widget brings you here.
        If you want, I can hook in the Vercel AI SDK (streaming) and an `/api/chat` endpoint.
      </p>

      <div className="mt-6 border rounded-md p-4 text-sm text-neutral-600 dark:text-neutral-300">
        <p>
          Chat placeholder. Next steps:
        </p>
        <ol className="list-decimal pl-5 mt-2 space-y-1">
          <li>Add `ai` and `openai` to the project.</li>
          <li>Create `app/api/chat/route.ts` with `streamText`.</li>
          <li>Mount a client with `useChat` here for realtime messages.</li>
        </ol>
      </div>
    </div>
  )
}
