import React from 'react'
import HeroHome from "@/components/front/ui/HeroHome";
import CoursesMasonry from "@/components/front/ui/CoursesMasonry";
import CreatorsBanner from "@/components/front/ui/CreatorsBanner";
import SalsaEventsBanner from "@/components/front/ui/SalsaEventsBanner";
import ClassPricing from "@/components/front/ui/ClassPricing";
import ReviewsSlider from "@/components/front/ui/ReviewsSlider";
import JourneyCtaBanner from "@/components/front/ui/JourneyCtaBanner";
import InspirationShowcase from "@/components/front/ui/InspirationShowcase";

const Page = () => {
    return (
        <div className='min-h-screen bg-background'>
            <div className="mx-auto w-full max-w-screen-xl 2xl:max-w-[2500px] px-4 sm:px-6 lg:px-8 py-8 overflow-x-clip">
                <HeroHome/>
            </div>

            <CreatorsBanner/>
            <CoursesMasonry/>
            <SalsaEventsBanner/>
            <ClassPricing/>
            <ReviewsSlider/>
            <JourneyCtaBanner/>
            <InspirationShowcase/>
        </div>
    )
}

export default Page