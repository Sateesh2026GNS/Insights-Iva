import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Bell,
  Bot,
  Building2,
  CreditCard,
  Factory,
  FileText,
  HardDrive,
  Info,
  KeyRound,
  LifeBuoy,
  Moon,
  Package,
  Palette,
  Puzzle,
  ScrollText,
  Search,
  Settings,
  Shield,
  Sun,
  Users,
  UserRound,
  Wallet,
  Workflow,
  X,
} from "lucide-react";

import useSettings from "../../context/SettingsContext";
import { searchSettingsCategories } from "./settingsCatalog";
import { SettingsCard, SkeletonCards } from "./settingsUi";

const ICONS = {
  UserRound,
  Building2,
  Users,
  Shield,
  CreditCard,
  Bot,
  Bell,
  Palette,
  Package,
  Factory,
  Workflow,
  Wallet,
  FileText,
  Puzzle,
  KeyRound,
  HardDrive,
  ScrollText,
  LifeBuoy,
  Info,
};

/** Visual groups for the settings home (ids must match settingsCatalog). */
const SETTINGS_GROUPS = [
  {
    id: "account",
    title: "Account & access",
    ids: ["my-account", "company", "users", "security", "subscription"],
  },
  {
    id: "workspace",
    title: "Workspace preferences",
    ids: ["ai", "notifications", "appearance"],
  },
  {
    id: "operations",
    title: "Operations",
    ids: ["inventory", "production", "role-workflow", "finance", "documents"],
  },
  {
    id: "system",
    title: "System & support",
    ids: ["integrations", "api", "backup", "audit", "help", "about"],
  },
];

function ThemeModeToggle() {
  const { theme, updateTheme } = useSettings();
  const isDark = theme === "dark";

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-3.5 py-2 shadow-sm dark:border-slate-600 dark:bg-slate-800">
      <Sun
        className={`h-4 w-4 shrink-0 ${isDark ? "text-slate-400 dark:text-slate-500" : "text-amber-500"}`}
        aria-hidden
      />
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => updateTheme(isDark ? "light" : "dark")}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 ${
          isDark ? "bg-blue-500" : "bg-slate-300 dark:bg-slate-600"
        }`}
      >
        <span
          className={`pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            isDark ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
      <Moon
        className={`h-4 w-4 shrink-0 ${isDark ? "text-blue-400" : "text-slate-400 dark:text-slate-500"}`}
        aria-hidden
      />
    </div>
  );
}

export default function SettingsHome() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [ready] = useState(true);

  const results = useMemo(() => searchSettingsCategories(query), [query]);
  const byId = useMemo(() => Object.fromEntries(results.map((c) => [c.id, c])), [results]);
  const isSearching = Boolean(query.trim());

  const groups = useMemo(() => {
    if (isSearching) {
      return results.length
        ? [{ id: "search", title: `${results.length} result${results.length === 1 ? "" : "s"}`, cats: results }]
        : [];
    }
    return SETTINGS_GROUPS.map((g) => ({
      ...g,
      cats: g.ids.map((id) => byId[id]).filter(Boolean),
    })).filter((g) => g.cats.length > 0);
  }, [byId, isSearching, results]);

  if (!ready) return <SkeletonCards />;

  return (
    <div className="mx-auto max-w-5xl space-y-7">
      <header className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="ui-eyebrow">
              System
            </p>
            <p className="ui-subtitle dark:text-slate-400">
              Company, users, security, and system preferences.
            </p>
          </div>
          <ThemeModeToggle />
        </div>

        <div className="relative ui-search-wrap">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search settings…"
            className="ui-input w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 shadow-sm placeholder-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
            autoFocus
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </header>

      {groups.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-12 text-center shadow-[0_1px_2px_rgba(15,23,42,0.04)] dark:border-slate-600 dark:bg-slate-800/40">
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
            No settings match “{query}”
          </p>
          <p className="mt-1 text-xs text-slate-500">Try users, password, GST, or subscription.</p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 text-sm font-semibold text-[var(--color-success)] hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-7">
          {groups.map((group) => (
            <section key={group.id} className="space-y-3">
              <h2 className="ui-eyebrow">
                {group.title}
              </h2>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.cats.map((cat) => {
                  const Icon = ICONS[cat.icon] || Settings;
                  return (
                    <SettingsCard
                      key={cat.id}
                      title={cat.title}
                      description={cat.description}
                      icon={Icon}
                      soft={cat.soft}
                      onClick={() => navigate(cat.href || `/settings/${cat.id}`)}
                    />
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
