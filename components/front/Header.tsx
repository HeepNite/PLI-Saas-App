"use client"

import React from "react";
import SearchInput from "@/components/front/ui/SearchInput";
import HeaderLogo from "@/components/front/ui/HeaderLogo";
import HeaderActions from "@/components/front/ui/HeaderActions";
import ButtonForm from "@/components/ui/ButtonForm";

const Header = () => {
    return (
        <header className="sticky top-0 z-50 w-full border-b border-borders bg-background/80 backdrop-blur-sm">
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
                <div className="flex items-center gap-4 py-3">
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
