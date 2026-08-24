import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { filterAccessibleSettingsCategories } from "../../config/permissions";
import useAuth from "../../hooks/useAuth";
import { SETTINGS_NAV_GROUPS, searchSettingsCategories } from "./settingsCatalog";
import {
  SettingsGroupPanel,
  SettingsHero,
  SettingsListItem,
  SettingsSearchInput,
  SettingsThemeToggle,
  SkeletonCards,
  resolveSettingsIcon,
} from "./settingsUi";

export default function SettingsHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState("");

  const results = useMemo(
    () => filterAccessibleSettingsCategories(searchSettingsCategories(query), user),
    [query, user]
  );
  const byId = useMemo(() => Object.fromEntries(results.map((c) => [c.id, c])), [results]);
  const isSearching = Boolean(query.trim());

  const groups = useMemo(() => {
    if (isSearching) {
      return results.length
        ? [{ id: "search", title: `${results.length} result${results.length === 1 ? "" : "s"}`, cats: results }]
        : [];
    }
    return SETTINGS_NAV_GROUPS.map((g) => ({
      ...g,
      cats: g.ids.map((id) => byId[id]).filter(Boolean),
    })).filter((g) => g.cats.length > 0);
  }, [byId, isSearching, results]);

  const goTo = (cat) => {
    navigate(cat.href || `/settings/${cat.id}`);
  };

  return (
    <div className="space-y-6">
      <SettingsHero
        subtitle="Manage company profile, users, security, workspace preferences, and operational defaults."
        actions={<SettingsThemeToggle className="self-start" />}
      >
        <SettingsSearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
        />
      </SettingsHero>

      {groups.length === 0 ? (
        <div className="ui-card border-dashed px-6 py-12 text-center">
          <p className="text-sm font-medium text-[var(--color-text)]">No settings match “{query}”</p>
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Try users, password, GST, invoice, or subscription.
          </p>
          <button
            type="button"
            onClick={() => setQuery("")}
            className="mt-3 text-sm font-semibold text-[var(--color-primary)] hover:underline"
          >
            Clear search
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {groups.map((group) => (
            <SettingsGroupPanel key={group.id} title={group.title}>
              {group.cats.map((cat) => {
                const Icon = resolveSettingsIcon(cat.icon);
                return (
                  <SettingsListItem
                    key={cat.id}
                    title={cat.title}
                    description={cat.description}
                    icon={Icon}
                    soft={cat.soft}
                    onClick={cat.href ? undefined : () => goTo(cat)}
                    href={cat.href}
                  />
                );
              })}
            </SettingsGroupPanel>
          ))}
        </div>
      )}
    </div>
  );
}

export { SkeletonCards };
