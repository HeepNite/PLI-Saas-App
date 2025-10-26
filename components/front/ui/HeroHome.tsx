import React from 'react'
import CheckBoxInput from "@/components/front/ui/CheckBoxInput";
import VerticalCarousel from "@/components/front/ui/VerticalCarousel";

const HeroHome = () => {
    return (
        <section className='grid grid-cols-1 md:grid-cols-2 gap-5 w-full'>
            <article className='col-span-1 space-y-3'>
                <h1 className='text-5xl'>Learn from the best, be your best.</h1>
                <p>
                    Get unlimited access to thousands of bite-sized lessons.
                </p>
                <div className='w-1/5 h-1 bg-[var(--brand)]'/>
            </article>
            <article className='col-span-1 row-span-3'>
                <VerticalCarousel height={560} className="h-auto" />
            </article>
            <article className='col-span-1 row-span-2 space-y-3'>
                <p>
                What brings you to Palladium Latin Institute today?
                </p>
                <CheckBoxInput/>
            </article>

        </section>
    )
}
export default HeroHome
