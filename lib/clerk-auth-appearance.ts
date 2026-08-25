export const clerkDarkAuthAppearance = {
  variables: {
    colorPrimary: "#c71818",
    colorBackground: "#13141d",
    colorInputBackground: "rgba(255,255,255,0.04)",
    colorInputText: "#f4f4f5",
    colorText: "#f4f4f5",
    colorTextSecondary: "rgba(244,244,245,0.72)",
    colorDanger: "#ef4444",
    borderRadius: "0.65rem",
    fontFamily: "var(--font-sans, ui-sans-serif, system-ui, sans-serif)",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "w-full shadow-none",
    card: "w-full border border-white/10 bg-[#171922]/95 backdrop-blur rounded-2xl shadow-[0_20px_60px_-25px_rgba(0,0,0,0.65)]",
    headerTitle: "text-white text-3xl font-semibold tracking-tight",
    headerSubtitle: "text-white/70 text-sm",
    socialButtonsIconButton:
      "border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-white rounded-md [&_svg]:text-white [&_svg]:fill-white",
    dividerLine: "bg-white/10",
    dividerText: "text-white/60 text-xs uppercase tracking-[0.25em]",
    formFieldLabel: "text-white/85 text-sm",
    formFieldInput:
      "border border-white/15 bg-white/[0.03] text-white placeholder:text-white/45 rounded-md focus:border-[var(--brand,#b61616)] focus:ring-[var(--brand,#b61616)]/35",
    formFieldInputShowPasswordButton: "text-white/60 hover:text-white",
    formButtonPrimary:
      "bg-[var(--brand,#b61616)] hover:bg-[#d91b1b] text-white rounded-md shadow-[0_10px_30px_-14px_rgba(182,22,22,0.75)]",
    footerActionText: "text-white/65",
    footerActionLink: "text-[var(--brand,#e31b1b)] hover:text-[#ff4f4f] font-medium",
    identityPreviewText: "text-white/75",
    identityPreviewEditButton: "text-[var(--brand,#e31b1b)]",
    alternativeMethodsBlockButton: "text-white/80 hover:bg-white/[0.06]",
    alternativeMethodsBlockButtonText: "text-white/80",
    alternativeMethodsBlockButtonArrow: "text-white/50",
    otpCodeFieldInput:
      "border border-white/30 bg-white/[0.03] text-white text-center text-lg rounded-md focus:border-[var(--brand,#b61616)] focus:ring-[var(--brand,#b61616)]/35",
    alertText: "text-red-300",
    alert: "border border-red-500/30 bg-red-500/10",
  },
} as const

const clerkDarkStaffAppearance = {
  ...clerkDarkAuthAppearance,
  elements: {
    ...clerkDarkAuthAppearance.elements,
    card: "w-full border border-white/10 bg-[#171922]/95 backdrop-blur rounded-2xl shadow-[0_20px_60px_-25px_rgba(0,0,0,0.65)]",
    socialButtonsIconButton:
      "border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-white rounded-md h-12",
    socialButtonsBlockButton:
      "border border-white/15 bg-white/[0.03] hover:bg-white/[0.08] text-white rounded-md h-12",
    socialButtonsProviderIcon: "size-6",
    footerAction: "hidden",
  },
} as const
