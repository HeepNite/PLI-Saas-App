"use client"

import React from "react"
import {Checkbox} from "@/components/ui/checkbox"
import {Label} from "@/components/ui/label"

const intents = [
    { id: "personal-salsa", title: "I want to improve my salsa basics", helper: "Lead/follow, timing, spins, confidence." },
    { id: "personal-style", title: "I want feminine styling and body movement", helper: "Arms, spins, balance, accents." },
    { id: "personal-fitness", title: "I want a latin cardio/fitness class", helper: "Zumba to start the day with energy." },
    { id: "personal-family", title: "I want something for my family/babies", helper: "Music stimulation for little ones." },
    { id: "personal-custom", title: "I need a customized plan (homes, centers, companies)", helper: "Salsa/Zumba adapted · Coming soon" },
]

function CheckBoxItem({
    id,
    title,
    helper,
    rounded,
    checked,
    onChange,
}: {
    id: string;
    title: string;
    helper: string;
    rounded: string;
    checked: boolean;
    onChange: () => void;
}) {
    return (
        <div
            className={`flex items-start shadow-sidebar-primary dark:shadow-destructive gap-3 border-black/8 bg-neutral-900/100 transition-all duration-200 dark:border-white/10 dark:bg-white/8 backdrop-blur-md backdrop-saturate-150 border-2 p-2 hover:shadow-md ${rounded}`}>
            <Checkbox id={id} checked={checked} onCheckedChange={() => onChange()} aria-label={title}/>
            <div
                className="grid gap-2 text-destructive cursor-pointer flex-1"
                onClick={() => onChange()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        onChange()
                    }
                }}
            >
                <div className="flex items-center gap-2">
                    <Label htmlFor={id} className="cursor-pointer">
                        {title}
                    </Label>
                </div>
                <p className="text-card dark:text-card-foreground text-sm hidden sm:block">
                    {helper}
                </p>
            </div>
        </div>
    )
}

export default function CheckBoxInput() {
    const [selected, setSelected] = React.useState<string[]>([])

    const toggle = (id: string) => {
        setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
    }

    const anySelected = selected.length > 0

    return (
        <div className="flex flex-col gap-2 pr-0 md:pr-14 w-full max-w-[460px] mx-auto">
            {intents.map((intent, idx) => {
                const rounded =
                    idx === 0 ? "rounded-t-lg" :
                        idx === intents.length - 1 ? "rounded-b-lg" : ""
                return (
                    <CheckBoxItem
                        key={intent.id}
                        rounded={rounded}
                        checked={selected.includes(intent.id)}
                        onChange={() => toggle(intent.id)}
                        title={intent.title}
                        helper={intent.helper}
                        id={intent.id}
                    />
                )
            })}
            <div className="pt-3 flex justify-center">
                <button
                    type="button"
                    disabled={!anySelected}
                    onClick={() => {
                        if (anySelected) window.location.href = "/programas/personalizacion"
                    }}
                    className={`inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm ${anySelected ? "bg-[var(--brand,#111)] text-white" : "bg-muted text-muted-foreground cursor-not-allowed"}`}
                >
                    Customize my program
                </button>
            </div>
        </div>
    )
}
