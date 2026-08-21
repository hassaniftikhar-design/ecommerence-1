"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

export function HomeFiltersReset() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (typeof window === "undefined") return;

    const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
    const isReload =
      navEntries.length > 0
        ? navEntries[0]?.type === "reload"
        : (window.performance as unknown as { navigation?: { type?: number } })?.navigation?.type === 1;

    if (isReload && window.location.search) {
      window.history.replaceState(null, "", pathname);
      router.replace(pathname);
    }
  }, [pathname, router]);

  return null;
}
