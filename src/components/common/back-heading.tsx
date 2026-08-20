import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { cn } from "@/lib/utils";

interface BackHeadingProps {
  title: string;
  href: string;

  variant?: "primary" | "navy";
}


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
