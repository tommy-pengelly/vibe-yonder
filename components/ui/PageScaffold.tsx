import type { ReactNode } from "react";

// The member-screen wrapper — one source of truth for page rhythm. The bottom
// nav lives in AppChrome (a sibling, not an overlay), so pages need no extra
// nav padding. NOT for the walk scope, which is a full-bleed borderless void.
export default function PageScaffold({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`flex-1 flex flex-col w-full max-w-md mx-auto px-5 pt-8 pb-10 gap-6 ${className}`}
    >
      {children}
    </div>
  );
}
