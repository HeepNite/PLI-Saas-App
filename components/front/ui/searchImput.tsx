"use client"

import {SearchIcon} from "lucide-react";
import {useRouter} from "next/navigation";

import {useState, FormEvent} from "react";

const SearchInput = () => {

    const router = useRouter();
    const [searchQuery, setSearchQuery] = useState<string>("")

    const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
        e.preventDefault()

        if (searchQuery.trim()) {
            router.push(`/search/${encodeURIComponent(searchQuery.trim())}`)
        }
    }

    return <form className='relative w-full flex-1'
                 onSubmit={handleSubmit}
    >
        <input
            className='w-full rounded-full bg-secondary/80 px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary'
            type='search'
            placeholder='Search Courses...'
            value={searchQuery}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                setSearchQuery(e.target.value);
            }}
        />
        <SearchIcon className='absolute left-3 top-1/4 h-4 w-5 text-muted-foreground -translate-0'/>
    </form>
}
export default SearchInput
