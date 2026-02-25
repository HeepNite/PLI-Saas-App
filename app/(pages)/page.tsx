"use client"
import React, { useRef } from 'react'
import HeroHome from "@/components/front/ui/HeroHome";
import CoursesMasonry from "@/components/front/ui/CoursesMasonry";
import CreatorsBanner from "@/components/front/ui/CreatorsBanner";
import SalsaEventsBanner from "@/components/front/ui/SalsaEventsBanner";
import ReviewsSlider from "@/components/front/ui/ReviewsSlider";
import JourneyCtaBanner from "@/components/front/ui/JourneyCtaBanner";
import InspirationShowcase from "@/components/front/ui/InspirationShowcase";
import PlansMasonry from "@/components/front/ui/PlansMasonry";
import { homeCourseCategories, homeCourses, homeReviewSlides } from "@/constants/home-content";
import CourseEnrollTrigger from "@/components/front/ui/CourseEnrollTrigger";

const Page = () => {
    const enrollRef = useRef<{ open: (slug: string) => void } | null>(null)

    const handleBook = (slug: string) => {
        enrollRef.current?.open(slug)
    }

    return (
        <div className='min-h-screen bg-background'>
            <div
                className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 py-8 overflow-x-clip">
                <HeroHome/>
            </div>

            <CreatorsBanner/>
            <CourseEnrollTrigger ref={enrollRef} />
            <CoursesMasonry categories={homeCourseCategories} courses={homeCourses} onBook={handleBook}/>
            <SalsaEventsBanner/>
            <PlansMasonry/>
            <ReviewsSlider slides={homeReviewSlides}/>
            <JourneyCtaBanner/>
            <InspirationShowcase/>
        </div>
    )
}

export default Page
