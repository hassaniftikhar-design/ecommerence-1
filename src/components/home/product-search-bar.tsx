// "use client";

// import { Search } from "lucide-react";
// import { useState } from "react";

// import { Input } from "@/components/ui/input";
// import { Button } from "@/components/ui/button";

// // Client Component only because it holds the input's controlled
// // value. It doesn't do anything with that value yet (no backend search
// // endpoint), but the brief wants working local inputs even for
// // UI-only screens.
// export function ProductSearchBar() {
//   const [query, setQuery] = useState("");

//   return (
//     <form
//       role="search"
//       className="flex w-full max-w-md"
//       onSubmit={(e) => e.preventDefault()}
//     >
//       <label htmlFor="product-search" className="sr-only">
//         Search by user &amp; order ID
//       </label>
//       <Input
//         id="product-search"
//         placeholder="Search by user & order ID"
//         value={query}
//         onChange={(e) => setQuery(e.target.value)}
//         className="rounded-r-none"
//       />
//       <Button type="submit" className="rounded-l-none" aria-label="Search">
//         <Search className="h-4 w-4" />
//       </Button>
//     </form>
//   );
// }

"use client";

import { Search } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function ProductSearchBar() {
  const [query, setQuery] = useState("");

  return (
    <form
      role="search"
      onSubmit={(e) => e.preventDefault()}
      className="flex h-9 w-[385px] overflow-hidden rounded border border-[#E2E8F0] bg-white"
    >
      <label htmlFor="product-search" className="sr-only">
        Search by user & order ID
      </label>

      <input
        id="product-search"
        type="text"
        placeholder="Search by user & order ID"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="flex-1 border-0 bg-transparent px-4 text-base text-ink placeholder:text-[#9BA2C1] focus:outline-none"
      />

      <Button
  type="submit"
  aria-label="Search"
  className="flex w-10 items-center justify-center rounded-none border-0 border-l border-[#E2E8F0] bg-[#F5F5F5] p-0 hover:bg-[#F5F5F5]"
>
  <Search
    className="h-5 w-5 pb-1  text-[#003B5C]"
    strokeWidth={2.5}
  />
</Button>
    </form>
  );
}