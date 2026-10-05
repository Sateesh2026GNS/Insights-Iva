import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const isStaticAsset = (url) =>
  /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?|ttf|eot|json|map)$/i.test(url);

const apiProxyBypass = (req) => {
  if (req.headers.accept?.includes("text/html")) return "/index.html";
  if (isStaticAsset(req.url)) return false;
  return undefined;
};

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
      // Proxy API requests while bypassing HTML page navigations to SPA index.html and static assets
      "/auth": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/biz": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/ai": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/sales": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/manufacturing": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/accounts": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/inventory": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/procurement": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/production": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/quality": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/maintenance": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/analytics": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/departments": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/hr": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/alerts": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/admin": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/company-settings": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/settings": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/documents": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/dispatch": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/dispatch-addresses": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/meetings": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/work-chat": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/google-calendar": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/iot": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/audit": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/warehouse": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/supply-chain": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/notifications": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/operator": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/dashboard": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/masters": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/ai-assistant": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/tasks": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/sidebar": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/roles": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/permissions": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/users": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/team-directory": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/files": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/integrations": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/business-documents": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/login-history": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/factory-monitor": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/forecasting": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/integration": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/production-scheduling": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/audit-logs": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/rbac": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/platform": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true, bypass: apiProxyBypass },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
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
            if (id.includes("axios")) return "axios";
          }
        },
      },
    },
    chunkSizeWarningLimit: 900,
  },
});
