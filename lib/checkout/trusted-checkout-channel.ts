import "server-only"
import { AsyncLocalStorage } from "node:async_hooks"

export type TrustedCheckoutChannel = "profile"

const trustedCheckoutChannel = new AsyncLocalStorage<TrustedCheckoutChannel>()

export const runWithTrustedCheckoutChannel = <T>(
  channel: TrustedCheckoutChannel,
  callback: () => T,
): T => trustedCheckoutChannel.run(channel, callback)

export const getTrustedCheckoutChannel = (): TrustedCheckoutChannel | undefined =>
  trustedCheckoutChannel.getStore()
