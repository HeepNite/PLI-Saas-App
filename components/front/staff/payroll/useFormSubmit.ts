import React from "react"

export function useFormSubmit(
  setError: (msg: string | null) => void,
  setSuccess: (msg: string | null) => void,
) {
  const [saving, setSaving] = React.useState(false)

  const submit = React.useCallback(
    async (
      event: React.FormEvent<HTMLFormElement>,
      handler: () => Promise<{ ok: boolean; error?: string }>,
      onSuccess: () => void,
      successMessage: string,
    ) => {
      event.preventDefault()
      setSaving(true)
      setError(null)
      setSuccess(null)

      try {
        const result = await handler()
        if (!result.ok) {
          setError(result.error ?? "An unexpected error occurred.")
          return
        }
        onSuccess()
        setSuccess(successMessage)
      } finally {
        setSaving(false)
      }
    },
    [setError, setSuccess],
  )

  return { saving, submit }
}
