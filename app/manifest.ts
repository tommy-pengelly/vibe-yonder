import type { MetadataRoute } from "next";

// PWA manifest. Dark field + amber, installable, standalone — a calm tool that
// opens like a native app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Yonderful",
    short_name: "Yonderful",
    description:
      "Strava for exploring. Pick a place, wander there with no route — just an arrow and your own two feet.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0b0d",
    theme_color: "#0a0b0d",
    orientation: "portrait",
    categories: ["lifestyle", "travel", "health"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
