import type { ReactNode } from "react";

import { SiteHeader } from "@/components/home/site-header";

// Every "logged-in area" page (Home, Cart, Orders, Order Detail) shares
// the exact same header + content container in the Figma. Before this
// refactor, HomePage rendered <SiteHeader /> and the max-w-7xl wrapper
// itself; pulling both into this route-group layout means the three
// new pages don't re-declare either, and if the container width or
// header ever changes, it changes once here instead of four times.
export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-[1246px] px-4 py-8 lg:px-0">
  {children}
</main>
    </>
  );
}
