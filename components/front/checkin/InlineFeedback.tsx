export function InlineFeedback({
  error,
  success,
}: {
  error?: string | null
  success?: string | null
}) {
  if (!error && !success) return null
  return (
    <>
      {error && <p className="mt-4 text-sm text-red-300">{error}</p>}
      {success && <p className="mt-4 text-sm text-emerald-300">{success}</p>}
    </>
  )
}
