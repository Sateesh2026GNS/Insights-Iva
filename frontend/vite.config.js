import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

import { authProxyBypass } from "./src/utils/authProxyBypass.js";

const API_PROXY_TARGET = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8000";

const isStaticAsset = (url) =>
  /\.(png|jpg|jpeg|gif|svg|webp|ico|css|js|woff2?|ttf|eot|json|map)$/i.test(url);

const apiProxyBypass = (req) => {
  if (req.headers.accept?.includes("text/html")) return "/index.html";
  if (isStaticAsset(req.url)) return req.url;
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
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: authProxyBypass,
      },
      "/api": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/biz": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/ai": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/sales": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/manufacturing": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/accounts": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/inventory": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/procurement": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/production": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/quality": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/maintenance": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/analytics": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/departments": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/hr": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/alerts": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/admin": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/company-settings": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/settings": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/documents": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/dispatch": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/dispatch-addresses": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/meetings": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/work-chat": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/google-calendar": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/iot": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/audit": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/warehouse": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/supply-chain": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/notifications": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/operator": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/dashboard": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/masters": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/ai-assistant": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/tasks": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/sidebar": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/roles": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/permissions": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/users": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/team-directory": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/files": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/integrations": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/business-documents": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/login-history": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/factory-monitor": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/forecasting": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/integration": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/production-scheduling": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/audit-logs": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/rbac": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/platform": {
        target: API_PROXY_TARGET,
        changeOrigin: true,
        bypass: apiProxyBypass,
      },
      "/health": { target: API_PROXY_TARGET, changeOrigin: true, bypass: apiProxyBypass },
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false,
    exclude: ["**/node_modules/**", "**/dist/**", "e2e/**"],
    pool: "forks",
    maxWorkers: 1,
    fileParallelism: false,
    poolOptions: {
      forks: {
        // Child workers default to ~2GB heap; pass the same limit as the npm test script.
        execArgv: ["--max-old-space-size=8192"],
      },
    },
  },
  build: {
    // Do not publish browser source maps in production artifacts
    sourcemap: false,
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
