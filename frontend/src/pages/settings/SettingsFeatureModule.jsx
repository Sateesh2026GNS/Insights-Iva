import { useLocation } from "react-router-dom";
import FeatureSettingsPage from "../settings/FeatureSettingsPage";

const CONFIG = {
  "/settings/expense-settings": {
    title: "Expense Settings",
    settingKey: "expense_settings",
    fields: [{ name: "default_category", label: "Default category", type: "text" }],
  },
  "/settings/inventory-settings": {
    title: "Inventory Settings",
    settingKey: "inventory_settings",
    fields: [{ name: "valuation", label: "Valuation method", type: "text" }],
  },
};

export default function SettingsFeatureModule() {
  const { pathname } = useLocation();
  const cfg = CONFIG[pathname] || {
    title: "Settings",
    settingKey: "generic",
    fields: [{ name: "value", label: "Value", type: "text" }],
  };
  return <FeatureSettingsPage {...cfg} />;
}
