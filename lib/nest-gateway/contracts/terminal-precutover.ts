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
