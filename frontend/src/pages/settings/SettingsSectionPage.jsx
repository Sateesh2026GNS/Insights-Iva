import { Navigate, useParams } from "react-router-dom";

import AccessDenied from "../../components/admin/AccessDenied";
import { userCanAccessSettingsSection } from "../../config/permissions";
import useAuth from "../../hooks/useAuth";
import {
  findSettingsCategory,
  LEGACY_SETTINGS_REDIRECTS,
} from "./settingsCatalog";
import SettingsSectionContent from "./SettingsSectionContent";
import {
  SettingsBackLink,
  SettingsMobileNav,
  SettingsSectionHeader,
} from "./settingsUi";

export default function SettingsSectionPage() {
  const { sectionId } = useParams();
  const { user } = useAuth();
  const mapped = LEGACY_SETTINGS_REDIRECTS[sectionId] || sectionId;
  const category = findSettingsCategory(mapped);

  if (!category) {
    return <Navigate to="/settings" replace />;
  }

  if (!userCanAccessSettingsSection(user, category.id)) {
    return (
      <AccessDenied message="You do not have permission to access this settings section." />
    );
  }

  if (category.href) {
    return <Navigate to={category.href} replace />;
  }

  if (LEGACY_SETTINGS_REDIRECTS[sectionId] && sectionId !== mapped) {
    return <Navigate to={`/settings/${mapped}`} replace />;
  }

  return (
    <div className="space-y-5">
      <SettingsBackLink />
      <SettingsMobileNav />
      <SettingsSectionHeader category={category} />
      <SettingsSectionContent sectionId={category.id} category={category} />
    </div>
  );
}
