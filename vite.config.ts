import { fileURLToPath, URL } from "node:url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  // Served from a custom domain (motivescripts.com) at the root, not the
  // /motivescripts/ subpath the bare raffycadano.github.io/motivescripts
  // URL used before -- GitHub Pages redirects that old URL to the custom
  // domain once one is configured, so there's no longer a subpath to serve.
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
