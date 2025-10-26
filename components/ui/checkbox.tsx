"use client"

import * as React from "react"
import * as CheckboxPrimitive from "@radix-ui/react-checkbox"
import { CheckIcon } from "lucide-react"

import { cn } from "@/lib/utils"

function Checkbox({
  className,
  ...props
}: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
  return (
    <CheckboxPrimitive.Root
      data-slot="checkbox"
      className={cn(
        // Base and size
        "peer size-4 shrink-0 rounded-[4px] border shadow-sm outline-none transition-all",
        // Default/unchecked state (light keeps glass look)
        "border-input bg-white/30 backdrop-blur-sm backdrop-saturate-150 dark:bg-input/30 dark:backdrop-blur-0",
        // Hover glassy effect with slightly more diffused shadow (not 2xl)
        "hover:bg-[var(--brand)]/10 hover:border-[var(--brand)]/50 hover:backdrop-blur-sm hover:backdrop-saturate-150 hover:shadow-lg",
        // Checked state in brand color
        "data-[state=checked]:bg-[var(--brand)] data-[state=checked]:border-[var(--brand)] data-[state=checked]:text-white",
        // Focus ring in brand color
        "focus-visible:ring-[3px] focus-visible:ring-[color:var(--brand)]/40 focus-visible:border-[var(--brand)]",
        // Accessibility/error/disabled
        "aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    >
      <CheckboxPrimitive.Indicator
        data-slot="checkbox-indicator"
        className="flex items-center justify-center text-current transition-none"
      >
        <CheckIcon className="size-3.5" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

export { Checkbox }
