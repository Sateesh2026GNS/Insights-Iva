import { Home, ArrowLeft } from "lucide-react";
import Button from "../components/common/Button";
export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <p className="text-6xl font-bold text-[var(--color-primary)]">404</p>
      <h1 className="mt-4 text-2xl font-bold text-slate-900 dark:text-slate-100">
        Page not found
      </h1>
      <p className="mt-2 max-w-md text-sm text-slate-500 dark:text-slate-400">
        The page you are looking for does not exist or you may not have permission to view it.
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Button variant="primary" to="/" leftIcon={<Home className="h-4 w-4" aria-hidden />}>
          Go to Dashboard
        </Button>
        <Button
          variant="secondary"
          type="button"
          onClick={() => window.history.back()}
          leftIcon={<ArrowLeft className="h-4 w-4" aria-hidden />}
        >
          Go Back
        </Button>
      </div>
    </div>
  );
}
