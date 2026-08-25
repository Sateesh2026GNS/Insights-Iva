/** Shared Settings UI primitives — Insights Iva design system */

import {
  ArrowLeft,
  Bell,
  Bot,
  Building2,
  ChevronRight,
  CreditCard,
  Factory,
  FileDigit,
  FileText,
  GitBranch,
  HardDrive,
  Info,
  KeyRound,
  LifeBuoy,
  Moon,
  Package,
  Palette,
  Puzzle,
  Receipt,
  ReceiptText,
  RotateCcw,
  ScrollText,
  Search,
  Settings as SettingsIcon,
  Shield,
  Sun,
  UserRound,
  Users,
  Wallet,
  Workflow,
  X,
} from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router-dom";

import useSettings from "../../context/SettingsContext";
import { filterAccessibleSettingsCategories } from "../../config/permissions";
import useAuth from "../../hooks/useAuth";
import { SearchBar } from "../../components/common/SearchFilter";
import {
  SETTINGS_NAV_GROUPS,
  SETTINGS_CATEGORIES,
  findSettingsCategory,
} from "./settingsCatalog";
import { SETTINGS_ICON } from "./settingsTokens";

const ICON_MAP = {
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
  GitBranch,
  Workflow,
  Wallet,
  FileText,
  Puzzle,
  KeyRound,
  HardDrive,
  ScrollText,
  LifeBuoy,
  Info,
  FileDigit,
  Receipt,
  ReceiptText,
  RotateCcw,
  Settings: SettingsIcon,
};

export function resolveSettingsIcon(name) {
  return ICON_MAP[name] || SettingsIcon;
}

/** Re-export for consumers that import from settingsUi */
export { SETTINGS_ICON };

export function SettingsPageShell({ children }) {
  return (
    <div className="settings-page min-h-full">
      <div className="ui-page">{children}</div>
    </div>
  );
}

export function SettingsHero({ title = "Settings", subtitle, actions, children }) {
  return (
    <div className="ui-card overflow-hidden">
      <div className="settings-hero relative px-5 py-6 sm:px-6 sm:py-7">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <p className="ui-eyebrow">Workspace</p>
            <h1 className="ui-page-title">{title}</h1>
            {subtitle ? <p className="ui-subtitle max-w-xl">{subtitle}</p> : null}
          </div>
          {actions}
        </div>
        {children ? <div className="mt-5">{children}</div> : null}
      </div>
    </div>
  );
}

export function SettingsGroupPanel({ title, children }) {
  return (
    <section className="ui-card overflow-hidden">
      <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-muted)] px-4 py-2.5 sm:px-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {title}
        </h2>
      </div>
      <div className="divide-y divide-[var(--color-border-soft)]">{children}</div>
    </section>
  );
}

export function SettingsListItem({ title, description, icon: Icon, soft, onClick, href }) {
  const chipClass = soft || SETTINGS_ICON.default;
  const inner = (
    <>
      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${chipClass}`}>
        <Icon className="h-[1.125rem] w-[1.125rem]" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-sm font-medium text-[var(--color-text)]">{title}</p>
        {description ? (
          <p className="mt-0.5 line-clamp-1 text-xs text-[var(--color-text-muted)]">{description}</p>
        ) : null}
      </div>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-[var(--color-text-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]"
        aria-hidden
      />
    </>
  );

  const className =
    "group flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[var(--color-surface-muted)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-primary)]/30 sm:px-5";

  if (href) {
    return (
      <Link to={href} className={className}>
        {inner}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {inner}
    </button>
  );
}

export function SettingsCard({ title, description, icon: Icon, soft, onClick }) {
  const chipClass = soft || SETTINGS_ICON.default;
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-3.5 ui-card p-4 text-left transition hover:border-[var(--color-primary)] hover:shadow-[var(--shadow-sm)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${chipClass}`}>
        <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-[var(--color-text)]">{title}</h3>
          <span
            aria-hidden
            className="shrink-0 text-[var(--color-text-faint)] transition group-hover:translate-x-0.5 group-hover:text-[var(--color-primary)]"
          >
            →
          </span>
        </div>
        <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-[var(--color-text-muted)]">
          {description}
        </p>
      </div>
    </button>
  );
}

function buildNavGroups(user) {
  const visible = filterAccessibleSettingsCategories(SETTINGS_CATEGORIES, user);
  const byId = Object.fromEntries(visible.map((c) => [c.id, c]));
  return SETTINGS_NAV_GROUPS.map((g) => ({
    ...g,
    cats: g.ids.map((id) => byId[id]).filter(Boolean),
  })).filter((g) => g.cats.length > 0);
}

function settingsPathForCategory(cat) {
  return cat.href || `/settings/${cat.id}`;
}

function isCategoryActive(cat, pathname) {
  const target = settingsPathForCategory(cat);
  if (pathname === target) return true;
  if (!cat.href && pathname === `/settings/${cat.id}`) return true;
  return false;
}

export function SettingsSidebarNav() {
  const { pathname } = useLocation();
  const { user } = useAuth();
  const groups = buildNavGroups(user);

  return (
    <nav
      aria-label="Settings sections"
      className="ui-card sticky top-[calc(var(--navbar-height,4rem)+0.75rem)] max-h-[calc(100vh-var(--navbar-height,4rem)-2rem)] overflow-y-auto"
    >
      <div className="border-b border-[var(--color-border)] px-3 py-2.5">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-primary)] hover:opacity-80"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All settings
        </Link>
      </div>
      {groups.map((group) => (
        <div key={group.id} className="py-1">
          <p className="px-3 pb-1 pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-[var(--color-text-faint)]">
            {group.title}
          </p>
          <ul>
            {group.cats.map((cat) => {
              const active = isCategoryActive(cat, pathname);
              const Icon = resolveSettingsIcon(cat.icon);
              return (
                <li key={cat.id}>
                  <Link
                    to={settingsPathForCategory(cat)}
                    className={`flex items-center gap-2.5 px-3 py-2 text-[13px] font-medium transition ${
                      active
                        ? "border-l-2 border-[var(--color-primary)] bg-[var(--color-primary-soft)] text-[var(--color-primary)]"
                        : "border-l-2 border-transparent text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-muted)] hover:text-[var(--color-text)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0 opacity-80" aria-hidden />
                    <span className="truncate">{cat.title}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function SettingsMobileNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const current =
    SETTINGS_CATEGORIES.find((c) => isCategoryActive(c, pathname)) ||
    findSettingsCategory(pathname.split("/").pop());

  return (
    <label className="block lg:hidden">
      <span className="sr-only">Jump to settings section</span>
      <select
        value={current?.id || ""}
        onChange={(e) => {
          const cat = findSettingsCategory(e.target.value);
          if (cat) navigate(settingsPathForCategory(cat));
        }}
        className="ui-select w-full text-sm"
      >
        <option value="" disabled>
          Select section…
        </option>
        {buildNavGroups(user).flatMap((g) =>
          g.cats.map((cat) => (
            <option key={cat.id} value={cat.id}>
              {cat.title}
            </option>
          )),
        )}
      </select>
    </label>
  );
}

export function SettingsSectionHeader({ category }) {
  const Icon = resolveSettingsIcon(category.icon);
  const chipClass = category.soft || SETTINGS_ICON.default;

  return (
    <header className="flex items-start gap-4">
      <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${chipClass}`}>
        <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden />
      </div>
      <div className="min-w-0">
        <h1 className="ui-page-title">{category.title}</h1>
        <p className="ui-subtitle mt-0.5 max-w-2xl">{category.description}</p>
      </div>
    </header>
  );
}

export function SettingsBackLink({ to = "/settings", label = "All settings" }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-primary)] transition hover:text-[var(--color-primary-hover)] lg:hidden"
    >
      <ArrowLeft className="h-4 w-4" aria-hidden />
      {label}
    </Link>
  );
}

export function SettingsSearchInput({
  value,
  onChange,
  onClear,
  placeholder = "Search settings…",
  autoFocus = false,
}) {
  return (
    <SearchBar
      value={value}
      onChange={(next) => onChange?.({ target: { value: next } })}
      onClear={onClear}
      placeholder={placeholder}
      autoFocus={autoFocus}
      className="max-w-[22rem]"
    />
  );
}

export function SettingsThemeToggle({ className = "" }) {
  const { theme, updateTheme } = useSettings();
  const isDark = theme === "dark";

  return (
    <div
      className={`inline-flex items-center gap-3 rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-3.5 py-2 shadow-sm ${className}`}
    >
      <Sun
        className={`h-4 w-4 shrink-0 ${isDark ? "text-[var(--color-text-icon)]" : "text-[var(--color-warning)]"}`}
        aria-hidden
      />
      <button
        type="button"
        role="switch"
        aria-checked={isDark}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        onClick={() => updateTheme(isDark ? "light" : "dark")}
        className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 ${
          isDark ? "bg-[var(--color-primary)]" : "bg-[var(--color-border-strong)]"
        }`}
      >
        <span
          className={`pointer-events-none absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            isDark ? "left-[22px]" : "left-0.5"
          }`}
        />
      </button>
      <Moon
        className={`h-4 w-4 shrink-0 ${isDark ? "text-[var(--color-primary)]" : "text-[var(--color-text-icon)]"}`}
        aria-hidden
      />
    </div>
  );
}

export function SettingsSwitch({ checked, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={onChange}
      className={`relative h-[22px] w-[40px] shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/40 ${
        checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-border-strong)]"
      }`}
    >
      <span
        className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow transition-transform ${
          checked ? "left-[20px]" : "left-[2px]"
        }`}
      />
    </button>
  );
}

export function PanelShell({ title, description, children, actions, eyebrow = null }) {
  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0 space-y-1">
          {eyebrow ? <p className="ui-eyebrow text-[var(--color-primary)]">{eyebrow}</p> : null}
          {title ? (
            <h2 className="ui-section-title text-[var(--text-lg)] font-semibold text-[var(--color-text)]">
              {title}
            </h2>
          ) : null}
          {description ? <p className="ui-subtitle mt-0 text-[var(--color-text-muted)]">{description}</p> : null}
        </div>
        {actions ? <div className="ui-toolbar shrink-0">{actions}</div> : null}
      </div>
      {children}
    </div>
  );
}

export function SectionCard({ title, children, className = "" }) {
  return (
    <section className={`ui-card p-5 sm:p-6 ${className}`}>
      {title ? (
        <h2 className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
          {title}
        </h2>
      ) : null}
      {children}
    </section>
  );
}

/** Grid wrapper for settings shortcut links. */
export function SettingsLinkGrid({ children, className = "" }) {
  return <div className={`grid gap-4 sm:grid-cols-2 ${className}`}>{children}</div>;
}

/** Reusable settings shortcut card — internal route links. */
export function SettingsActionLink({ to, title, description, actionLabel = "Open" }) {
  return (
    <Link
      to={to}
      className="ui-card block p-5 transition hover:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]/30"
    >
      <h3 className="text-sm font-semibold text-[var(--color-text)]">{title}</h3>
      {description ? <p className="ui-subtitle mt-1">{description}</p> : null}
      <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-[var(--color-primary)]">
        {actionLabel}
        <ChevronRight className="h-3.5 w-3.5" aria-hidden />
      </span>
    </Link>
  );
}

export function Field({ label, children, className = "" }) {
  return (
    <label className={`block text-sm font-medium text-[var(--color-text-secondary)] ${className}`}>
      {label}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

export { inputClass, inputMtClass, selectClass } from "../../design-system/classes";

export function ToggleRow({ label, description, checked, onChange }) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-[var(--color-border-soft)] px-4 py-3 transition hover:bg-[var(--color-surface-muted)]">
      <span>
        <span className="block text-sm font-medium text-[var(--color-text)]">{label}</span>
        {description ? (
          <span className="mt-0.5 block text-xs text-[var(--color-text-muted)]">{description}</span>
        ) : null}
      </span>
      <SettingsSwitch checked={checked} onChange={() => onChange(!checked)} label={label} />
    </label>
  );
}

export function SkeletonCards({ count = 9 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: Math.ceil(count / 3) }).map((_, gi) => (
        <div key={gi} className="ui-card overflow-hidden">
          <div className="h-9 animate-pulse bg-[var(--color-surface-muted)]" />
          {Array.from({ length: 3 }).map((__, i) => (
            <div
              key={i}
              className="h-14 animate-pulse border-t border-[var(--color-border-soft)] bg-[var(--color-surface)]"
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Shared shell for V2 settings feature pages (invoice, format, sequence, templates) */
export function SettingsFeatureShell({ children }) {
  return (
    <SettingsPageShell>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <aside className="hidden shrink-0 lg:block lg:w-56 xl:w-60">
          <SettingsSidebarNav />
        </aside>
        <div className="min-w-0 flex-1 space-y-5">
          <SettingsMobileNav />
          {children}
        </div>
      </div>
    </SettingsPageShell>
  );
}
