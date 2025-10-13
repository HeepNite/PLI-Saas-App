"use client"

import {Checkbox} from "@/components/ui/checkbox"
import {Label} from "@/components/ui/label"

export default function CheckBoxInput() {
    return (
        <div
            className="flex flex-col gap-2 pr-14">

            <div
                className="flex items-start shadow-sidebar-primary dark:shadow-destructive gap-3  border-black/8 bg-neutral-900/100 transition-all duration-200 dark:border-white/10 dark:bg-white/8 backdrop-blur-md  backdrop-saturate-150 border-2 p-2 rounded-t-lg hover:shadow-md">
                <Checkbox id="terms-1" defaultChecked/>
                <div className="grid gap-2 text-destructive">
                    <Label htmlFor="terms-1">Become a better salsa dancer</Label>
                    <p className="text-card dark:text-card-foreground text-sm">
                        By clicking this checkbox, you agree to the terms and conditions.
                    </p>
                </div>
            </div>

            <div
                className="flex items-start shadow-sidebar-primary dark:shadow-destructive gap-3  border-black/8 bg-neutral-900/100 transition-all duration-200 dark:border-white/10 dark:bg-white/8 backdrop-blur-md  backdrop-saturate-150 border-2 p-2  hover:shadow-md">
                <Checkbox id="terms-2" defaultChecked/>
                <div className="grid gap-2 text-destructive">
                    <Label htmlFor="terms-2">Become a better salsa dancer</Label>
                    <p className="text-card dark:text-card-foreground text-sm">
                        By clicking this checkbox, you agree to the terms and conditions.
                    </p>
                </div>
            </div>
            <div
                className="flex items-start shadow-sidebar-primary dark:shadow-destructive gap-3  border-black/8 bg-neutral-900/100 transition-all duration-200 dark:border-white/10 dark:bg-white/8 backdrop-blur-md  backdrop-saturate-150 border-2 p-2  hover:shadow-md">
                <Checkbox id="terms-3" defaultChecked/>
                <div className="grid gap-2 text-destructive">
                    <Label htmlFor="terms-3">Become a better salsa dancer</Label>
                    <p className="text-card dark:text-card-foreground text-sm">
                        By clicking this checkbox, you agree to the terms and conditions.
                    </p>
                </div>
            </div>
            <div
                className="flex items-start shadow-sidebar-primary dark:shadow-destructive gap-3  border-black/8 bg-neutral-900/100 transition-all duration-200 dark:border-white/10 dark:bg-white/8 backdrop-blur-md  backdrop-saturate-150 border-2 p-2  hover:shadow-md">
                <Checkbox id="terms-4" defaultChecked/>
                <div className="grid gap-2 text-destructive">
                    <Label htmlFor="terms-4">Become a better salsa dancer</Label>
                    <p className="text-card dark:text-card-foreground text-sm">
                        By clicking this checkbox, you agree to the terms and conditions.
                    </p>
                </div>
            </div>
            <div
                className="flex items-start shadow-sidebar-primary dark:shadow-destructive gap-3  border-black/8 bg-neutral-900/100 transition-all duration-200 dark:border-white/10 dark:bg-white/8 backdrop-blur-md  backdrop-saturate-150 border-2 p-2 rounded-b-lg hover:shadow-md">
                <Checkbox id="terms-5" defaultChecked/>
                <div className="grid gap-2 text-destructive">
                    <Label htmlFor="terms-5">Become a better salsa dancer</Label>
                    <p className="text-card dark:text-card-foreground text-sm">
                        By clicking this checkbox, you agree to the terms and conditions.
                    </p>
                </div>
            </div>


        </div>
    )
}
