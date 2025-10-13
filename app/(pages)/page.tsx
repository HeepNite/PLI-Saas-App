import React from 'react'
import HeroHome from "@/components/front/ui/HeroHome";
import CoursesMasonry from "@/components/front/ui/CoursesMasonry";
import CreatorsBanner from "@/components/front/ui/CreatorsBanner";

const Page = () => {
    return (
        <div className='min-h-screen bg-background'>
            <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
                <HeroHome/>
            </div>

            <CreatorsBanner/>
            <CoursesMasonry/>
        </div>
    )
}

export default Page