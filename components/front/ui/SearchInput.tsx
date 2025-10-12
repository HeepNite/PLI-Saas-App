"use client"

import {SearchIcon} from "lucide-react";
import Form from "next/form";


const SearchInput = () => {
    return (
        <div className='flex gap-4'>

            <Form
                className="relative w-full flex-1"
                action="/search"
            >
                <input
                    className="w-full rounded-full bg-secondary/80 px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-1 focus:ring-[var(--brand)]"
                    type="search"
                    name="q"
                    placeholder="Search Courses..."
                    aria-label="Search"
                />
                <SearchIcon className="absolute left-3 top-1/4 h-4 w-5 text-[var(--brand)] -translate-0"/>
            </Form>
        </div>
    );
};
export default SearchInput;
