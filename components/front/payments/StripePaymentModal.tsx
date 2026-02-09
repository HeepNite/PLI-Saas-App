import React from "react"
import { loadStripe } from "@stripe/stripe-js"
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js"

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "")

type StripePaymentModalProps = {
  clientSecret: string
  onClose: () => void
  onSuccess: () => void
  email?: string
  name?: string
  phone?: string
}

export function StripePaymentModal({ clientSecret, onClose, onSuccess, email, name, phone }: StripePaymentModalProps) {
  if (!clientSecret) return null

  return (
    <div className="fixed inset-0 z-[11000] flex items-center justify-center bg-black/35 backdrop-blur-[2px] px-2 sm:px-4 py-6">
      <div className="relative mt-[11rem] w-full sm:mt-0 sm:max-w-md rounded-2xl bg-white p-4 shadow-2xl h-[56vh] max-h-[56vh] sm:h-[33rem] sm:max-h-[33rem] flex flex-col overflow-hidden">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 h-8 w-8 rounded-full bg-black/70 text-white hover:bg-black"
          aria-label="Cerrar"
        >
          ✕
        </button>
        <Elements
          stripe={stripePromise}
          options={{
            clientSecret,
            appearance: {
              theme: "stripe",
            },
            paymentMethodOrder: ["apple_pay", "google_pay", "card"],
            defaultValues: {
              billingDetails: {
                email,
                name,
                phone,
              },
            },
          }}
        >
          <PaymentForm onClose={onClose} onSuccess={onSuccess} email={email} name={name} phone={phone} />
        </Elements>
      </div>
    </div>
  )
}

function PaymentForm({
  onClose,
  onSuccess,
  email,
  name,
  phone,
}: {
  onClose: () => void
  onSuccess: () => void
  email?: string
  name?: string
  phone?: string
}) {
  const stripe = useStripe()
  const elements = useElements()
  const [processing, setProcessing] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!stripe || !elements) return
    setProcessing(true)
    setError(null)
    const result = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        receipt_email: email,
      },
    })
    if (result.error) {
      setError(result.error.message || "No se pudo procesar el pago.")
      setProcessing(false)
      return
    }
    setProcessing(false)
    onSuccess()
    onClose()
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 overflow-y-auto pr-1">
      <h3 className="text-lg font-semibold">Pago seguro</h3>
      <p className="text-sm text-neutral-600">Usa Apple Pay, Google Pay o tarjeta.</p>
      <div className="rounded-md border border-black/10 p-3 bg-white min-h-[220px]">
        <PaymentElement
          options={{
            layout: "tabs",
            defaultValues: {
              billingDetails: {
                email,
                name,
                phone,
              },
            },
            wallets: {
              applePay: "auto",
              googlePay: "auto",
              link: "never",
            },
            terms: {
              card: "never",
            },
          }}
        />
      </div>
      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      <div className="mt-3 bg-white pt-3 pb-1 flex justify-end gap-2 border-t border-black/10">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-black/20 bg-white px-4 py-2 text-sm text-neutral-900 hover:bg-neutral-50"
        >
          Volver
        </button>
        <button
          type="submit"
          disabled={processing || !stripe || !elements}
          className="rounded-md bg-[#635bff] px-4 py-2 text-sm text-white disabled:opacity-50"
        >
          {processing ? "Procesando..." : "Pagar ahora"}
        </button>
      </div>
    </form>
  )
}
