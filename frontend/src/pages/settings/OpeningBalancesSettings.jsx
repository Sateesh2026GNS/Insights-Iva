import PageHeader from "../../components/common/PageHeader";
import { OfflineState, PartialDataState, PermissionDeniedState } from "../../components/common/states";
import { useNetworkStatus } from "../../context/NetworkStatusContext";
import useAuth from "../../hooks/useAuth";
import { userCanAccessSettingsSection } from "../../config/permissions";
import OpeningBalancesPanel from "./OpeningBalancesPanel";
import { useOpeningBalanceDate } from "./useOpeningBalanceDate";
import { SettingsFeatureShell } from "./settingsUi";

export default function OpeningBalancesSettings() {
  const { user } = useAuth();
  const { online } = useNetworkStatus();
  const canAccess = userCanAccessSettingsSection(user, "opening-balances");
  const { dateValue, loading, saving, partial, fieldError, load, saveDate } = useOpeningBalanceDate(canAccess);

  if (!canAccess) {
    return (
      <SettingsFeatureShell>
        <PageHeader title="Opening Balances" backTo="/settings" backLabel="Back to Settings" showTitle />
        <PermissionDeniedState description="You do not have permission to manage opening balances." />
      </SettingsFeatureShell>
    );
  }

  if (!online) {
    return (
      <SettingsFeatureShell>
        <PageHeader title="Opening Balances" backTo="/settings" backLabel="Back to Settings" showTitle />
        <OfflineState onRetry={load} />
      </SettingsFeatureShell>
    );
  }

  return (
    <SettingsFeatureShell>
      <PageHeader
        title="Opening Balances"
        subtitle="Set the organization start date and configure account opening balances"
        backTo="/settings"
        backLabel="Back to Settings"
        showTitle
      />
      {partial ? (
        <PartialDataState
          className="mb-4"
          description="The saved date could not be loaded. The default financial-year start is shown."
          onRetry={load}
        />
      ) : null}
      {loading ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="ui-card h-48 animate-pulse bg-[var(--color-surface-muted)]" />
          <div className="ui-card h-48 animate-pulse bg-[var(--color-surface-muted)]" />
        </div>
      ) : (
        <OpeningBalancesPanel
          dateValue={dateValue}
          onDateChange={saveDate}
          saving={saving}
          fieldError={fieldError}
        />
      )}
    </SettingsFeatureShell>
  );
}
