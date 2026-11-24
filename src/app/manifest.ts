import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Armario",
    short_name: "Armario",
    description: "Tu armario digital con asesor de estilo.",
    lang: "es",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f1ea",
    theme_color: "#f6f1ea",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
