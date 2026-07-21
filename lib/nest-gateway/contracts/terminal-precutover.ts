export type TerminalConnectionTokenGatewayRequest = {
  sessionId: string
  terminalId: string
  terminalSlug: string
  terminalName: string
  terminalLocation: string | null
}

export type TerminalConnectionTokenGatewayResponse = {
  secret: string
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null
const isString = (value: unknown): value is string => typeof value === "string"
const isNonEmptyString = (value: unknown): value is string => isString(value) && value.trim().length > 0

export const parseTerminalConnectionTokenGatewayRequest = (
  value: unknown
): TerminalConnectionTokenGatewayRequest | null => {
  if (!isRecord(value)) {
    return null
  }

  if (
    !isNonEmptyString(value.sessionId) ||
    !isNonEmptyString(value.terminalId) ||
    !isNonEmptyString(value.terminalSlug) ||
    !isNonEmptyString(value.terminalName) ||
    !(value.terminalLocation === null || isNonEmptyString(value.terminalLocation))
  ) {
    return null
  }

  return {
    sessionId: value.sessionId,
    terminalId: value.terminalId,
    terminalSlug: value.terminalSlug,
    terminalName: value.terminalName,
    terminalLocation: value.terminalLocation,
  }
}

export const parseTerminalConnectionTokenGatewayResponse = (
  value: unknown
): TerminalConnectionTokenGatewayResponse | null => {
  if (!isRecord(value) || !isString(value.secret) || !value.secret.trim()) {
    return null
  }

  return { secret: value.secret }
}
