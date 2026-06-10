import { Suspense } from "react";
import WaysView from "@/components/WaysView";

export default function WaysPage() {
  return (
    <Suspense fallback={<div className="flex-1" />}>
      <WaysView />
    </Suspense>
  );
}
