"use client"

import DarkModeToggle from "@/components/ui/DarkModeToggle";
import { SignedIn, SignedOut, SignInButton, UserButton } from "@clerk/nextjs";
import { BookOpenText, ShoppingCart } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import LanguageSwitcher from "@/components/front/ui/LanguageSwitcher";
import { useI18n } from "@/lib/i18n";

const HeaderActions = () => {
  const { t } = useI18n();
  return (
    <nav className="shrink-0 flex items-center justify-end gap-3" aria-label="Quick actions">
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
        <UserButton />
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
