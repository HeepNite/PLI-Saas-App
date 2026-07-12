import type { Prisma } from "@prisma/client"

import type { ConfigFieldSchema } from "@/lib/payroll/adapters/adapterConfigSchemas"
import { getAdapterConfigSchema } from "@/lib/payroll/adapters/adapterConfigSchemas"
import type { AdapterType } from "@/lib/payroll/types"
import { asObject } from "@/lib/shared"

/** Fixed placeholder preview for credential-shaped secret fields. */
const FIXED_PLACEHOLDER = "••••"

/** Number of trailing characters exposed by a last-4 preview, e.g. "…1234". */
const LAST_4_LENGTH = 4

export type MaskedSecret = { configured: boolean; preview: string | null }

export type MaskedConfig = Record<string, MaskedSecret | string>

type ResolvedSchema = { entries: ConfigFieldSchema[]; isKnownAdapterType: boolean }

const resolveSchema = (adapterType: AdapterType): ResolvedSchema => {
  const entries = getAdapterConfigSchema(adapterType)
  return { entries: entries ?? [], isKnownAdapterType: entries !== undefined }
}

const findFieldSchema = (entries: ConfigFieldSchema[], key: string): ConfigFieldSchema | undefined =>
  entries.find((entry) => entry.key === key)

const buildPreview = (value: string, previewTail?: number): string => {
  if (previewTail && value.length > previewTail) {
    return `…${value.slice(-previewTail)}`
  }
  return FIXED_PLACEHOLDER
}

const maskValue = (value: unknown, previewTail?: number): MaskedSecret => {
  if (typeof value !== "string" || value.length === 0) {
    return { configured: false, preview: null }
  }
  return { configured: true, preview: buildPreview(value, previewTail) }
}

/**
 * Projects a stored `configJson` into its masked, HTTP-response-safe form.
 * Every key declared `secret: true` (or NOT declared at all — fail-closed,
 * mask-all-undeclared) is replaced with `{ configured, preview }`. Keys
 * explicitly declared `secret: false` pass through as raw values.
 *
 * Pure function. Normalizes `null`/non-object input to `{}` — never throws.
 */
export function maskPaymentMethodConfig(adapterType: AdapterType, configJson: unknown): MaskedConfig {
  const stored = asObject(configJson)
  const { entries, isKnownAdapterType } = resolveSchema(adapterType)
  const result: MaskedConfig = {}

  for (const key of Object.keys(stored)) {
    const fieldSchema = isKnownAdapterType ? findFieldSchema(entries, key) : undefined

    if (fieldSchema && !fieldSchema.secret) {
      result[key] = stored[key] as string
      continue
    }

    result[key] = maskValue(stored[key], fieldSchema?.previewTail)
  }

  // Declared secret keys absent from stored config are still reported as
  // "not configured" rather than omitted silently.
  for (const fieldSchema of entries) {
    if (fieldSchema.secret && !(fieldSchema.key in result)) {
      result[fieldSchema.key] = { configured: false, preview: null }
    }
  }

  return result
}

const isMaskedShapeObject = (value: unknown): value is MaskedSecret =>
  typeof value === "object" && value !== null && !Array.isArray(value) && "configured" in value && "preview" in value

const ELLIPSIS_PREVIEW_REGEX = new RegExp(`^….{${LAST_4_LENGTH}}$`)

const isSentinelString = (value: string): boolean =>
  value === FIXED_PLACEHOLDER || ELLIPSIS_PREVIEW_REGEX.test(value)

/**
 * Rejects the masked preview shape (a UI round-trip echoing the server's own
 * `{configured, preview}` object back as a "new" value) AND the string-form
 * equivalent (an exact sentinel-string collision — an accepted, documented,
 * permanent limitation; see design "Accepted, permanent limitation").
 */
const isValidIncomingSecretValue = (value: unknown): value is string => {
  if (isMaskedShapeObject(value)) return false
  return typeof value === "string" && value.length > 0 && !isSentinelString(value)
}

const isValidIncomingNonSecretValue = (value: unknown): value is string | number | boolean =>
  value !== undefined && value !== null && value !== ""

/**
 * Merges an incoming write payload over a stored `configJson`, honoring
 * write-only secret semantics: a secret key is overwritten only by a new,
 * non-empty, non-sentinel value; otherwise the stored value survives.
 * Non-secret declared keys overwrite when a valid value is supplied.
 *
 * Both incoming keys not declared in the resolved adapter schema (dropped,
 * fail-closed write) and stored keys with no destination under the resolved
 * schema (pruned — covers a genuine adapterType change, where old-schema
 * keys no longer apply) are excluded from the result: the resolved schema
 * is the sole source of truth for what the merged config may contain.
 *
 * Pure function. Always returns a plain object, never `null`.
 */
export function mergePaymentMethodConfig(
  adapterType: AdapterType,
  stored: unknown,
  incoming: unknown,
): Prisma.InputJsonValue {
  const storedConfig = asObject(stored)
  const incomingConfig = asObject(incoming)
  const { entries } = resolveSchema(adapterType)

  const merged: Record<string, unknown> = { ...storedConfig }

  for (const fieldSchema of entries) {
    const incomingValue = incomingConfig[fieldSchema.key]

    if (fieldSchema.secret) {
      if (isValidIncomingSecretValue(incomingValue)) {
        merged[fieldSchema.key] = incomingValue
      }
      continue
    }

    if (isValidIncomingNonSecretValue(incomingValue)) {
      merged[fieldSchema.key] = incomingValue
    }
  }

  // Prune any stored key that has no destination under the resolved
  // (effective) adapter schema. This covers both a genuine adapterType
  // change (old-schema keys no longer apply) and free-form/legacy keys —
  // the resolved schema is the single source of truth for what a config
  // object may legitimately contain going forward.
  const declaredKeys = new Set(entries.map((entry) => entry.key))

  for (const key of Object.keys(merged)) {
    if (!declaredKeys.has(key)) {
      delete merged[key]
    }
  }

  return merged as Prisma.InputJsonValue
}

/**
 * Applies `maskPaymentMethodConfig` to a full payment-method row, replacing
 * `configJson` with its masked projection. Returns a NEW object and never
 * mutates `row` or `row.configJson` — safe to call redundantly on the same
 * aliased row (e.g. shared across multiple hydrated payment models).
 */
export function maskPaymentMethod<T extends { adapterType: string; configJson: unknown }>(row: T): T {
  return {
    ...row,
    configJson: maskPaymentMethodConfig(row.adapterType as AdapterType, row.configJson),
  }
}
