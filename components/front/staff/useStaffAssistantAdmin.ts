import React from "react"

export type StaffAssistantConfig = {
  tone: string
  searchMode: string
  workflow: string
  includeSources: boolean
  suggestActions: boolean
  requireConfirmation: boolean
}

export type StaffAssistantChatMessage = {
  id: string
  role: "assistant" | "user"
  text: string
}

const createInitialAssistantConfig = (): StaffAssistantConfig => ({
  tone: "balanced",
  searchMode: "hybrid",
  workflow: "operations",
  includeSources: true,
  suggestActions: true,
  requireConfirmation: true,
})

const createInitialAssistantMessages = (): StaffAssistantChatMessage[] => [
  {
    id: "assistant-welcome",
    role: "assistant",
    text: "Puedo ayudarte con staff, reportes, cursos y terminales. Decime qué necesitás revisar.",
  },
]

export const useStaffAssistantAdmin = (activeNavLabel: string) => {
  const [config, setConfig] = React.useState<StaffAssistantConfig>(() => createInitialAssistantConfig())
  const [configMessage, setConfigMessage] = React.useState<string | null>(null)
  const [chatMessages, setChatMessages] = React.useState<StaffAssistantChatMessage[]>(() => createInitialAssistantMessages())
  const [chatInput, setChatInput] = React.useState("")
  const [isRailCollapsed, setIsRailCollapsed] = React.useState(false)

  React.useEffect(() => {
    if (typeof window === "undefined") return
    const desktopQuery = window.matchMedia("(min-width: 1180px)")

    const syncAssistantLayout = () => {
      setIsRailCollapsed(!desktopQuery.matches)
    }

    syncAssistantLayout()
    desktopQuery.addEventListener("change", syncAssistantLayout)

    return () => {
      desktopQuery.removeEventListener("change", syncAssistantLayout)
    }
  }, [])

  const saveConfig = React.useCallback((event: React.FormEvent) => {
    event.preventDefault()
    setConfigMessage("Assistant settings updated.")
    window.setTimeout(() => {
      setConfigMessage(null)
    }, 2200)
  }, [])

  const sendChatMessage = React.useCallback((event: React.FormEvent) => {
    event.preventDefault()
    const prompt = chatInput.trim()
    if (!prompt) return
    const userMessage = { id: `user-${Date.now()}`, role: "user" as const, text: prompt }
    const assistantMessage = {
      id: `assistant-${Date.now()}`,
      role: "assistant" as const,
      text: `Recibido. Estoy en ${activeNavLabel}. Si querés, preparo acciones y checklist para este flujo.`,
    }
    setChatMessages((prev) => [...prev, userMessage, assistantMessage])
    setChatInput("")
  }, [activeNavLabel, chatInput])

  const toggleRail = React.useCallback(() => {
    setIsRailCollapsed((prev) => !prev)
  }, [])

  const collapseRail = React.useCallback(() => {
    setIsRailCollapsed(true)
  }, [])

  const expandRail = React.useCallback(() => {
    setIsRailCollapsed(false)
  }, [])

  return {
    config,
    setConfig,
    configMessage,
    chatMessages,
    chatInput,
    setChatInput,
    isRailCollapsed,
    toggleRail,
    collapseRail,
    expandRail,
    saveConfig,
    sendChatMessage,
  }
}
