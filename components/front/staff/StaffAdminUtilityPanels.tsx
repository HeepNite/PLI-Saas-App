import React from "react"
import { Settings } from "lucide-react"

import StaffTerminalSetupClient from "@/components/front/staff/StaffTerminalSetupClient"

type AssistantConfig = {
  tone: string
  searchMode: string
  workflow: string
  includeSources: boolean
  suggestActions: boolean
  requireConfirmation: boolean
}

type AssistantConfigKey = keyof AssistantConfig

type SelectOption = {
  value: string
  label: string
}

type StaffAdminUtilityPanelsProps = {
  terminal: {
    isVisible: boolean
    canManageSetup: boolean
  }
  assistant: {
    isVisible: boolean
    config: AssistantConfig
    setConfig: React.Dispatch<React.SetStateAction<AssistantConfig>>
    message: string | null
    onSubmit: (event: React.FormEvent<HTMLFormElement>) => void
  }
  settings: {
    isVisible: boolean
  }
}

const RESPONSE_TONE_OPTIONS: SelectOption[] = [
  { value: "concise", label: "Concise" },
  { value: "balanced", label: "Balanced" },
  { value: "detailed", label: "Detailed" },
]

const SEARCH_MODE_OPTIONS: SelectOption[] = [
  { value: "hybrid", label: "Hybrid (local + web)" },
  { value: "local_only", label: "Local only" },
  { value: "web_first", label: "Web first" },
]

const WORKFLOW_OPTIONS: SelectOption[] = [
  { value: "operations", label: "Operations" },
  { value: "sales", label: "Sales" },
  { value: "quality", label: "Teaching quality" },
]

export default function StaffAdminUtilityPanels({ terminal, assistant, settings }: StaffAdminUtilityPanelsProps) {
  return (
    <>
      <TerminalPanel isVisible={terminal.isVisible} canManageSetup={terminal.canManageSetup} />
      <AssistantPanel {...assistant} />
      <SettingsPanel isVisible={settings.isVisible} />
    </>
  )
}

function TerminalPanel({ isVisible, canManageSetup }: { isVisible: boolean; canManageSetup: boolean }) {
  if (!isVisible) return null
  if (canManageSetup) return <StaffTerminalSetupClient />

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Terminal access</p>
      <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Reception terminal</h3>
      <p className="mt-1 text-sm text-black/65 dark:text-white/65">
        Front desk users can open the terminal flow but cannot change terminal configuration.
      </p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <a
          href="/staff/terminal"
          className="rounded-xl border border-[var(--brand,#b61616)]/55 bg-[var(--brand,#b61616)]/15 px-4 py-2 text-sm font-medium text-[var(--brand,#ff4b4b)]"
        >
          Open terminal
        </a>
        <a
          href="/staff/checkin"
          className="rounded-xl border border-black/15 bg-black/[0.03] px-4 py-2 text-sm text-black/75 dark:border-white/15 dark:bg-white/[0.03] dark:text-white/75"
        >
          Switch user
        </a>
      </div>
    </article>
  )
}

function AssistantPanel({ isVisible, config, setConfig, message, onSubmit }: StaffAdminUtilityPanelsProps["assistant"]) {
  if (!isVisible) return null

  const updateConfigField = <Key extends AssistantConfigKey>(field: Key, value: AssistantConfig[Key]) => {
    setConfig((previous) => ({ ...previous, [field]: value }))
  }

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">AI Assistant</p>
          <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Agent configuration</h3>
          <p className="mt-1 text-sm text-black/65 dark:text-white/65">
            Configure response style, search behavior and workflow gates. The live chat stays in the right rail.
          </p>
        </div>
      </header>

      <form
        onSubmit={onSubmit}
        className="grid gap-3 rounded-xl border border-black/10 bg-white/60 p-3 dark:border-white/10 dark:bg-white/[0.02] lg:grid-cols-2"
      >
        <SelectField
          label="Response tone"
          value={config.tone}
          onChange={(value) => updateConfigField("tone", value)}
          options={RESPONSE_TONE_OPTIONS}
        />
        <SelectField
          label="Search mode"
          value={config.searchMode}
          onChange={(value) => updateConfigField("searchMode", value)}
          options={SEARCH_MODE_OPTIONS}
        />
        <SelectField
          label="Workflow preset"
          value={config.workflow}
          onChange={(value) => updateConfigField("workflow", value)}
          options={WORKFLOW_OPTIONS}
        />
        <div className="space-y-2 rounded-md border border-black/10 bg-white/70 p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]">
          <CheckboxField
            label="Include source links in answers"
            checked={config.includeSources}
            onChange={(checked) => updateConfigField("includeSources", checked)}
          />
          <CheckboxField
            label="Suggest next actions automatically"
            checked={config.suggestActions}
            onChange={(checked) => updateConfigField("suggestActions", checked)}
          />
          <CheckboxField
            label="Require confirmation for sensitive operations"
            checked={config.requireConfirmation}
            onChange={(checked) => updateConfigField("requireConfirmation", checked)}
          />
        </div>
        <div className="lg:col-span-2 flex items-center justify-end gap-2 border-t border-black/10 pt-3 dark:border-white/10">
          {message ? (
            <p className="mr-auto rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200">
              {message}
            </p>
          ) : (
            <span className="mr-auto text-xs text-black/55 dark:text-white/55">Applied to admin copilot and chat rail.</span>
          )}
          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white"
          >
            <Settings className="h-4 w-4" />
            Save assistant config
          </button>
        </div>
      </form>
    </article>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: SelectOption[] }) {
  return (
    <label className="space-y-1.5">
      <span className="text-xs uppercase tracking-[0.22em] text-black/60 dark:text-white/60">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-md border border-black/15 bg-white px-3 py-2 text-sm text-black outline-none focus:border-[var(--brand,#b61616)] dark:border-white/15 dark:bg-white/5 dark:text-white"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-black/80 dark:text-white/80">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      {label}
    </label>
  )
}

function SettingsPanel({ isVisible }: { isVisible: boolean }) {
  if (!isVisible) return null

  return (
    <article className="rounded-2xl border border-black/10 bg-white/80 p-4 shadow-[0_16px_42px_-20px_rgba(0,0,0,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#131622]/92 sm:p-5">
      <header className="mb-4">
        <p className="text-xs uppercase tracking-[0.35em] text-[var(--brand,#b61616)]">Settings</p>
        <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">Portal configuration</h3>
        <p className="mt-1 text-sm text-black/65 dark:text-white/65">
          Centralized settings area for staff portal behavior and system controls.
        </p>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <SettingsCard title="Security defaults" description="Session timeout, PIN retries and protected routes." />
        <SettingsCard title="Notifications" description="Staff alerts, payroll reminders and incident notifications." />
      </div>
    </article>
  )
}

function SettingsCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-xl border border-black/10 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.03]">
      <p className="text-sm font-semibold text-black dark:text-white">{title}</p>
      <p className="mt-1 text-xs text-black/65 dark:text-white/65">{description}</p>
    </div>
  )
}
