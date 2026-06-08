"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Recap from "@/components/Recap";
import { getYonder, pushSaved, updateYonder } from "@/lib/storage";
import type { SavedYonder, Target } from "@/lib/types";

export default function RecapViewer({ id }: { id: string }) {
  const router = useRouter();
  const [yonder, setYonder] = useState<SavedYonder | null>(null);
  const [savedForLater, setSavedForLater] = useState(false);

  useEffect(() => {
    setYonder(getYonder(id));
  }, [id]);

  if (!yonder) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-5 gap-3">
        <p className="text-sm text-[var(--muted)]">Recap not found.</p>
        <Link
          href="/you"
          className="text-sm text-[var(--accent)] hover:opacity-80"
        >
          Back to You
        </Link>
      </div>
    );
  }

  const renameTitle = (name: string) => {
    const next = { ...yonder, name };
    updateYonder(next);
    setYonder(next);
  };

  const doAgain = () => {
    if (typeof window === "undefined") return;
    const targets: Target[] = yonder.destinations.map((d) => ({
      id: crypto.randomUUID(),
      name: d.name,
      label: d.label,
      lat: d.lat,
      lon: d.lon,
      visited: false,
    }));
    window.sessionStorage.setItem(
      "vibe-yonder.start",
      JSON.stringify({
        mode: yonder.mode,
        targets,
        listId: yonder.listId,
        name: yonder.name,
      }),
    );
    router.push("/");
  };

  const saveForLater = () => {
    if (savedForLater) return;
    if (yonder.destinations.length === 1) {
      const d = yonder.destinations[0];
      pushSaved({
        kind: "place",
        refId: yonder.id,
        name: d.name,
        lat: d.lat,
        lon: d.lon,
      });
    } else {
      pushSaved({
        kind: "list",
        refId: yonder.id,
        name: yonder.name,
      });
    }
    setSavedForLater(true);
  };

  return (
    <div className="relative">
      <Link
        href="/you"
        aria-label="Back"
        className="absolute top-6 left-4 z-10 size-9 rounded-full flex items-center justify-center text-[var(--muted)] hover:text-[var(--foreground)]"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
      </Link>
      <Recap
        saved={yonder}
        savedLocally={true}
        savedForLater={savedForLater}
        onRenameTitle={renameTitle}
        onDoAgain={doAgain}
        onSaveForLater={saveForLater}
      />
    </div>
  );
}
