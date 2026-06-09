import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

// shadcn convention: merge conditional + conflicting Tailwind classes.
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
