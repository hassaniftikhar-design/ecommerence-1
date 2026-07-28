import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind class names safely, resolving conflicting utility
 * classes (e.g. "p-2 p-4" -> "p-4") the way shadcn/ui components expect.
 * Every ui/ primitive and composed component uses this instead of
 * string-concatenating classNames directly, so conditional classes never
 * fight with the classes passed in via props.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
