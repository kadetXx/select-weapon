import { defineConfig } from "vite";

// GitHub Pages serves this app from a /select-weapon/ subpath; every other
// host (Brimble, Vercel, a custom domain) serves it from root, so the base
// path can't be hardcoded -- GH_PAGES=true opts into the subpath build.
export default defineConfig({
  base: process.env.GH_PAGES ? "/select-weapon/" : "/",
  build: {
    sourcemap: true,
  },
});
