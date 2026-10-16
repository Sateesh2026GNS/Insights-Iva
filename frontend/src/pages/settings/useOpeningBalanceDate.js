import { useCallback, useEffect, useState } from "react";

import { getFeatureSetting, putFeatureSetting } from "../../api/bizDocumentsApi";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import {
  OPENING_BALANCE_SETTING_KEY,
  indianFyStartIso,
  parseStoredOpeningBalanceDate,
  unwrapFeatureSettingValue,
} from "./openingBalancesSettings";

export function useOpeningBalanceDate(enabled = true) {
  const { addToast } = useToast();
  const fallback = indianFyStartIso();
  const [dateValue, setDateValue] = useState(fallback);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [saving, setSaving] = useState(false);
  const [partial, setPartial] = useState(false);
  const [fieldError, setFieldError] = useState("");

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setPartial(false);
    try {
      const res = await getFeatureSetting(OPENING_BALANCE_SETTING_KEY);
      setDateValue(parseStoredOpeningBalanceDate(unwrapFeatureSettingValue(res), fallback));
    } catch {
      setPartial(true);
      setDateValue(fallback);
    } finally {
      setLoading(false);
    }
  }, [enabled, fallback]);

  useEffect(() => {
    load();
  }, [load]);

  const saveDate = async (nextIso) => {
    if (!nextIso) {
      setFieldError("Select an opening balance date.");
      return;
    }
    setFieldError("");
    setDateValue(nextIso);
    setSaving(true);
    try {
      await putFeatureSetting(OPENING_BALANCE_SETTING_KEY, {
        opening_balance_date: nextIso,
        updated_at: new Date().toISOString(),
      });
      addToast("Opening balance date saved.", "success");
    } catch (err) {
      setFieldError(apiErrorMessage(err, "Unable to save the opening balance date."));
      addToast(apiErrorMessage(err, "Unable to save the opening balance date."), "error");
    } finally {
      setSaving(false);
    }
  };

  return { dateValue, loading, saving, partial, fieldError, load, saveDate };
}
