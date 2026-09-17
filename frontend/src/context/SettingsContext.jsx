import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import i18n from "../i18n";

const STORAGE_KEYS = {
  theme: "smrt-theme",
  language: "smrt-language",
  dateFormat: "smrt-date-format",
  currency: "smrt-currency",
  notifyEmail: "smrt-notify-email",
  notifyPush: "smrt-notify-push",
  companyName: "smrt-company-name",
  companyAddress: "smrt-company-address",
};

const get = (key, def) => {
  try {
    const v = localStorage.getItem(key);
    return v ?? def;
  } catch {
    return def;
  }
};

const set = (key, value) => {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, String(value));
  } catch {}
};

export const SettingsContext = createContext(null);

export function SettingsProvider({ children }) {
  const [theme, setThemeState] = useState(() => get(STORAGE_KEYS.theme, "light"));
  const [language, setLanguageState] = useState(() => get(STORAGE_KEYS.language, "English"));
  const [dateFormat, setDateFormatState] = useState(() => get(STORAGE_KEYS.dateFormat, "DD-MM-YYYY"));
  const [currency, setCurrencyState] = useState(() => get(STORAGE_KEYS.currency, "INR"));
  const [notifyEmail, setNotifyEmailState] = useState(() => get(STORAGE_KEYS.notifyEmail, "true") === "true");
  const [notifyPush, setNotifyPushState] = useState(() => get(STORAGE_KEYS.notifyPush, "true") === "true");
  const [companyName, setCompanyNameState] = useState(() => {
    const stored = get(STORAGE_KEYS.companyName, "GNS");
    return stored === "Acme Manufacturing" ? "GNS" : stored;
  });
  const [companyAddress, setCompanyAddressState] = useState(() => get(STORAGE_KEYS.companyAddress, ""));

  useEffect(() => {
    if (get(STORAGE_KEYS.companyName, "GNS") === "Acme Manufacturing") {
      set(STORAGE_KEYS.companyName, "GNS");
      setCompanyNameState("GNS");
    }
  }, []);

  useEffect(() => {
    const isLogin =
      typeof window !== "undefined" &&
      (window.location.pathname === "/login" ||
        window.location.pathname === "/gns-admin/login" ||
        window.location.pathname === "/super-admin/login" ||
        window.location.pathname === "/forgot-password" ||
        window.location.pathname === "/reset-password" ||
        window.location.pathname === "/verify-email" ||
        window.location.pathname === "/landing");

    if (isLogin) {
      document.documentElement.dataset.theme = "light";
      document.documentElement.classList.remove("dark");
    } else {
      document.documentElement.dataset.theme = theme;
      document.documentElement.classList.toggle("dark", theme === "dark");
    }
  }, [theme]);

  useEffect(() => {
    const stored = get(STORAGE_KEYS.language, "English");
    const code = { English: "en", Hindi: "hi", Tamil: "ta", Telugu: "te" }[stored] || "en";
    if (i18n.language !== code) i18n.changeLanguage(code);
  }, []);

  const updateTheme = useCallback((v) => {
    setThemeState(v);
    set(STORAGE_KEYS.theme, v);
  }, []);

  const updateLanguage = useCallback((v) => {
    setLanguageState(v);
    set(STORAGE_KEYS.language, v);
    const code = { English: "en", Hindi: "hi", Tamil: "ta", Telugu: "te" }[v] || "en";
    i18n.changeLanguage(code);
  }, []);

  const updateDateFormat = useCallback((v) => {
    setDateFormatState(v);
    set(STORAGE_KEYS.dateFormat, v);
  }, []);

  const updateCurrency = useCallback((v) => {
    setCurrencyState(v);
    set(STORAGE_KEYS.currency, v);
  }, []);

  const updateNotifyEmail = useCallback((v) => {
    setNotifyEmailState(v);
    set(STORAGE_KEYS.notifyEmail, v ? "true" : "false");
  }, []);

  const updateNotifyPush = useCallback((v) => {
    setNotifyPushState(v);
    set(STORAGE_KEYS.notifyPush, v ? "true" : "false");
  }, []);

  const updateCompanyName = useCallback((v) => {
    setCompanyNameState(v);
    set(STORAGE_KEYS.companyName, v);
  }, []);

  const updateCompanyAddress = useCallback((v) => {
    setCompanyAddressState(v);
    set(STORAGE_KEYS.companyAddress, v);
  }, []);

  const value = useMemo(
    () => ({
      theme,
      language,
      dateFormat,
      currency,
      notifyEmail,
      notifyPush,
      companyName,
      companyAddress,
      updateTheme,
      updateLanguage,
      updateDateFormat,
      updateCurrency,
      updateNotifyEmail,
      updateNotifyPush,
      updateCompanyName,
      updateCompanyAddress,
    }),
    [
      theme,
      language,
      dateFormat,
      currency,
      notifyEmail,
      notifyPush,
      companyName,
      companyAddress,
      updateTheme,
      updateLanguage,
      updateDateFormat,
      updateCurrency,
      updateNotifyEmail,
      updateNotifyPush,
      updateCompanyName,
      updateCompanyAddress,
    ]
  );

  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export default function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
