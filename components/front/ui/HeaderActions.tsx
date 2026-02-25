"use client"

import DarkModeToggle from "@/components/ui/DarkModeToggle";
import { SignedIn, SignedOut, SignInButton, useUser } from "@clerk/nextjs";
import { BookOpenText, ShoppingCart, Music2, PersonStanding } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/front/ui/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const HeaderActions = ({ className = "" }: { className?: string }) => {
  const { t } = useI18n();
  const { user } = useUser();
  const avatarSrc = user?.imageUrl || user?.externalAccounts?.[0]?.imageUrl;
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
          <span className="hidden md:block text-sm font-medium">Mi perfil</span>
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
