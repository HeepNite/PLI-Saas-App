"use client"
import React from 'react'
import { useI18n } from '@/lib/i18n'
import CheckBoxInput from "@/components/front/ui/CheckBoxInput";
import VerticalCarousel from "@/components/front/ui/VerticalCarousel";

const HeroHome = () => {
    const { t } = useI18n()
    return (
        <section className='grid grid-cols-1 md:grid-cols-2 gap-5 w-full'>
            <article className='col-span-1 space-y-3'>
                <h1 className='text-5xl'>{t('hero_title')}</h1>
                <p>
                    {t('hero_subtitle')}
                </p>
                <div className='w-1/5 h-1 bg-[var(--brand)]'/>
            </article>
            <article className='col-span-1 row-span-3'>
                <VerticalCarousel height={560} className="h-auto" />
            </article>
            <article className='col-span-1 row-span-2 space-y-3 max-w-xl mx-auto md:mx-0 text-center md:text-left'>
                <p className="mx-auto md:mx-0 max-w-md">
                {t('hero_question')}
                </p>
                <CheckBoxInput/>
            </article>

        </section>
    )
}
export default HeroHome
