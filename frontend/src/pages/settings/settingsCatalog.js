/**
 * Settings module catalog — card home + search index.
 */

import { SETTINGS_ICON } from "./settingsTokens";

export const SETTINGS_CATEGORIES = [
  {
    id: "my-account",
    title: "My Account",
    description: "Your profile, company, role, and subscription overview.",
    icon: "UserRound",
    soft: SETTINGS_ICON.default,
    keywords: ["my account", "profile", "me", "user", "role", "subscription", "company"],
  },
  {
    id: "company",
    title: "Company Profile",
    description: "Logo, legal identity, GST, address, timezone, and currency.",
    icon: "Building2",
    soft: SETTINGS_ICON.default,
    keywords: ["company", "profile", "gst", "pan", "address", "timezone", "currency", "logo", "phone", "email", "website"],
  },
  {
    id: "users",
    title: "User Management",
    description: "Users, teams, roles, permissions, invites, and access control.",
    icon: "Users",
    soft: SETTINGS_ICON.default,
    keywords: ["users", "user", "team", "teams", "roles", "permissions", "invite", "password", "deactivate", "department"],
  },
  {
    id: "security",
    title: "Security",
    description: "Password policy, 2FA, sessions, OTP, and lockout rules.",
    icon: "Shield",
    soft: SETTINGS_ICON.danger,
    keywords: [
      "security",
      "password",
      "2fa",
      "otp",
      "sessions",
      "devices",
      "lock",
      "authentication",
      "login history",
      "login",
      "audit",
      "audit logs",
    ],
  },
  {
    id: "subscription",
    title: "Subscription",
    description: "Plan, licenses, trial, renewals, invoices, and billing history.",
    icon: "CreditCard",
    soft: SETTINGS_ICON.success,
    keywords: ["subscription", "plan", "license", "trial", "renew", "invoice", "payment", "upgrade"],
  },
  {
    id: "ai",
    title: "AI & LLM",
    description: "AI assistant, providers, API keys, models, and usage.",
    icon: "Bot",
    soft: SETTINGS_ICON.info,
    keywords: ["ai", "llm", "openai", "gemini", "ollama", "deepseek", "copilot", "model", "prompt"],
  },
  {
    id: "notifications",
    title: "Notifications",
    description: "Email, SMS, push, and operational alert preferences.",
    icon: "Bell",
    soft: SETTINGS_ICON.warning,
    keywords: ["notifications", "email", "sms", "push", "alerts", "stock", "machine", "production"],
  },
  {
    id: "appearance",
    title: "Appearance",
    description: "Theme, accent color, language, and display density.",
    icon: "Palette",
    soft: SETTINGS_ICON.default,
    keywords: ["appearance", "theme", "dark", "light", "language", "telugu", "hindi", "font", "compact"],
  },
  {
    id: "change-format",
    title: "Change Format",
    description: "Comma format, currency symbol, and date format preferences.",
    icon: "FileDigit",
    soft: SETTINGS_ICON.info,
    href: "/settings/change-format",
    keywords: ["format", "change format", "comma", "currency", "date", "number format", "symbol", "display"],
  },
  {
    id: "invoice-settings",
    title: "Invoice Settings",
    description: "Auto payment settlement, cash discount, additional charges, round off, and TCS.",
    icon: "Receipt",
    soft: SETTINGS_ICON.info,
    href: "/settings/invoice-settings",
    keywords: ["invoice", "invoice settings", "auto settle", "cash discount", "charges", "round off", "party balance", "tcs", "ewaybill", "rates"],
  },
  {
    id: "expense-settings",
    title: "Expense Settings",
    description: "Expense categories, chart groups, and accounting classification.",
    icon: "ReceiptText",
    soft: SETTINGS_ICON.warning,
    href: "/accounts/expenses/settings",
    keywords: ["expense", "expense settings", "categories", "account group", "cost center", "category"],
  },
  {
    id: "inventory",
    title: "Inventory Settings",
    description: "Warehouses, units, barcode, batch, and low-stock rules.",
    icon: "Package",
    soft: SETTINGS_ICON.default,
    href: "/inventory/settings",
    keywords: ["inventory", "inventory settings", "warehouse", "barcode", "batch", "expiry", "stock", "units", "reorder", "transfer"],
  },
  {
    id: "sequence-reset",
    title: "Sequence Reset Setting",
    description: "Reset document sequence numbers for new financial years.",
    icon: "RotateCcw",
    soft: SETTINGS_ICON.warning,
    href: "/settings/sequence-reset",
    keywords: ["sequence", "sequence reset", "financial year", "fy", "numbering", "reset"],
  },
  {
    id: "production",
    title: "Production Settings",
    description: "Shifts, work orders, machines, calendar, and scheduling.",
    icon: "Factory",
    soft: SETTINGS_ICON.default,
    keywords: ["production", "shift", "work order", "machine", "calendar", "scheduling"],
  },
  {
    id: "manufacturing-workflow",
    title: "Manufacturing Workflow",
    description: "Workflow board, stage queues, and role-based manufacturing handoffs.",
    icon: "GitBranch",
    soft: SETTINGS_ICON.success,
    keywords: [
      "manufacturing",
      "workflow board",
      "material check",
      "production jobs",
      "operator jobs",
      "quality checks",
      "packing",
      "dispatch",
      "billing",
      "role workflow",
      "stages",
    ],
  },
  {
    id: "finance",
    title: "Finance Settings",
    description: "GST, tax rules, invoice prefix, FY, and currency.",
    icon: "Wallet",
    soft: SETTINGS_ICON.default,
    keywords: ["finance", "gst", "tax", "invoice", "financial year", "currency", "bank", "payment"],
  },
  {
    id: "documents",
    title: "Documents",
    description: "Templates, letterheads, invoice layouts, and company docs.",
    icon: "FileText",
    soft: SETTINGS_ICON.info,
    keywords: ["documents", "templates", "letterhead", "invoice template", "logo", "number format"],
  },
  {
    id: "integrations",
    title: "Integrations",
    description: "Email, SMS, WhatsApp, Google, Microsoft, and gateways.",
    icon: "Puzzle",
    soft: SETTINGS_ICON.info,
    keywords: ["integrations", "whatsapp", "google", "microsoft", "sms", "payment gateway", "erp"],
  },
  {
    id: "api",
    title: "API & Webhooks",
    description: "API keys, webhook URLs, tokens, and developer access.",
    icon: "KeyRound",
    soft: SETTINGS_ICON.info,
    keywords: ["api", "webhooks", "keys", "token", "developer", "revoke"],
  },
  {
    id: "backup",
    title: "Backup & Restore",
    description: "Database backup, restore, schedules, and downloads.",
    icon: "HardDrive",
    soft: SETTINGS_ICON.neutral,
    keywords: ["backup", "restore", "database", "download", "schedule"],
  },
  {
    id: "audit",
    title: "Audit Logs",
    description: "Login history, activity logs, and system change trails.",
    icon: "ScrollText",
    soft: SETTINGS_ICON.danger,
    keywords: ["audit", "logs", "login history", "activity", "role changes"],
  },
  {
    id: "help",
    title: "Help & Support",
    description: "Docs, tickets, FAQ, and contact options.",
    icon: "LifeBuoy",
    soft: SETTINGS_ICON.success,
    keywords: ["help", "support", "ticket", "faq", "documentation", "chat"],
  },
  {
    id: "about",
    title: "About System",
    description: "Version, build, license, and environment details.",
    icon: "Info",
    soft: SETTINGS_ICON.neutral,
    keywords: ["about", "version", "build", "license", "database", "update"],
  },
];

/** Visual groups for settings navigation (home + sidebar). */
export const SETTINGS_NAV_GROUPS = [
  {
    id: "account",
    title: "Account & access",
    ids: ["my-account", "company", "users", "security", "subscription"],
  },
  {
    id: "workspace",
    title: "Workspace preferences",
    ids: ["ai", "notifications", "appearance", "change-format"],
  },
  {
    id: "operations",
    title: "Operations",
    ids: [
      "invoice-settings",
      "expense-settings",
      "inventory",
      "sequence-reset",
      "production",
      "manufacturing-workflow",
      "finance",
      "documents",
    ],
  },
  {
    id: "system",
    title: "System & support",
    ids: ["integrations", "api", "backup", "audit", "help", "about"],
  },
];

/** Map legacy settings URLs to new section ids. */
export const LEGACY_SETTINGS_REDIRECTS = {
  "company-profile": "company",
  users: "users",
  teams: "users",
  permissions: "users",
  subscription: "subscription",
  alerts: "notifications",
  inventory: "inventory",
  "inventory-settings": "inventory",
  production: "production",
  gst: "finance",
  buyers: "integrations",
  finance: "finance",
  "change-format": "change-format",
  "format-settings": "change-format",
  "invoice-settings": "invoice-settings",
  "expense-settings": "expense-settings",
  "sequence-reset": "sequence-reset",
  "role-workflow": "manufacturing-workflow",
};

export function findSettingsCategory(id) {
  return SETTINGS_CATEGORIES.find((c) => c.id === id) || null;
}

export function searchSettingsCategories(query) {
  const q = (query || "").trim().toLowerCase();
  if (!q) return SETTINGS_CATEGORIES;
  return SETTINGS_CATEGORIES.filter((c) => {
    const hay = [c.title, c.description, ...(c.keywords || [])].join(" ").toLowerCase();
    return hay.includes(q);
  });
}
