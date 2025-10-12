import Link from "next/link";
import Image from "next/image";
import {Button} from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {Users, MonitorPlay, Music2, Footprints, Sparkles} from "lucide-react";

export default function ButtonForm() {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    className=" bg-transparent text-foreground font-medium text-sm hover:bg-[var(--brand)] hover:text-white transition-colors">
                    Explore
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="start"
                sideOffset={8}
                className="w-[760px] max-h-[80vh] overflow-x-hidden p-0 shadow-2xl border border-border/40 "
            >
                <DropdownMenuLabel className="px-6 pt-5 pb-2 text-xs uppercase tracking-wider text-muted-foreground">
                    CHOOSE THE BEST PATH FOR YOUR CREATIVITY
                </DropdownMenuLabel>
                <DropdownMenuSeparator/>

                {/* Mega menu grid */}
                <div className="grid grid-cols-2 h-full gap-6 p-6">
                    {/* Live Academy */}
                    <section
                        className="rounded-lg border border-white/10 bg-white/60 dark:bg-black/50 backdrop-blur-md text-card-foreground p-5 hover:bg-white/60 dark:hover:bg-black/60 transition-all">
                        <div className="relative mb-4 aspect-[16/9] w-full overflow-hidden rounded-md">
                            <Image
                                src="/images/hero-menu/live-academy.JPG"
                                alt="Live Academy"
                                fill
                                sizes="(max-width: 768px) 100vw, 380px"
                                className="object-cover"
                            />
                        </div>
                        <header className="mb-3 flex items-center gap-2">
                            <Users className="h-4 w-4 text-[var(--brand)]"/>
                            <h3 className="text-sm font-semibold">Live Academy</h3>
                        </header>
                        <p className="mt-1 mb-3 text-xs text-muted-foreground">
                            In‑person classes and experiences with instructors.
                        </p>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <h4 className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Categories</h4>
                                <ul className="space-y-1">
                                    <li>
                                        <Link
                                            href="/"
                                            className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground"
                                        >
                                            <Footprints className="h-4 w-4 text-[var(--brand)]"/>
                                            Dance Courses
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/"
                                            className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground"
                                        >
                                            <Music2 className="h-4 w-4 text-[var(--brand)]"/>
                                            Music Courses
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Levels</h4>
                                <ul className="space-y-1">
                                    <li>
                                        <Link href="/"
                                              className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-accent">
                                            Beginner
                                            <span
                                                className="rounded-full bg-brand-gradient px-2 py-1.5 text-[10px] text-white">Start here</span>
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/"
                                              className="block rounded-md px-2 py-2 hover:bg-accent">
                                            Intermediate
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/"
                                              className="block rounded-md px-2 py-2 hover:bg-accent">
                                            Advanced
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>

                    {/* Virtual Academy */}
                    <section
                        className="rounded-lg border border-white/10 bg-white/60 dark:bg-black/50 backdrop-blur-md text-card-foreground p-5 hover:bg-white/60 dark:hover:bg-black/60 transition-all">
                        <div className="relative mb-4 aspect-[16/9] w-full overflow-hidden rounded-md">
                            <Image
                                src="/images/hero-menu/virtual-academy.JPG"
                                alt="Virtual Academy"
                                fill
                                sizes="(max-width: 768px) 100vw, 380px"
                                className="object-cover"
                            />
                        </div>
                        <header className="mb-3 flex items-center gap-2">
                            <MonitorPlay className="h-4 w-4 text-[var(--brand)]"/>
                            <h3 className="text-sm font-semibold">Virtual Academy</h3>
                        </header>
                        <p className="mt-1 mb-3 text-xs text-muted-foreground">
                            Learn at your own pace with online courses and workshops.
                        </p>

                        <div className="grid grid-cols-2 gap-3 text-sm">
                            <div>
                                <h4 className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Categories</h4>
                                <ul className="space-y-1">
                                    <li>
                                        <Link
                                            href="/"
                                            className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground"
                                        >
                                            <Footprints className="h-4 w-4 text-[var(--brand)]"/>
                                            Dance Courses
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/"
                                            className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-accent hover:text-accent-foreground"
                                        >
                                            <Music2 className="h-4 w-4 text-[var(--brand)]"/>
                                            Music Courses
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                            <div>
                                <h4 className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">Levels</h4>
                                <ul className="space-y-1">
                                    <li>
                                        <Link href="/"
                                              className="flex items-center justify-between rounded-md px-2 py-2 hover:bg-accent">
                                            Beginner
                                            <span
                                                className="rounded-full bg-brand-gradient px-2 py-1.5 text-[10px] text-white">Start here</span>
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/"
                                              className="block rounded-md px-2 py-2 hover:bg-accent">
                                            Intermediate
                                        </Link>
                                    </li>
                                    <li>
                                        <Link href="/"
                                              className="block rounded-md px-2 py-2 hover:bg-accent">
                                            Advanced
                                        </Link>
                                    </li>
                                </ul>
                            </div>
                        </div>
                    </section>
                </div>

                <div className="flex items-center justify-between border-t px-6 py-4 text-xs text-muted-foreground">
                    <span>Not sure where to start? Try a recommended path.</span>
                    <Link href="/" className="inline-flex items-center gap-1 text-foreground hover:underline">
                        <Sparkles className="h-3.5 w-3.5 text-[var(--brand)]"/> Explore paths
                    </Link>
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
