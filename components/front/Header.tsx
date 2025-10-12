"use client"

import DarkModeToggle from "@/components/ui/DarkModeToggle";
import {SignedIn, SignedOut, UserButton, SignInButton} from "@clerk/nextjs";
import Link from "next/link";
import Image from "next/image";
import {BookmarkIcon} from "lucide-react";
import {Button} from "@/components/ui/button";
import {useTheme} from "next-themes";
import React from "react";
import SearchInput from "@/components/front/ui/searchImput";

const Header = () => {
    const { resolvedTheme } = useTheme();
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const logoSrc = !mounted
        ? "/logo/logo-black.png" // fallback to avoid hydration mismatch; will correct after mount
        : resolvedTheme === "dark"
            ? "/logo/logo-white.png"
            : "/logo/logo-black.png";

    return (
        <header
            className="sticky top-0 z-50 w-full border-b border-borders bg-background/80 backdrop-blur-sm">
            <div className="flex h-4/5 p-4 max-w-full items-center justify-between ">
                <div className="flex items-center gap-3" aria-label="Brand and search">
                    <Link href="/" aria-label="Home" className="shrink-0">
                        <Image src={logoSrc} alt="PLI Logo" width={120} height={120} priority />
                    </Link>

                    <SearchInput/>
                </div>


                <div className="flex items-center gap-3" aria-label="Notifications">
                    Second Container || notifications
                </div>


                <nav className="flex items-center gap-2" aria-label="Quick actions">
                    <SignedIn>
                        <Link href='/my-courses' className='flex items-center gap-2'>
                            <BookmarkIcon className='h-4 w-4'/>
                            <span className='hidden md:block'>My Courses</span>
                        </Link>
                    </SignedIn>
                    <SignedIn>
                        <UserButton/>
                    </SignedIn>
                    <SignedOut>
                        <SignInButton mode="modal">
                            <Button className="rounded-md border px-3 py-1 text-sm">Sign in</Button>
                        </SignInButton>
                    </SignedOut>
                    <span>Cart</span>
                    <span>Fast access</span>
                    <DarkModeToggle/>
                </nav>
            </div>
        </header>
    )
}
export default Header
