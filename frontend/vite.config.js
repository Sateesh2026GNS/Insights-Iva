import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on all interfaces so both http://localhost:5173 and http://127.0.0.1:5173 work.
    host: true,
    port: 5173,
    strictPort: false,
    watch: {
      ignored: ["**/node_modules_bak_push/**", "**/dist/**", "**/.git/**"],
    },
    proxy: {
      // Proxy API requests while bypassing HTML page navigations to SPA index.html
      "/auth": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes("text/html") ? "/index.html" : undefined),
      },
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
      "/sales": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes("text/html") ? "/index.html" : undefined),
      },
      "/inventory": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes("text/html") ? "/index.html" : undefined),
      },
      "/procurement": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes("text/html") ? "/index.html" : undefined),
      },
      "/production": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes("text/html") ? "/index.html" : undefined),
      },
      "/tasks": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes("text/html") ? "/index.html" : undefined),
      },
      "/sidebar": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes("text/html") ? "/index.html" : undefined),
      },
      "/platform": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: (req) => (req.headers.accept?.includes("text/html") ? "/index.html" : undefined),
      },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
  },
  build: {
    // Faster minification; esbuild is default in Vite 5 – keep explicit for clarity
    minify: "esbuild",
    // Smaller initial load: split heavy vendors so they cache and load in parallel
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("recharts")) return "recharts";
            if (id.includes("react-dom") || id.includes("react-router")) return "react-vendor";
            if (id.includes("react")) return "react-vendor";
            if (id.includes("i18next") || id.includes("i18n")) return "i18n";
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("xlsx") || id.includes("jspdf") || id.includes("html2canvas"))
              return "export-libs";
            if (id.includes("axios")) return "axios";
          }
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
