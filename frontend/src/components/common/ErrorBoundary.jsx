import { Component } from "react";
import { AlertCircle, RefreshCw, Home } from "lucide-react";

import Button from "./Button";

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error) {
    const msg = String(error?.message || "");
    const isDynamicImportError =
      msg.includes("dynamically imported module") ||
      msg.includes("Importing a module script failed") ||
      msg.includes("Failed to fetch dynamically imported module");

    if (isDynamicImportError) {
      const lastRetry = sessionStorage.getItem("chunk_reload_retry");
      const now = Date.now();
      if (!lastRetry || now - Number(lastRetry) > 15000) {
        sessionStorage.setItem("chunk_reload_retry", String(now));
        window.location.reload();
      }
    }
  }

  render() {
    if (this.state.hasError) {
      const msg = String(this.state.error?.message || "");
      const isDynamicImportError =
        msg.includes("dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("Failed to fetch dynamically imported module");

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-900">
          <div className="max-w-md rounded-2xl border border-red-100 bg-white p-8 shadow-xl dark:border-red-900/30 dark:bg-slate-800">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="h-6 w-6 text-red-500" aria-hidden />
            </div>
            <h1 className="text-center text-lg font-bold text-slate-900 dark:text-slate-100">
              {isDynamicImportError ? "App Update Available" : "Something went wrong"}
            </h1>
            <p className="ui-hint mt-2 text-center">
              {isDynamicImportError
                ? "A new version of the application has been published. Please reload the page to load the latest update."
                : "Don't worry — your data is safe. Try reloading or return to the dashboard."}
            </p>
            {this.state.error?.message && !isDynamicImportError && (
              <pre className="mt-4 max-h-24 overflow-auto rounded-lg bg-slate-50 p-3 text-left text-xs text-slate-600 dark:bg-slate-900 dark:text-slate-400">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                variant="primary"
                type="button"
                onClick={() => window.location.reload()}
                className="w-full sm:w-auto"
              >
                <RefreshCw className="h-4 w-4" />
                Reload page
              </Button>
              <a
                href="/"
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600 sm:w-auto"
              >
                <Home className="h-4 w-4" />
                Home
              </a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
