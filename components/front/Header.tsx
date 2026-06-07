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

const Header = () => {
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
