import type { LatLon } from "./types";

export type DirectionsOption = { id: string; label: string; url: string };

const apple = (d: LatLon) =>
  `https://maps.apple.com/?daddr=${d.lat},${d.lon}&dirflg=w`;
const google = (d: LatLon) =>
  `https://www.google.com/maps/dir/?api=1&destination=${d.lat},${d.lon}&travelmode=walking`;
const citymapper = (d: LatLon) =>
  `https://citymapper.com/directions?endcoord=${d.lat},${d.lon}`;
const osm = (d: LatLon) =>
  `https://www.openstreetmap.org/directions?engine=fossgis_osrm_foot&route=;${d.lat},${d.lon}`;

/**
 * The maps apps to hand off to, the one sanctioned exit ("Just take me
 * there"). Device-native first, then the rest. Always walking directions.
 */
export function directionsOptions(d: LatLon): DirectionsOption[] {
  const opts: DirectionsOption[] = [
    { id: "apple", label: "Apple Maps", url: apple(d) },
    { id: "google", label: "Google Maps", url: google(d) },
    { id: "citymapper", label: "Citymapper", url: citymapper(d) },
    { id: "osm", label: "OpenStreetMap", url: osm(d) },
  ];
  const isIOS =
    typeof navigator !== "undefined" &&
    /iPad|iPhone|iPod|Mac/.test(navigator.userAgent);
  const native = isIOS ? "apple" : "google";
  return opts.sort(
    (a, b) => (a.id === native ? -1 : 0) - (b.id === native ? -1 : 0),
  );
}

/** Back-compat single best-guess URL (device default). */
export function externalDirectionsUrl(d: LatLon): string {
  return directionsOptions(d)[0].url;
}
