// Shown when there's a position but no compass heading: nudge the user to move
// the phone, with a manual recalibrate fallback.
export default function CalibrateHint({ onCalibrate }: { onCalibrate: () => void }) {
  return (
    <div className="self-center text-center text-xs text-[var(--muted)] max-w-xs pointer-events-auto">
      Point your phone to set direction.
      <button
        type="button"
        onClick={onCalibrate}
        className="block mx-auto mt-1 text-[var(--accent)] hover:opacity-80"
      >
        Tap if it still doesn&apos;t move
      </button>
    </div>
  );
}
