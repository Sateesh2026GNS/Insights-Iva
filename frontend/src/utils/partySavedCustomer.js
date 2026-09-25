import { enrichApiCustomer } from "../data/customersMasterData";

/** Build a list-row customer from create/update API response (must include numeric id). */
export function customerRecordFromApiResponse(apiRow, form, address, basicDetails) {
  if (!apiRow || apiRow.id == null) return null;
  const merged = {
    ...apiRow,
    name: apiRow.name || form?.name?.trim() || "",
    address_line1: apiRow.address_line1 || address?.address_line1 || null,
    city: apiRow.city || address?.city || null,
    state: apiRow.state || address?.state || null,
    pincode: apiRow.pincode || address?.pincode || null,
    phone: apiRow.phone || form?.phone?.trim() || null,
    email: apiRow.email || basicDetails?.email?.trim() || null,
    gstin: apiRow.gstin ?? null,
  };
  return enrichApiCustomer(merged);
}
