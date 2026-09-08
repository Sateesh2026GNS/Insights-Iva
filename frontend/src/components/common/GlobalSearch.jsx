import { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  BarChart3,
  Bell,
  Boxes,
  CheckCircle2,
  Factory,
  FolderOpen,
  Landmark,
  Layers,
  LayoutDashboard,
  Loader2,
  Search,
  SearchX,
  Settings,
  ShoppingCart,
  Users,
  Wallet,
  Wrench,
} from "lucide-react";

import useAuth from "../../hooks/useAuth";
import useDebouncedValue from "../../hooks/useDebouncedValue";
import { userCanAccessPath } from "../../config/permissions";
import { flattenNavForSearch } from "../../config/sidebarNav";
import {
  NAVBAR_SEARCH_INPUT_CLASS,
  NAVBAR_SEARCH_WRAP_CLASS,
  SearchBar,
} from "./SearchFilter";
import "../../styles/global-search.css";

const DEBOUNCE_MS = 200;

const EXTRA_ROUTES = [
  { path: "/alerts", labelKey: "nav.allAlerts", module: "alerts", sectionKey: null },
  {
    path: "/production/reports",
    labelKey: "nav.dailyProductionReports",
    module: "production",
    sectionKey: "erpNav.production",
  },
  { path: "/settings", labelKey: "erpNav.settings", module: "admin", sectionKey: null },
  { path: "/settings/appearance", label: "Appearance", module: "settings", sectionKey: "erpNav.settings" },
  { path: "/sales/job-cards/create", label: "Create Job Card", module: "sales", sectionKey: null },
];

const MODULE_META = {
  dashboard: { label: "Dashboard", Icon: LayoutDashboard },
  production: { label: "Production", Icon: Factory },
  factoryMonitor: { label: "Factory Monitor", Icon: Factory },
  inventory: { label: "Inventory", Icon: Boxes },
  procurement: { label: "Procurement", Icon: ShoppingCart },
  purchases: { label: "Purchases", Icon: ShoppingCart },
  sales: { label: "Sales", Icon: Wallet },
  hr: { label: "HR", Icon: Users },
  attendance: { label: "Attendance", Icon: Users },
  quality: { label: "Quality", Icon: CheckCircle2 },
  maintenance: { label: "Maintenance", Icon: Wrench },
  alerts: { label: "Alerts", Icon: Bell },
  documents: { label: "Documents", Icon: FolderOpen },
  analytics: { label: "Analytics", Icon: BarChart3 },
  finance: { label: "Finance", Icon: Landmark },
  accounts: { label: "Accounts", Icon: Landmark },
  admin: { label: "Administration", Icon: Settings },
  settings: { label: "Settings", Icon: Settings },
  masters: { label: "Masters", Icon: Layers },
};

function looksLikeTranslationKey(value) {
  return typeof value === "string" && /^[a-z][\w-]*(\.[\w-]+)+$/i.test(value.trim());
}

function humanizeToken(value = "") {
  const token = String(value)
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
  if (!token) return "";
  return token
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function safeTranslate(t, key) {
  if (!key || typeof key !== "string") return "";
  const translated = t(key);
  if (!translated || translated === key || looksLikeTranslationKey(translated)) return "";
  return translated;
}

function routeLabel(route, t) {
  const translated = safeTranslate(t, route.labelKey);
  if (translated) return translated;
  if (route.label && !looksLikeTranslationKey(route.label)) return route.label;
  if (route.labelKey) return humanizeToken(route.labelKey.split(".").pop());
  if (route.path === "/") return "Dashboard";
  return humanizeToken(route.path.split("/").filter(Boolean).pop());
}

function routeSectionLabel(route, t) {
  if (!route?.sectionKey) return "";
  const translated = safeTranslate(t, route.sectionKey);
  if (translated) return translated;
  if (!looksLikeTranslationKey(route.sectionKey)) return route.sectionKey;
  return humanizeToken(route.sectionKey.split(".").pop());
}

function moduleLabel(module) {
  if (!module) return "General";
  return humanizeToken(String(module));
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function HighlightText({ text, query }) {
  const q = query.trim();
  if (!q) return <span className="truncate">{text}</span>;
  const parts = String(text).split(new RegExp(`(${escapeRegExp(q)})`, "ig"));
  return (
    <span className="truncate">
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={`${part}-${i}`} className="global-search-dropdown__highlight">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${i}`}>{part}</span>
        )
      )}
    </span>
  );
}

function useDropdownPosition(wrapRef, active) {
  const [style, setStyle] = useState(null);

  useEffect(() => {
    if (!active || !wrapRef.current) {
      setStyle(null);
      return undefined;
    }

    const update = () => {
      const rect = wrapRef.current?.getBoundingClientRect();
      if (!rect) return;
      setStyle({
        position: "fixed",
        top: `${rect.bottom + 4}px`,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        zIndex: 200,
      });
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [active, wrapRef]);

  return style;
}

export default function GlobalSearch({ onSelect, placeholderKey = "common.search", className = "" }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, DEBOUNCE_MS);
  const [open, setOpen] = useState(false);
  const [focus, setFocus] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const wrapRef = useRef(null);

  const trimmedQuery = query.trim();
  const trimmedDebounced = debouncedQuery.trim();
  const hasQuery = trimmedQuery.length > 0;
  const isSearching = hasQuery && trimmedQuery !== trimmedDebounced;
  const showDropdown = hasQuery && (open || focus);

  const routes = useMemo(() => {
    const all = [...flattenNavForSearch(), ...EXTRA_ROUTES];
    const seen = new Set();
    return all
      .filter((r) => {
        if (!r?.path || seen.has(r.path) || !userCanAccessPath(user, r.path)) return false;
        const label = routeLabel(r, t);
        if (!label || looksLikeTranslationKey(label)) return false;
        seen.add(r.path);
        return true;
      })
      .map((r) => {
        const meta = MODULE_META[r.module] || {};
        return {
          ...r,
          label: routeLabel(r, t),
          parentLabel: routeSectionLabel(r, t),
          moduleLabel: meta.label || moduleLabel(r.module),
          Icon: meta.Icon || Search,
        };
      });
  }, [user, t]);

  const matches = useMemo(() => {
    if (!trimmedDebounced) return [];
    const q = trimmedDebounced.toLowerCase();
    return routes
      .filter((r) => {
        const section = r.parentLabel && r.parentLabel !== r.label ? r.parentLabel : "";
        const haystack = [r.label, r.moduleLabel, section, r.path].join(" ").toLowerCase();
        return haystack.includes(q);
      })
      .slice(0, 12);
  }, [trimmedDebounced, routes]);

  const dropdownStyle = useDropdownPosition(wrapRef, showDropdown);

  useEffect(() => {
    setHighlight(0);
  }, [trimmedDebounced]);

  useEffect(() => {
    if (!showDropdown || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-index="${highlight}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [highlight, showDropdown]);

  const handleSelect = useCallback(
    (path) => {
      if (!path) return;
      navigate(path);
      setQuery("");
      setOpen(false);
      setFocus(false);
      onSelect?.();
    },
    [navigate, onSelect]
  );

  const submitSearch = useCallback(() => {
    if (!trimmedQuery) return;
    setOpen(true);
    if (isSearching) return;
    if (matches.length > 0) {
      handleSelect(matches[highlight]?.path || matches[0].path);
    }
  }, [trimmedQuery, isSearching, matches, highlight, handleSelect]);

  useEffect(() => {
    const onPointerDown = (e) => {
      if (!wrapRef.current?.contains(e.target) && !listRef.current?.contains(e.target)) {
        setOpen(false);
        setFocus(false);
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  useEffect(() => {
    const onKeyDown = (e) => {
      const isModK = (e.metaKey || e.ctrlKey) && (e.key === "k" || e.key === "K");
      if (isModK) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
        setFocus(true);
        return;
      }
      if (e.key === "Escape" && document.activeElement === inputRef.current) {
        if (query) {
          e.preventDefault();
          setQuery("");
          return;
        }
        setOpen(false);
        setFocus(false);
        inputRef.current?.blur();
        return;
      }
      if (document.activeElement !== inputRef.current || !showDropdown || isSearching) return;
      if (matches.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlight((h) => (h + 1) % matches.length);
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlight((h) => (h - 1 + matches.length) % matches.length);
      }
      if (e.key === "Enter") {
        e.preventDefault();
        handleSelect(matches[highlight]?.path || matches[0].path);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [showDropdown, matches, highlight, handleSelect, query, isSearching]);

  const dropdownPanel = showDropdown && dropdownStyle ? (
    <div
      id="global-search-results"
      ref={listRef}
      role="listbox"
      className="global-search-dropdown global-search-dropdown--portal"
      style={dropdownStyle}
    >
      {isSearching ? (
        <div className="global-search-dropdown__loading" role="status" aria-live="polite">
          <Loader2 className="global-search-dropdown__loading-icon" aria-hidden />
          <span>Searching…</span>
        </div>
      ) : matches.length === 0 ? (
        <div className="global-search-dropdown__empty" role="status" aria-live="polite">
          <SearchX className="global-search-dropdown__empty-icon" aria-hidden />
          <p className="global-search-dropdown__empty-title">No results found</p>
          <p className="global-search-dropdown__empty-hint">Try a different search term.</p>
        </div>
      ) : (
        matches.map((r, i) => {
          const selected = i === highlight;
          const section = r.parentLabel && r.parentLabel !== r.label ? r.parentLabel : "";
          const Icon = r.Icon || Search;
          return (
            <button
              key={r.path}
              id={`global-search-option-${i}`}
              data-index={i}
              type="button"
              role="option"
              aria-selected={selected}
              title={r.label}
              onMouseEnter={() => setHighlight(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(r.path)}
              className={`global-search-dropdown__item${selected ? " is-active" : ""}`}
            >
              <span className="global-search-dropdown__icon" aria-hidden>
                <Icon />
              </span>
              <span className="global-search-dropdown__text">
                <span className="global-search-dropdown__label">
                  <HighlightText text={r.label} query={debouncedQuery} />
                </span>
                <span className="global-search-dropdown__meta">
                  <HighlightText
                    text={section ? `${r.moduleLabel} · ${section}` : r.moduleLabel}
                    query={debouncedQuery}
                  />
                </span>
              </span>
            </button>
          );
        })
      )}
    </div>
  ) : null;

  return (
    <div ref={wrapRef} className={`global-search-root${className ? ` ${className}` : ""}`}>
      <SearchBar
        value={query}
        onChange={(value) => {
          setQuery(value);
          setOpen(true);
          if (!value.trim()) {
            setOpen(false);
          }
        }}
        onFocus={() => {
          setFocus(true);
          if (trimmedQuery) setOpen(true);
        }}
        onBlur={() => {
          setFocus(false);
        }}
        onClear={() => {
          setQuery("");
          setOpen(false);
          inputRef.current?.focus();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            submitSearch();
          }
        }}
        inputRef={inputRef}
        placeholder={t(placeholderKey, { defaultValue: "Search pages…" })}
        className={NAVBAR_SEARCH_WRAP_CLASS}
        inputClassName={NAVBAR_SEARCH_INPUT_CLASS}
        role="combobox"
        aria-expanded={showDropdown}
        aria-controls="global-search-results"
        aria-activedescendant={
          showDropdown && matches[highlight] ? `global-search-option-${highlight}` : undefined
        }
        autoComplete="off"
      />

      {typeof document !== "undefined" && dropdownPanel
        ? createPortal(dropdownPanel, document.body)
        : null}
    </div>
  );
}
