"use client"

import React from "react";
import DarkModeToggle from "@/components/ui/DarkModeToggle";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { BookOpenText, ShoppingCart, Music2, PersonStanding } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/front/ui/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const HeaderActions = ({
  className = "",
  variant = "default",
}: {
  className?: string
  variant?: "default" | "profile-only" | "special-event"
}) => {
  const { t } = useI18n();
  const { user } = useUser();
  const avatarSrc = user?.imageUrl || user?.externalAccounts?.[0]?.imageUrl;
  if (variant === "profile-only") {
    return (
      <nav className={cn("shrink-0 flex items-center justify-end", className)} aria-label="Profile">
        <SignedIn>
          <Link href="/client-profile" className="flex min-h-11 items-center gap-2 rounded-md px-3 py-2 font-medium outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-4 focus-visible:ring-[var(--brand,#b61616)]/35">
            <PersonStanding className="h-5 w-5 text-[var(--brand)]" aria-hidden="true" />
            <span>Profile</span>
          </Link>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Button className="min-h-11 rounded-md border px-4 py-2 text-sm">Profile</Button>
          </SignInButton>
        </SignedOut>
      </nav>
    )
  }
  if (variant === "special-event") {
    return (
      <nav className={cn("flex shrink-0 items-center justify-end", className)} aria-label="Account">
        <SignedIn>
          <Link
            href="/client-profile"
            className="flex min-h-11 items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-3 py-2 text-sm font-semibold text-[#F8FAFC] outline-none transition-colors duration-200 hover:border-white/30 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#E11D48] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
          >
            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/20 bg-white/10">
              {avatarSrc ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSrc} alt="Profile avatar" className="h-full w-full object-cover" />
              ) : (
                <PersonStanding className="h-4 w-4" aria-hidden="true" />
              )}
            </span>
            <span>My profile</span>
          </Link>
        </SignedIn>
        <SignedOut>
          <SignInButton mode="modal">
            <Button className="min-h-11 rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-[#F8FAFC] transition-colors duration-200 hover:border-white/35 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#E11D48] focus-visible:ring-offset-2 focus-visible:ring-offset-black">
              Log in
            </Button>
          </SignInButton>
        </SignedOut>
      </nav>
    )
  }
  return (
    <nav className={cn("shrink-0 flex items-center justify-end gap-3", className)} aria-label="Quick actions">
      <LanguageSwitcher />
      <DarkModeToggle />
      <ShoppingCart className="h-5 w-5 text-[var(--brand)]" />
      <SignedIn>
        <Link href="/" className="flex items-center gap-3">
          <BookOpenText className="h-5 w-5 text-[var(--brand)]" />
          <span className="hidden md:block text-sm font-medium">{t("myCourses")}</span>
        </Link>
      </SignedIn>
      <SignedIn>
        <Link href="/client-profile" className="flex items-center gap-2">
          <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-[var(--brand,#b61616)]/30 text-white">
            {avatarSrc ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarSrc} alt="Avatar" className="h-full w-full object-cover" />
            ) : (
              <>
                <PersonStanding className="h-4.5 w-4.5" />
                <Music2 className="absolute -right-1 -top-1 h-3 w-3 rounded-full bg-[var(--brand,#b61616)] p-[2px] text-white" />
              </>
            )}
          </span>
          <span className="hidden md:block text-sm font-medium">My profile</span>
        </Link>
      </SignedIn>
      <SignedOut>
        <SignInButton mode="modal">
          <Button className="rounded-md border px-3 py-1 text-sm">{t("signIn")}</Button>
        </SignInButton>
      </SignedOut>
    </nav>
  );
};

export default HeaderActions;
