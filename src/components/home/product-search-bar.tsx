"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

// Client Component only because it holds the input's controlled
// value. It doesn't do anything with that value yet (no backend search
// endpoint), but the brief wants working local inputs even for
// UI-only screens.
export function ProductSearchBar() {
  const [query, setQuery] = useState("");

  return (
    <form
      role="search"
      className="flex w-full max-w-md"
      onSubmit={(e) => e.preventDefault()}
    >
      <label htmlFor="product-search" className="sr-only">
        Search by user &amp; order ID
      </label>
      <Input
        id="product-search"
        placeholder="Search by user & order ID"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="rounded-r-none"
      />
      <Button type="submit" className="rounded-l-none" aria-label="Search">
        <Search className="h-4 w-4" />
      </Button>
    </form>
  );
}
