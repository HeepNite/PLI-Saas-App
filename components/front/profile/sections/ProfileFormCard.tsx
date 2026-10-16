import React from "react"
import { X } from "lucide-react"
import GlassyCard from "@/components/front/courses/GlassyCard"
import type { ProfileFormState } from "../profile-utils"

type ProfileFormCardProps = {
  profileFormMounted: boolean
  profileFormVisible: boolean
  pointsBalance: number
  profileForm: ProfileFormState
  profileComplete: boolean
  profileSaving: boolean
  profileLoading: boolean
  profileError: string | null
  profileSaved: boolean
  userEmail: string
  userPhone: string
  onClose: () => void
  onSave: () => void
  onProfileFieldChange: (field: keyof ProfileFormState, value: string) => void
}

type WizardStep = 0 | 1 | 2

const WIZARD_STEPS = ["Personal information", "Emergency contact", "Billing address"] as const
const FIELD_CLASS = "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-500 dark:border-white/15 dark:text-white/90 dark:placeholder:text-white/40"
const READ_ONLY_FIELD_CLASS = "w-full rounded-md border border-black/15 bg-transparent px-3 py-2 text-sm text-zinc-600 dark:border-white/15 dark:text-white/60"

const hasValue = (value: string) => value.trim().length > 0

const isStepValid = (step: WizardStep, form: ProfileFormState) => {
  if (step === 0) {
    return hasValue(form.firstName) && hasValue(form.lastName) && hasValue(form.birthDate)
  }
  if (step === 1) {
    return hasValue(form.emergencyContactName) &&
      hasValue(form.emergencyContactRelation) &&
      hasValue(form.emergencyContactPhone)
  }

  const billingValues = [
    form.billingLine1,
    form.billingLine2,
    form.billingCity,
    form.billingState,
    form.billingPostalCode,
    form.billingCountry,
  ]
  if (!billingValues.some(hasValue)) return true
  return [
    form.billingLine1,
    form.billingCity,
    form.billingState,
    form.billingPostalCode,
    form.billingCountry,
  ].every(hasValue)
}

type FieldProps = {
  id: string
  label: string
  value: string
  onChange?: (value: string) => void
  type?: React.HTMLInputTypeAttribute
  placeholder?: string
  readOnly?: boolean
  wide?: boolean
}

function ProfileField({ id, label, value, onChange, type = "text", placeholder, readOnly = false, wide = false }: FieldProps) {
  return (
    <fieldset className={`${wide ? "sm:col-span-2" : ""} space-y-1.5 lg:space-y-2`}>
      <label htmlFor={id} className="text-xs font-medium lg:text-sm">{label}</label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={onChange ? (event) => onChange(event.target.value) : undefined}
        readOnly={readOnly}
        placeholder={placeholder}
        className={readOnly ? READ_ONLY_FIELD_CLASS : FIELD_CLASS}
      />
    </fieldset>
  )
}

export function ProfileFormCard({
  profileFormMounted,
  profileFormVisible,
  pointsBalance,
  profileForm,
  profileComplete,
  profileSaving,
  profileLoading,
  profileError,
  profileSaved,
  userEmail,
  userPhone,
  onClose,
  onSave,
  onProfileFieldChange,
}: ProfileFormCardProps) {
  const [activeStep, setActiveStep] = React.useState<WizardStep>(0)

  React.useEffect(() => {
    if (!profileFormVisible) setActiveStep(0)
  }, [profileFormVisible])

  if (!profileFormMounted) return null

  const stepValid = isStepValid(activeStep, profileForm)
  const update = (field: keyof ProfileFormState) => (value: string) => onProfileFieldChange(field, value)

  return (
    <div
      className={`order-1 overflow-hidden transition-all duration-300 ease-out ${
        profileFormVisible ? "max-h-[1600px] translate-y-0 opacity-100" : "max-h-0 -translate-y-2 opacity-0"
      }`}
    >
      <GlassyCard className="relative p-5">
        <div className="lg:hidden">
          <div className="flex items-center justify-between">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Profile</p>
            <div className="flex items-center gap-2">
              <div className="rounded-full border border-[var(--brand,#b61616)]/60 bg-[rgba(182,22,22,0.15)] px-3 py-1 text-xs font-semibold text-[var(--brand,#b61616)] shadow-[0_0_20px_rgba(182,22,22,0.25)]">
                PLI Coins: <span className="text-zinc-900 dark:text-white">{pointsBalance}</span>
              </div>
              <button type="button" onClick={onClose} className="rounded-full border border-black/10 bg-black/[0.05] p-1.5 text-zinc-700 hover:text-zinc-900 dark:border-white/10 dark:bg-black/40 dark:text-white/70 dark:hover:text-white" aria-label="Close">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
          <h3 className="mt-6 text-base font-semibold text-zinc-900 dark:text-white">Complete your profile and earn points</h3>
          <p className="mt-1 text-xs text-zinc-600 dark:text-white/60">By completing your profile, you earn points to redeem benefits.</p>
        </div>

        <div className="hidden flex-wrap items-start justify-between gap-3 lg:flex">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Profile</p>
            <h3 className="mt-2 text-lg font-semibold text-zinc-900 dark:text-white">Complete your profile and earn points</h3>
            <p className="mt-1 text-sm text-zinc-600 dark:text-white/60">By completing your profile, you earn points to redeem benefits.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-[var(--brand,#b61616)]/60 bg-[rgba(182,22,22,0.15)] px-4 py-2 text-sm font-semibold text-[var(--brand,#b61616)] shadow-[0_0_20px_rgba(182,22,22,0.25)]">
              PLI Coins: <span className="text-zinc-900 dark:text-white">{pointsBalance}</span>
            </div>
            <button type="button" onClick={onClose} className="rounded-full border border-black/10 bg-black/[0.05] p-2 text-zinc-700 hover:text-zinc-900 dark:border-white/10 dark:bg-black/40 dark:text-white/70 dark:hover:text-white" aria-label="Close">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div data-profile-wizard className="mt-6">
          <ol className="flex items-center gap-2" aria-label="Profile steps">
            {WIZARD_STEPS.map((label, index) => (
              <li key={label} className="flex flex-1 items-center gap-2" aria-label={`${index + 1}. ${label}`}>
                <span
                  aria-current={index === activeStep ? "step" : undefined}
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold ${
                    index <= activeStep
                      ? "border-[var(--brand,#b61616)] bg-[var(--brand,#b61616)] text-white"
                      : "border-black/15 text-zinc-500 dark:border-white/20 dark:text-white/50"
                  }`}
                >
                  {index + 1}
                </span>
                {index < WIZARD_STEPS.length - 1 && <span className="h-px flex-1 bg-black/10 dark:bg-white/15" />}
              </li>
            ))}
          </ol>

          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--brand,#b61616)]">Step {activeStep + 1} of 3</p>
            <h4 data-current-step className="mt-1 text-base font-semibold text-zinc-900 dark:text-white">{WIZARD_STEPS[activeStep]}</h4>
          </div>

          {activeStep === 0 && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
              <ProfileField id="profile-first-name" label="First name" value={profileForm.firstName} onChange={update("firstName")} placeholder="Your first name" />
              <ProfileField id="profile-last-name" label="Last name" value={profileForm.lastName} onChange={update("lastName")} placeholder="Your last name" />
              <ProfileField id="profile-birthday" label="Birthday" value={profileForm.birthDate} onChange={update("birthDate")} type="date" />
              <ProfileField id="profile-email" label="Email" value={userEmail} readOnly />
              <ProfileField id="profile-phone" label="Phone" value={userPhone} readOnly wide />
            </div>
          )}

          {activeStep === 1 && (
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
              <ProfileField id="profile-emergency-name" label="Name" value={profileForm.emergencyContactName} onChange={update("emergencyContactName")} placeholder="Full name" />
              <ProfileField id="profile-emergency-relation" label="Relationship" value={profileForm.emergencyContactRelation} onChange={update("emergencyContactRelation")} placeholder="Ex: Mother, Father, Friend" />
              <ProfileField id="profile-emergency-phone" label="Emergency contact phone" value={profileForm.emergencyContactPhone} onChange={update("emergencyContactPhone")} placeholder="Number" wide />
            </div>
          )}

          {activeStep === 2 && (
            <div className="mt-4">
              <p className="text-xs text-zinc-600 dark:text-white/60">Optional. Used only for card payments (Stripe). If you start an address, complete all required address fields.</p>
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:gap-4">
                <ProfileField id="profile-billing-line-1" label="Line 1" value={profileForm.billingLine1} onChange={update("billingLine1")} placeholder="Street and number" wide />
                <ProfileField id="profile-billing-line-2" label="Line 2 (optional)" value={profileForm.billingLine2} onChange={update("billingLine2")} placeholder="Apt, floor, unit" wide />
                <ProfileField id="profile-billing-city" label="City" value={profileForm.billingCity} onChange={update("billingCity")} placeholder="City" />
                <ProfileField id="profile-billing-state" label="State" value={profileForm.billingState} onChange={update("billingState")} placeholder="State" />
                <ProfileField id="profile-billing-postal-code" label="ZIP / Postal code" value={profileForm.billingPostalCode} onChange={update("billingPostalCode")} placeholder="ZIP" />
                <ProfileField id="profile-billing-country" label="Country" value={profileForm.billingCountry} onChange={update("billingCountry")} placeholder="Country" />
              </div>
            </div>
          )}

          {!stepValid && (
            <p className="mt-3 text-xs text-amber-700 dark:text-amber-200">
              {activeStep === 2 ? "Complete the billing address or leave every billing field empty." : "Complete the required fields to continue."}
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-black/8 pt-4 dark:border-white/10">
            <div className="text-xs text-zinc-600 dark:text-white/60">
              {profileComplete ? "Profile complete. Keep earning points!" : "Complete your profile to earn 10 points."}
            </div>
            <div className="flex items-center gap-2">
              {activeStep > 0 && (
                <button type="button" onClick={() => setActiveStep((activeStep - 1) as WizardStep)} className="rounded-md border border-black/15 px-4 py-2 text-sm font-semibold text-zinc-800 dark:border-white/20 dark:text-white">
                  Back
                </button>
              )}
              {activeStep < 2 ? (
                <button type="button" onClick={() => setActiveStep((activeStep + 1) as WizardStep)} disabled={!stepValid || profileLoading} className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  Next
                </button>
              ) : (
                <button type="button" onClick={onSave} disabled={!stepValid || profileSaving || profileLoading} className="rounded-md bg-[var(--brand,#b61616)] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {profileSaving ? "Saving..." : "Save profile"}
                </button>
              )}
            </div>
          </div>
        </div>

        {profileError && <p className="mt-2 text-sm text-red-400">{profileError}</p>}
        {profileSaved && !profileError && <p className="mt-2 text-sm text-emerald-300">Profile saved.</p>}
      </GlassyCard>
    </div>
  )
}
