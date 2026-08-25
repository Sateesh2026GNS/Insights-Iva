import api from "./axiosConfig";
import { getCachedReference, invalidateReferenceCache } from "../utils/referenceDataCache";

export const getCompanySettings = (options = {}) =>
  getCachedReference("company-settings", () => api.get("/settings/company"), {
    force: options.force === true,
  });

export const updateCompanySettings = (payload) =>
  api.put("/settings/company", payload).then((res) => {
    invalidateReferenceCache("company-settings");
    return res;
  });

/** Live profile, subscription, and session details for the signed-in user. */
export const getAccountOverview = () => api.get("/settings/account-overview");

function unwrap(res) {
  return res?.data?.data ?? res?.data ?? null;
}

/** Current subscription + trial flags + embedded plan catalog. */
export const getSubscription = () =>
  api.get("/settings/subscription").then((res) => ({ ...res, data: unwrap(res) }));

export const getSubscriptionPlans = () =>
  api.get("/settings/subscription/plans").then((res) => ({ ...res, data: unwrap(res) }));

export const getSubscriptionPlan = (planId) =>
  api.get(`/settings/subscription/plans/${planId}`).then((res) => ({ ...res, data: unwrap(res) }));

export const activateTrial = () =>
  api.post("/settings/subscription/activate-trial").then((res) => ({
    ...res,
    data: unwrap(res),
    message: res?.data?.message,
  }));

export const contactSales = (payload = {}) =>
  api.post("/settings/subscription/contact-sales", payload).then((res) => ({
    ...res,
    data: unwrap(res),
    message: res?.data?.message,
  }));
