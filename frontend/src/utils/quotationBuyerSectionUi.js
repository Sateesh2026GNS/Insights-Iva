/** Which buyer header actions to show on Create/Edit Quotation. */
export function quotationBuyerActionVisibility({ hasBuyer, canEditBuyer }) {
  if (!hasBuyer) {
    return {
      showSelectBuyer: true,
      showAddNewBuyer: true,
      showEditBuyer: false,
      showRemoveBuyer: false,
      showEditBuyerLink: false,
    };
  }
  return {
    showSelectBuyer: true,
    showAddNewBuyer: true,
    showEditBuyer: false,
    showRemoveBuyer: true,
    showEditBuyerLink: Boolean(canEditBuyer),
  };
}

/** Clear buyer on quotation draft only (does not delete customer master). */
export function clearQuotationBuyerSelection(form, sameAsBuyer) {
  const next = { ...form, customer_id: "" };
  if (sameAsBuyer) {
    Object.assign(next, {
      consignee_name: "",
      consignee_address1: "",
      consignee_address2: "",
      consignee_state: "",
      consignee_state_code: "",
      consignee_gstin: "",
      consignee_phone: "",
      consignee_email: "",
    });
  }
  return next;
}
