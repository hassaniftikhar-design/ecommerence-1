import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

interface BackHeadingProps {
  title: string;
  href: string;
  /**
   * "primary" (#007bff) is used by Cart and Orders. "navy" (#002050) is
   * used by Order Detail -- sampled directly from each screenshot, they
   * really are two different colors in the source design, not a typo.
   */
  variant?: "primary" | "navy";
}

// Every account-area screen (Cart, Orders, Order Detail) opens with the
// same "<- Big Title" pattern pointing back to the previous screen.
// One component instead of three near-identical <h1>+<Link> pairs.
export function BackHeading({
  title,
  href,
  variant = "primary",
}: BackHeadingProps) {
  return (
    <Link
      href={href}
      className={cn(
        "mb-8 flex items-center gap-3 text-4xl font-semibold",
        variant === "primary" ? "text-primary" : "text-navy",
      )}
    >
      <ArrowLeft className="h-8 w-8" />
      {title}
    </Link>
  );
}
