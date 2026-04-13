import { prisma } from "@/lib/prisma"

type PaymentModelWithDefaultMethod = {
  defaultPaymentMethodId: string | null
  defaultPaymentMethod: unknown | null
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
    return models
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
      return model
    }

    return {
      ...model,
      defaultPaymentMethod: methodsById.get(model.defaultPaymentMethodId) ?? null,
    }
  })
}

export async function hydratePaymentModelDefaultMethod<T extends PaymentModelWithDefaultMethod>(
  schoolId: string,
  model: T
): Promise<T> {
  const [hydratedModel] = await hydratePaymentModelsDefaultMethod(schoolId, [model])
  return hydratedModel
}
