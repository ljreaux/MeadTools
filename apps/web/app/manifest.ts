import type { MetadataRoute } from "next";

/**
 * Home-screen shortcuts and installs use these square icons. Without them,
 * Android stretched the non-square favicon into its circular icon mask.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MeadTools",
    short_name: "MeadTools",
    description: "The all in one mead, wine, and cider making calculator.",
    start_url: "/",
    // Keep the normal browser UI; this manifest only supplies icons and names.
    display: "browser",
    background_color: "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
