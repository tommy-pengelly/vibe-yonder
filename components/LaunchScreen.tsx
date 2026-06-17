"use client";
import { useRouter } from "next/navigation";
import { useGeolocation } from "@/hooks/useGeolocation";
import { primeOrientation } from "@/hooks/useHeading";
import CreateHub from "./CreateHub";

// The landing: the immersive "let's go" launcher. It reuses CreateHub, but
// instead of driving an in-page state machine (that's App at /walk), it stashes
// the start intent and navigates to /walk, where App picks it up via the
// existing `vibe-yonder.start` handoff (same path maps/favourites use). No close
// button, it's home.
export default function LaunchScreen() {
  const router = useRouter();
  const { fix } = useGeolocation(true);
  return (
    <CreateHub
      position={fix}
      onStart={(targets, mode, opts) => {
        // Grab compass permission NOW, while we have the tap (iOS needs a
        // gesture); the walk screen requests it again in an effect where the
        // gesture is gone, so without this the scope wouldn't spin.
        void primeOrientation();
        // A wander with no targets must be flagged ambient, or the /walk handoff
        // ignores it (it only starts on targets.length || play === "ambient").
        const play = opts?.play ?? (targets.length === 0 ? "ambient" : undefined);
        const payload = { targets, mode, ...opts, play };
        try {
          window.sessionStorage.setItem("vibe-yonder.start", JSON.stringify(payload));
        } catch {
          // private mode / quota; the walk will just open to the launcher
        }
        router.push("/walk");
      }}
    />
  );
}
