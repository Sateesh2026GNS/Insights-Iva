import useAuth from "./useAuth";

/** Current user's tenant id; falls back to 1 for legacy seed data. */
export default function useTenantId() {
  const { user } = useAuth();
  const tid = Number(user?.tenant_id);
  return Number.isInteger(tid) && tid > 0 ? tid : 1;
}
