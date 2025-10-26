import Image from "next/image"
import React from "react"

// Banner mosaic inspired by the provided reference image.
// Uses images from /public/images/carousel and interleaves large text blocks.
// Light applies a subtle glass look; dark keeps current site aesthetic.

const carouselImages: string[] = [
    "/images/carousel/_DSC0998.JPG",
    "/images/carousel/_DSC1076.JPG",
    "/images/carousel/_DSC1079.JPG",
    "/images/carousel/_DSC1087.JPG",
    "/images/carousel/_DSC1090.JPG",
]

function CardImage({src, alt}: { src: string; alt: string }) {
    return (
        <figure
            className="relative w-full h-[150px] md:h-30 lg:h-60 overflow-hidden rounded-xl border bg-white/70 dark:bg-neutral-900/70 backdrop-blur-md backdrop-saturate-150 border-black/5 dark:border-white/10 shadow-sm">
            <Image src={src} alt={alt} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw"/>
        </figure>
    )
}

function TextBlock({children, className = ""}: { children: React.ReactNode; className?: string }) {
    return (
        <div
            className={`flex items-center justify-center rounded-xl dark:bg-transparent backdrop-blur-md dark:backdrop-blur-0 border-black/5 dark:border-transparent ${className}`}>
            <div className="px-3 py-1">
                {children}
            </div>
        </div>
    )
}

export default function CreatorsBanner() {
    const imgs = [...carouselImages, ...carouselImages] // if we need more tiles

    return (
        <section className="w-full mt-[200px] mb-6 md:mb-10">
            <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 overflow-x-clip">
                {/* Mobile heading (top) */}
                <div className="md:hidden text-center py-2">
                    <p className="text-3xl font-extrabold leading-none">150K+</p>
                    <p className="text-3xl font-extrabold leading-none">creators</p>
                    <p className="text-3xl font-extrabold leading-none">choose <span className="text-[var(--brand)]">PLI</span></p>
                </div>
                <div
                    className="grid grid-cols-2 md:grid-cols-12 gap-x-3 gap-y-2 md:gap-x-3 md:gap-y-6 [--h:150px] md:[--h:110px] lg:[--h:230px]"
                    style={{gridAutoRows: "var(--h)"}}>
                    {/* Row 1 */}
                    <div className="md:col-span-3 row-span-1">
                        <CardImage src={imgs[0]} alt="carousel 1"/>
                    </div>
                    <div className="hidden self-center md:block md:col-span-3 row-span-1">
                        <TextBlock>
                            <p className="text-6xl lg:text-8xl uppercase font-extrabold tracking-tight leading-none">150+</p>
                        </TextBlock>
                    </div>
                    <div className="md:col-span-3 row-span-1">
                        <CardImage src={imgs[1]} alt="carousel 2"/>
                    </div>
                    <div className="md:col-span-3 row-span-1">
                        <CardImage src={imgs[2]} alt="carousel 3"/>
                    </div>

                    {/* Row 2 */}
                    <div className="md:col-span-4 row-span-1">
                        <CardImage src={imgs[3]} alt="carousel 4"/>
                    </div>
                    <div className="hidden self-center md:block md:col-span-4 row-span-1">
                        <TextBlock>
                            <p className="md:text-7xl 2xl:text-8xl uppercase font-extrabold tracking-tight leading-none">Students</p>
                        </TextBlock>
                    </div>
                    <div className="md:col-span-4 row-span-1">
                        <CardImage src={imgs[4]} alt="carousel 5"/>
                    </div>

                    {/* Row 3 */}
                    <div className="md:col-span-3 row-span-1">
                        <CardImage src={imgs[5]} alt="carousel 6"/>
                    </div>
                    <div className="hidden md:block md:col-span-3 row-span-1">
                        <CardImage src={imgs[6]} alt="carousel 7"/>
                    </div>
                    <div className="hidden self-center md:block md:col-span-6 row-span-1">
                        <TextBlock>
                            <p className="md:text-8xl 2xl:text-8xl uppercase font-extrabold tracking-tight leading-none text-right">
                                choose <span className="text-[var(--brand)]">PLI</span>
                            </p>
                        </TextBlock>
                    </div>

                    {/* Mobile heading (stacked) */}
                    <div className="hidden">
                        {/* moved to top */}
                    </div>
                </div>
            </div>
        </section>
    )
}
