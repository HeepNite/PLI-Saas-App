import React from "react"
import type { StudentsBoardClerkSyncProps } from "./studentsBoardTypes"

export const ClerkSyncContext = React.createContext<StudentsBoardClerkSyncProps | null>(null)
