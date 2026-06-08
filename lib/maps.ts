import type { LatLon } from "./types";

export function externalDirectionsUrl(d: LatLon): string {
  if (typeof navigator === "undefined") {
    return `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}&travelmode=walking`;
  }
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
  return isIOS
    ? `https://maps.apple.com/?daddr=${d.lat},${d.lon}&dirflg=w`
    : `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}&travelmode=walking`;
}
