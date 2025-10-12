"use client"

import { SearchIcon } from "lucide-react";
import Form from "next/form";

const SearchInput = () => {
  return (
    <Form
      className="relative w-full flex-1"
      action="/search"
    >
      <input
        className="w-full rounded-full bg-secondary/80 px-4 py-2 pl-10 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        type="search"
        name="q"
        placeholder="Search Courses..."
        aria-label="Search"
      />
      <SearchIcon className="absolute left-3 top-1/4 h-4 w-5 text-muted-foreground -translate-0" />
    </Form>
  );
};
export default SearchInput;
