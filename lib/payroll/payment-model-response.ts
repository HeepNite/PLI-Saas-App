import { prisma } from "@/lib/prisma"
import { maskPaymentMethod } from "@/lib/payroll/mask-payment-method-config"

type PaymentMethodRow = { adapterType: string; configJson: unknown }

type PaymentModelWithDefaultMethod = {
  defaultPaymentMethodId: string | null
  defaultPaymentMethod: PaymentMethodRow | null
}

/**
 * Masks `model.defaultPaymentMethod` if present, otherwise returns it as-is
 * (`null`). Applied unconditionally to both hydrate branches below so
 * masking is effective regardless of how the method was populated —
 * see design decision "Hydrate functions must mask defaultPaymentMethod
 * unconditionally".
 */
const maskDefaultMethod = <T extends PaymentModelWithDefaultMethod>(model: T): T => {
  if (!model.defaultPaymentMethod) {
    return model
  }

  return {
    ...model,
    defaultPaymentMethod: maskPaymentMethod(model.defaultPaymentMethod),
  }
}

export async function hydratePaymentModelsDefaultMethod<T extends PaymentModelWithDefaultMethod>(
  schoolId: string,
  models: T[]
): Promise<T[]> {
  const missingMethodIds = Array.from(new Set(models.flatMap((model) => {
    if (!model.defaultPaymentMethodId || model.defaultPaymentMethod) return []

    return [model.defaultPaymentMethodId]
  })))

  if (missingMethodIds.length === 0) {
    return models.map(maskDefaultMethod)
  }

  const methods = await prisma.staffPaymentMethod.findMany({
    where: {
      schoolId,
      id: { in: missingMethodIds },
    },
  })

  const methodsById = new Map(methods.map((method) => [method.id, method]))

  return models.map((model) => {
    if (!model.defaultPaymentMethodId || model.defaultPaymentMethod) {
      return maskDefaultMethod(model)
    }

    return maskDefaultMethod({
      ...model,
      defaultPaymentMethod: (methodsById.get(model.defaultPaymentMethodId) ?? null) as PaymentMethodRow | null,
    })
  })
}

export async function hydratePaymentModelDefaultMethod<T extends PaymentModelWithDefaultMethod>(
  schoolId: string,
  model: T
): Promise<T> {
  const [hydratedModel] = await hydratePaymentModelsDefaultMethod(schoolId, [model])
  return hydratedModel
}
