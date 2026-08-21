// vite.config.js
import { defineConfig } from "file:///C:/Users/HP%20845%20G7/OneDrive/Desktop/GNS_in/GNS-Insights/frontend/node_modules/vite/dist/node/index.js";
import react from "file:///C:/Users/HP%20845%20G7/OneDrive/Desktop/GNS_in/GNS-Insights/frontend/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///C:/Users/HP%20845%20G7/OneDrive/Desktop/GNS_in/GNS-Insights/frontend/node_modules/@tailwindcss/vite/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Listen on all interfaces so both http://localhost:5173 and http://127.0.0.1:5173 work.
    host: true,
    port: 5173,
    strictPort: false,
    watch: {
      ignored: ["**/node_modules_bak_push/**", "**/dist/**", "**/.git/**"]
    },
    proxy: {
      // Proxy API requests while bypassing static public assets (.png, .jpg, etc.)
      "/auth": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
        bypass(req) {
          if (req.url.match(/\.(png|jpg|jpeg|gif|svg|webp|ico)$/i)) {
            return req.url;
          }
        }
      },
      "/api": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/tasks": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/sidebar": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/platform": { target: "http://127.0.0.1:8000", changeOrigin: true },
      "/health": { target: "http://127.0.0.1:8000", changeOrigin: true }
    }
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./src/test/setup.js",
    css: false
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
        }
      }
    },
    chunkSizeWarningLimit: 900
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxIUCA4NDUgRzdcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxHTlNfaW5cXFxcR05TLUluc2lnaHRzXFxcXGZyb250ZW5kXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ZpbGVuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxIUCA4NDUgRzdcXFxcT25lRHJpdmVcXFxcRGVza3RvcFxcXFxHTlNfaW5cXFxcR05TLUluc2lnaHRzXFxcXGZyb250ZW5kXFxcXHZpdGUuY29uZmlnLmpzXCI7Y29uc3QgX192aXRlX2luamVjdGVkX29yaWdpbmFsX2ltcG9ydF9tZXRhX3VybCA9IFwiZmlsZTovLy9DOi9Vc2Vycy9IUCUyMDg0NSUyMEc3L09uZURyaXZlL0Rlc2t0b3AvR05TX2luL0dOUy1JbnNpZ2h0cy9mcm9udGVuZC92aXRlLmNvbmZpZy5qc1wiO2ltcG9ydCB7IGRlZmluZUNvbmZpZyB9IGZyb20gXCJ2aXRlXCI7XHJcbmltcG9ydCByZWFjdCBmcm9tIFwiQHZpdGVqcy9wbHVnaW4tcmVhY3RcIjtcclxuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gXCJAdGFpbHdpbmRjc3Mvdml0ZVwiO1xyXG5cclxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcclxuICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKV0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICAvLyBMaXN0ZW4gb24gYWxsIGludGVyZmFjZXMgc28gYm90aCBodHRwOi8vbG9jYWxob3N0OjUxNzMgYW5kIGh0dHA6Ly8xMjcuMC4wLjE6NTE3MyB3b3JrLlxyXG4gICAgaG9zdDogdHJ1ZSxcclxuICAgIHBvcnQ6IDUxNzMsXHJcbiAgICBzdHJpY3RQb3J0OiBmYWxzZSxcclxuICAgIHdhdGNoOiB7XHJcbiAgICAgIGlnbm9yZWQ6IFtcIioqL25vZGVfbW9kdWxlc19iYWtfcHVzaC8qKlwiLCBcIioqL2Rpc3QvKipcIiwgXCIqKi8uZ2l0LyoqXCJdLFxyXG4gICAgfSxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgIC8vIFByb3h5IEFQSSByZXF1ZXN0cyB3aGlsZSBieXBhc3Npbmcgc3RhdGljIHB1YmxpYyBhc3NldHMgKC5wbmcsIC5qcGcsIGV0Yy4pXHJcbiAgICAgIFwiL2F1dGhcIjoge1xyXG4gICAgICAgIHRhcmdldDogXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIixcclxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXHJcbiAgICAgICAgYnlwYXNzKHJlcSkge1xyXG4gICAgICAgICAgaWYgKHJlcS51cmwubWF0Y2goL1xcLihwbmd8anBnfGpwZWd8Z2lmfHN2Z3x3ZWJwfGljbykkL2kpKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXEudXJsO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICAgIFwiL2FwaVwiOiB7IHRhcmdldDogXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIiwgY2hhbmdlT3JpZ2luOiB0cnVlIH0sXHJcbiAgICAgIFwiL3Rhc2tzXCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcclxuICAgICAgXCIvc2lkZWJhclwiOiB7IHRhcmdldDogXCJodHRwOi8vMTI3LjAuMC4xOjgwMDBcIiwgY2hhbmdlT3JpZ2luOiB0cnVlIH0sXHJcbiAgICAgIFwiL3BsYXRmb3JtXCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcclxuICAgICAgXCIvaGVhbHRoXCI6IHsgdGFyZ2V0OiBcImh0dHA6Ly8xMjcuMC4wLjE6ODAwMFwiLCBjaGFuZ2VPcmlnaW46IHRydWUgfSxcclxuICAgIH0sXHJcbiAgfSxcclxuICB0ZXN0OiB7XHJcbiAgICBlbnZpcm9ubWVudDogXCJqc2RvbVwiLFxyXG4gICAgZ2xvYmFsczogdHJ1ZSxcclxuICAgIHNldHVwRmlsZXM6IFwiLi9zcmMvdGVzdC9zZXR1cC5qc1wiLFxyXG4gICAgY3NzOiBmYWxzZSxcclxuICB9LFxyXG4gIGJ1aWxkOiB7XHJcbiAgICAvLyBGYXN0ZXIgbWluaWZpY2F0aW9uOyBlc2J1aWxkIGlzIGRlZmF1bHQgaW4gVml0ZSA1IFx1MjAxMyBrZWVwIGV4cGxpY2l0IGZvciBjbGFyaXR5XHJcbiAgICBtaW5pZnk6IFwiZXNidWlsZFwiLFxyXG4gICAgLy8gU21hbGxlciBpbml0aWFsIGxvYWQ6IHNwbGl0IGhlYXZ5IHZlbmRvcnMgc28gdGhleSBjYWNoZSBhbmQgbG9hZCBpbiBwYXJhbGxlbFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3MoaWQpIHtcclxuICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcIm5vZGVfbW9kdWxlc1wiKSkge1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJyZWNoYXJ0c1wiKSkgcmV0dXJuIFwicmVjaGFydHNcIjtcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwicmVhY3QtZG9tXCIpIHx8IGlkLmluY2x1ZGVzKFwicmVhY3Qtcm91dGVyXCIpKSByZXR1cm4gXCJyZWFjdC12ZW5kb3JcIjtcclxuICAgICAgICAgICAgaWYgKGlkLmluY2x1ZGVzKFwicmVhY3RcIikpIHJldHVybiBcInJlYWN0LXZlbmRvclwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJpMThuZXh0XCIpIHx8IGlkLmluY2x1ZGVzKFwiaTE4blwiKSkgcmV0dXJuIFwiaTE4blwiO1xyXG4gICAgICAgICAgICBpZiAoaWQuaW5jbHVkZXMoXCJsdWNpZGUtcmVhY3RcIikpIHJldHVybiBcImljb25zXCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcInhsc3hcIikgfHwgaWQuaW5jbHVkZXMoXCJqc3BkZlwiKSB8fCBpZC5pbmNsdWRlcyhcImh0bWwyY2FudmFzXCIpKVxyXG4gICAgICAgICAgICAgIHJldHVybiBcImV4cG9ydC1saWJzXCI7XHJcbiAgICAgICAgICAgIGlmIChpZC5pbmNsdWRlcyhcImF4aW9zXCIpKSByZXR1cm4gXCJheGlvc1wiO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICB9LFxyXG4gICAgY2h1bmtTaXplV2FybmluZ0xpbWl0OiA5MDAsXHJcbiAgfSxcclxufSk7XHJcbiJdLAogICJtYXBwaW5ncyI6ICI7QUFBc1ksU0FBUyxvQkFBb0I7QUFDbmEsT0FBTyxXQUFXO0FBQ2xCLE9BQU8saUJBQWlCO0FBRXhCLElBQU8sc0JBQVEsYUFBYTtBQUFBLEVBQzFCLFNBQVMsQ0FBQyxNQUFNLEdBQUcsWUFBWSxDQUFDO0FBQUEsRUFDaEMsUUFBUTtBQUFBO0FBQUEsSUFFTixNQUFNO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixZQUFZO0FBQUEsSUFDWixPQUFPO0FBQUEsTUFDTCxTQUFTLENBQUMsK0JBQStCLGNBQWMsWUFBWTtBQUFBLElBQ3JFO0FBQUEsSUFDQSxPQUFPO0FBQUE7QUFBQSxNQUVMLFNBQVM7QUFBQSxRQUNQLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxRQUNkLE9BQU8sS0FBSztBQUNWLGNBQUksSUFBSSxJQUFJLE1BQU0scUNBQXFDLEdBQUc7QUFDeEQsbUJBQU8sSUFBSTtBQUFBLFVBQ2I7QUFBQSxRQUNGO0FBQUEsTUFDRjtBQUFBLE1BQ0EsUUFBUSxFQUFFLFFBQVEseUJBQXlCLGNBQWMsS0FBSztBQUFBLE1BQzlELFVBQVUsRUFBRSxRQUFRLHlCQUF5QixjQUFjLEtBQUs7QUFBQSxNQUNoRSxZQUFZLEVBQUUsUUFBUSx5QkFBeUIsY0FBYyxLQUFLO0FBQUEsTUFDbEUsYUFBYSxFQUFFLFFBQVEseUJBQXlCLGNBQWMsS0FBSztBQUFBLE1BQ25FLFdBQVcsRUFBRSxRQUFRLHlCQUF5QixjQUFjLEtBQUs7QUFBQSxJQUNuRTtBQUFBLEVBQ0Y7QUFBQSxFQUNBLE1BQU07QUFBQSxJQUNKLGFBQWE7QUFBQSxJQUNiLFNBQVM7QUFBQSxJQUNULFlBQVk7QUFBQSxJQUNaLEtBQUs7QUFBQSxFQUNQO0FBQUEsRUFDQSxPQUFPO0FBQUE7QUFBQSxJQUVMLFFBQVE7QUFBQTtBQUFBLElBRVIsZUFBZTtBQUFBLE1BQ2IsUUFBUTtBQUFBLFFBQ04sYUFBYSxJQUFJO0FBQ2YsY0FBSSxHQUFHLFNBQVMsY0FBYyxHQUFHO0FBQy9CLGdCQUFJLEdBQUcsU0FBUyxVQUFVLEVBQUcsUUFBTztBQUNwQyxnQkFBSSxHQUFHLFNBQVMsV0FBVyxLQUFLLEdBQUcsU0FBUyxjQUFjLEVBQUcsUUFBTztBQUNwRSxnQkFBSSxHQUFHLFNBQVMsT0FBTyxFQUFHLFFBQU87QUFDakMsZ0JBQUksR0FBRyxTQUFTLFNBQVMsS0FBSyxHQUFHLFNBQVMsTUFBTSxFQUFHLFFBQU87QUFDMUQsZ0JBQUksR0FBRyxTQUFTLGNBQWMsRUFBRyxRQUFPO0FBQ3hDLGdCQUFJLEdBQUcsU0FBUyxNQUFNLEtBQUssR0FBRyxTQUFTLE9BQU8sS0FBSyxHQUFHLFNBQVMsYUFBYTtBQUMxRSxxQkFBTztBQUNULGdCQUFJLEdBQUcsU0FBUyxPQUFPLEVBQUcsUUFBTztBQUFBLFVBQ25DO0FBQUEsUUFDRjtBQUFBLE1BQ0Y7QUFBQSxJQUNGO0FBQUEsSUFDQSx1QkFBdUI7QUFBQSxFQUN6QjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
