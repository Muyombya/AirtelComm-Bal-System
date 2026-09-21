import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "AirtelComm-Bal-System",
        short_name: "AirtelComm Bal",
        description: "Airtel Communication Balancing System",
        theme_color: "#dc2626",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
        scope: "/",
        lang: "en"
      }
    })
  ]
});
