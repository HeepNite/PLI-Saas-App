"use client"
import { useSyncExternalStore } from "react"
import {
  getNativeCollectionPrompt,
  getNativeReaderStatus,
  subscribeNativeReaderEvents,
  type NativeCollectionPrompt,
  type NativeReaderStatus,
} from "@/components/front/courses/enroll/effects/native-payment-bridge"

/** Native M2 readiness; "unknown" outside the native WebView or before the app reports. */
export function useNativeReaderStatus(): NativeReaderStatus {
  return useSyncExternalStore(subscribeNativeReaderEvents, getNativeReaderStatus, () => "unknown")
}

/** The native collection moment the customer should see; "none" outside a native sale. */
export function useNativeCollectionPrompt(): NativeCollectionPrompt {
  return useSyncExternalStore(subscribeNativeReaderEvents, getNativeCollectionPrompt, () => "none")
}
