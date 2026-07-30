import Link from "next/link";

import { ROUTES } from "@/constants/routes";

// Standalone so both the home header and (eventually) an auth-area
// header can share the exact same wordmark/link without duplicating
// markup.
export function Logo() {
  return (
    <Link href={ROUTES.home} className="text-sm font-bold leading-6 text-[#343A40] sm:text-base">
      E-commerce
    </Link>
  );
}
