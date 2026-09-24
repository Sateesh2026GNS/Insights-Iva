import { Component } from "react";
import { AlertCircle, RefreshCw, Home, ChevronDown, ChevronUp } from "lucide-react";

import Button from "./Button";

export default class ErrorBoundary extends Component {
  state = { hasError: false, error: null, showDetails: false };

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidUpdate(prevProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false, error: null, showDetails: false });
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an uncaught runtime error:", error, errorInfo);
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

  handleReset = () => {
    this.setState({ hasError: false, error: null, showDetails: false });
  };

  render() {
    if (this.state.hasError) {
      const msg = String(this.state.error?.message || "");
      const isDynamicImportError =
        msg.includes("dynamically imported module") ||
        msg.includes("Importing a module script failed") ||
        msg.includes("Failed to fetch dynamically imported module");

      return (
        <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4 dark:bg-slate-900">
          <div className="w-full max-w-lg rounded-2xl border border-red-100 bg-white p-6 shadow-xl dark:border-red-900/30 dark:bg-slate-800 sm:p-8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-50 dark:bg-red-900/20">
              <AlertCircle className="h-6 w-6 text-red-500" aria-hidden />
            </div>
            <h1 className="text-center text-lg font-bold text-slate-900 dark:text-slate-100">
              {isDynamicImportError ? "App Update Available" : "Something went wrong"}
            </h1>
            <p className="ui-hint mt-2 text-center text-sm">
              {isDynamicImportError
                ? "A new version of the application has been published. Please reload the page to load the latest update."
                : "Don't worry — your data is safe. Try reloading or return to the dashboard."}
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <Button
                variant="primary"
                type="button"
                onClick={this.handleReset}
                className="w-full sm:w-auto"
              >
                Try again
              </Button>
              <Button
                variant="outline"
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

            {/* Collapsible Error Details for debugging */}
            {this.state.error?.message ? (
              <div className="mt-6 border-t border-slate-200 pt-4 dark:border-slate-700">
                <button
                  type="button"
                  onClick={() => this.setState((s) => ({ showDetails: !s.showDetails }))}
                  className="flex w-full items-center justify-between text-left text-xs font-semibold text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  <span>Error Details</span>
                  {this.state.showDetails ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </button>
                {this.state.showDetails ? (
                  <div className="mt-2 max-h-40 overflow-y-auto rounded-lg bg-slate-900 p-3 text-xs font-mono text-red-300">
                    <p className="font-semibold text-red-400">{this.state.error.message}</p>
                    {this.state.error.stack ? (
                      <pre className="mt-2 whitespace-pre-wrap text-[11px] opacity-80">
                        {this.state.error.stack}
                      </pre>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

