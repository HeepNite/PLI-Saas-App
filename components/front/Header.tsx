"use client"

import React from "react";
import SearchInput from "@/components/front/ui/SearchInput";
import HeaderLogo from "@/components/front/ui/HeaderLogo";
import HeaderActions from "@/components/front/ui/HeaderActions";
import ButtonForm from "@/components/ui/ButtonForm";
import Link from "next/link";
import { Menu } from "lucide-react";
import {
    DropDownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/DropDownMenu";

const Header = ({ variant = "default" }: { variant?: "default" | "compact" | "special-event" }) => {
    if (variant === "special-event") {
        return (
            <header data-header-variant="special-event" className="sticky top-[var(--notif-offset,0px)] z-50 w-full border-b border-white/15 bg-black/95 text-[#F8FAFC] backdrop-blur-md">
                <div className="mx-auto flex min-h-16 w-full max-w-screen-xl items-center gap-2 px-3 sm:gap-4 sm:px-6 lg:px-8">
                    <div className="w-10 shrink-0 [&_img]:h-10 [&_img]:w-10 [&_img]:object-contain">
                        <HeaderLogo />
                    </div>
                    <div className="min-w-0 flex-1 lg:mx-auto lg:max-w-xl">
                        <SearchInput placeholder="Search courses..." ariaLabel="Search courses" />
                    </div>
                    <div className="hidden lg:flex">
                        <HeaderActions variant="special-event" />
                    </div>
                    <div className="shrink-0 lg:hidden">
                        <DropDownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label="Open menu"
                                    className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-lg border border-white/20 bg-white/5 text-white outline-none transition-colors duration-200 hover:border-white/35 hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-[#E11D48] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
                                >
                                    <Menu className="h-5 w-5" aria-hidden="true" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={10} className="w-[min(19rem,calc(100vw-1.5rem))] border-white/15 bg-[#09090b] p-3 text-[#F8FAFC]">
                                <DropdownMenuLabel className="text-xs uppercase tracking-[0.18em] text-white/60">
                                    Menu
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="my-2 bg-white/15" />
                                <div className="grid gap-2 text-sm">
                                    <Link href="/courses" className="rounded-lg border border-white/10 px-3 py-2.5 outline-none transition-colors duration-200 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[#E11D48]">
                                        Courses
                                    </Link>
                                    <Link href="/programs/personalization" className="rounded-lg border border-white/10 px-3 py-2.5 outline-none transition-colors duration-200 hover:bg-white/5 focus-visible:ring-2 focus-visible:ring-[#E11D48]">
                                        Programs
                                    </Link>
                                </div>
                                <DropdownMenuSeparator className="my-3 bg-white/15" />
                                <HeaderActions variant="special-event" className="w-full justify-start" />
                            </DropdownMenuContent>
                        </DropDownMenu>
                    </div>
                </div>
            </header>
        )
    }
    if (variant === "compact") {
        return (
            <header className="sticky top-[var(--notif-offset,0px)] z-50 w-full border-b border-borders bg-background/95 backdrop-blur-sm">
                <div className="mx-auto flex min-h-16 w-full max-w-screen-xl items-center justify-between px-4 sm:px-6 lg:px-8">
                    <HeaderLogo />
                    <HeaderActions variant="profile-only" />
                </div>
            </header>
        )
    }

    return (
        <header className="sticky top-[var(--notif-offset,0px)] z-50 w-full border-b border-borders bg-background/80 backdrop-blur-sm">
            <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2 py-2 sm:gap-4 sm:py-3">
                    {/* Left: Logo */}
                    <HeaderLogo />

                    {/* Explore mega menu */}
                    <div className="hidden lg:block">
                        <ButtonForm />
                    </div>

                    {/* Center: Search */}
                    <div className="flex-1 mx-auto max-w-[220px] sm:max-w-sm md:max-w-md lg:max-w-xl">
                        <SearchInput />
                    </div>

                    {/* Right: Actions */}
                    <div className="hidden lg:flex">
                        <HeaderActions />
                    </div>

                    {/* Mobile hamburger */}
                    <div className="ml-auto lg:hidden">
                        <DropDownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    aria-label="Open menu"
                                    className="h-9 w-9 rounded-md border border-white/10 bg-black/40 text-white flex items-center justify-center"
                                >
                                    <Menu className="h-5 w-5" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" sideOffset={10} className="w-[280px] p-3">
                                <DropdownMenuLabel className="text-xs uppercase tracking-wider text-white/60">
                                    Menu
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="my-2" />
                                <div className="grid gap-2 text-sm">
                                    <Link href="/courses" className="rounded-md border border-white/10 px-3 py-2 hover:bg-white/5">
                                        Courses
                                    </Link>
                                    <Link href="/programs/personalization" className="rounded-md border border-white/10 px-3 py-2 hover:bg-white/5">
                                        Programs
                                    </Link>
                                </div>
                                <DropdownMenuSeparator className="my-3" />
                                <HeaderActions className="flex-col items-start gap-2" />
                            </DropdownMenuContent>
                        </DropDownMenu>
                    </div>
                </div>
            </div>
        </header>
    )
}
export default Header
