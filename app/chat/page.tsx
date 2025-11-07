export const dynamic = "force-static"

export default function ChatPage() {
  return (
    <main className="min-h-[60vh] w-full flex items-center justify-center p-8">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-3xl font-bold tracking-tight">Chat AI</h1>
        <p className="mt-3 text-neutral-600">
          Aquí montaremos el chatbot usando Vercel AI SDK. Por ahora es una página
          de destino para el botón del asistente.
        </p>
        <div className="mt-6 rounded-xl border border-dashed border-neutral-300 p-6 text-left">
          <ol className="list-decimal pl-6 space-y-2 text-sm text-neutral-700">
            <li>
              Instala dependencias: <code>npm i ai openai</code> (u otro proveedor compatible).
            </li>
            <li>
              Crea un endpoint en <code>app/api/chat/route.ts</code> que maneje el streaming.
            </li>
            <li>
              Renderiza el componente cliente con <code>useChat</code> aquí.
            </li>
          </ol>
        </div>
      </div>
    </main>
  )
}
