"use client";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Recap from "@/components/Recap";
import { useAuthUser } from "@/lib/auth";
import { getYonder, saveYonderPlaces, updateYonder } from "@/lib/data";
import type { Destination, SavedYonder, Target } from "@/lib/types";

export default function RecapViewer({ id }: { id: string }) {
  const router = useRouter();
  const { user } = useAuthUser();
  const [yonder, setYonder] = useState<SavedYonder | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [savedForLater, setSavedForLater] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getYonder(id).then((y) => {
      if (cancelled) return;
      setYonder(y);
      setLoaded(true);
    });
    return () => {
      cancelled = true;
    };
  }, [id, user]);

  if (!yonder) {
    if (!loaded) {
      return <div className="flex-1" />;
    }
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
    setYonder(next);
    void updateYonder(next);
  };

  const editCaption = (caption: string) => {
    const next = { ...yonder, caption };
    setYonder(next);
    void updateYonder(next);
  };

  const editPlaces = (destinations: Destination[]) => {
    const next = { ...yonder, destinations };
    setYonder(next);
    void updateYonder(next);
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
        mapId: yonder.mapId,
        name: yonder.name,
      }),
    );
    router.push("/walk");
  };

  const saveForLater = () => {
    if (savedForLater) return;
    setSavedForLater(true);
    void saveYonderPlaces(yonder.name, yonder.destinations);
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
        onSaveCaption={editCaption}
        onSavePlaces={editPlaces}
      />
    </div>
  );
}
