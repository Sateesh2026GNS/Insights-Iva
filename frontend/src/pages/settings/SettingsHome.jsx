import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import LogoutConfirmModal from "../../components/common/LogoutConfirmModal";
import {
  filterAccessibleSettingsCategories,
  isOperator,
  userCanAccessSettingsSection,
} from "../../config/permissions";
import useAuth from "../../hooks/useAuth";
import { SETTINGS_NAV_GROUPS, searchSettingsCategories } from "./settingsCatalog";
import Button from "../../components/common/Button";
import OpeningBalancesPanel from "./OpeningBalancesPanel";
import { useOpeningBalanceDate } from "./useOpeningBalanceDate";
import {
  SettingsGroupPanel,
  SettingsHero,
  SettingsListItem,
  SettingsSearchInput,
  SettingsThemeToggle,
  SkeletonCards,
  resolveSettingsIcon,
} from "./settingsUi";
import { PartialDataState } from "../../components/common/states";

export default function SettingsHome() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [query, setQuery] = useState("");
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const results = useMemo(
    () => filterAccessibleSettingsCategories(searchSettingsCategories(query), user),
    [query, user]
  );
  const byId = useMemo(() => Object.fromEntries(results.map((c) => [c.id, c])), [results]);
  const isSearching = Boolean(query.trim());
  const canOpeningBalances = userCanAccessSettingsSection(user, "opening-balances");
  const opening = useOpeningBalanceDate(canOpeningBalances && !isSearching);

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
    if (cat.id === "logout") {
      setShowLogoutModal(true);
      return;
    }
    navigate(cat.href || `/settings/${cat.id}`);
  };

  const handleConfirmLogout = async ({ allDevices } = {}) => {
    setLoggingOut(true);
    try {
      await logout({ allDevices });
    } finally {
      setLoggingOut(false);
      setShowLogoutModal(false);
      navigate("/login", { replace: true });
    }
  };

  return (
    <div className="space-y-6">
      <LogoutConfirmModal
        open={showLogoutModal}
        onCancel={() => setShowLogoutModal(false)}
        onConfirm={handleConfirmLogout}
        busy={loggingOut}
      />
      <SettingsHero
        subtitle={
          isOperator(user)
            ? "Update your profile, notifications, appearance, and view your account details."
            : "Manage company profile, users, security, workspace preferences, and operational defaults."
        }
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
          <Button type="button" variant="ghost" size="sm" className="mt-3" onClick={() => setQuery("")}>
            Clear search
          </Button>
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

      {canOpeningBalances && !isSearching ? (
        <div className="space-y-3">
          {opening.partial ? (
            <PartialDataState
              description="The saved opening balance date could not be loaded. The default financial-year start is shown."
              onRetry={opening.load}
            />
          ) : null}
          {opening.loading ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="ui-card h-44 animate-pulse bg-[var(--color-surface-muted)]" />
              <div className="ui-card h-44 animate-pulse bg-[var(--color-surface-muted)]" />
            </div>
          ) : (
            <OpeningBalancesPanel
              dateValue={opening.dateValue}
              onDateChange={opening.saveDate}
              saving={opening.saving}
              fieldError={opening.fieldError}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}

export { SkeletonCards };
