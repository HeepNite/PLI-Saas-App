"use client"

import React from "react";
import SearchInput from "@/components/front/ui/SearchInput";
import HeaderLogo from "@/components/front/ui/HeaderLogo";
import HeaderActions from "@/components/front/ui/HeaderActions";
import ButtonForm from "@/components/ui/ButtonForm";

const Header = () => {
    return (
        <header className="sticky top-[var(--notif-offset,0px)] z-50 w-full border-b border-borders bg-background/80 backdrop-blur-sm">
            <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-2 py-2 sm:gap-4 sm:py-3">
                    {/* Left: Logo */}
                    <HeaderLogo />

                    {/* Explore mega menu */}
                    <ButtonForm />

                    {/* Center: Search */}
                    <div className="flex-1 mx-auto max-w-xl">
                        <SearchInput />
                    </div>

                    {/* Right: Actions */}
                    <HeaderActions />
                </div>
            </div>
        </header>
    )
}
export default Header
