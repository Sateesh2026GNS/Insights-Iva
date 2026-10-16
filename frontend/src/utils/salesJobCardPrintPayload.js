import { getSalesOrderDetail } from "../api/salesApi";
import { getCompanySettings } from "../api/settingsApi";
import { getManualJobCard, getSalesJobCard } from "../api/workflowApi";
import { fetchProductsWithFallback } from "./productOptions";
import { buildSalesJobCardDocument } from "./salesJobCardDocument";

function mapSoLine(line) {
  return {
    id: line.id ?? line.line_id,
    product_id: line.product_id ?? "",
    product_name: line.item_description || line.product_name || "",
    quantity: line.quantity ?? "",
    unit: line.unit || "Nos",
    description: line.description || line.item_description || "",
    unit_price: line.unit_price ?? line.price,
    line_amount: line.line_amount ?? line.total_amount ?? line.amount,
    total_amount: line.total_amount ?? line.line_amount ?? line.amount,
  };
}

/**
 * Loads the complete Sales Job Card document and company profile needed
 * for accurate, rich print and PDF exports matching the inside document panel.
 */
export async function loadSalesJobCardPrintPayload(rowOrOrder, tenantId = 1) {
  if (!rowOrOrder) return null;

  // If already complete with salesDocument and companyProfile
  if (
    (rowOrOrder.salesDocument || rowOrOrder.card?.sales_document) &&
    rowOrOrder.companyProfile
  ) {
    return rowOrOrder;
  }

  const isManual = Boolean(
    rowOrOrder.is_manual ||
      (!rowOrOrder.sales_order_id &&
        (rowOrOrder.job_card_id || (rowOrOrder.id && !rowOrOrder.order_number)))
  );
  const resolvedJobCardId = rowOrOrder.job_card_id ?? (isManual ? rowOrOrder.id : null);
  const resolvedOrderId = rowOrOrder.sales_order_id ?? (!isManual ? rowOrOrder.id : null);

  let companyProfile = rowOrOrder.companyProfile;
  if (!companyProfile) {
    try {
      const compRes = await getCompanySettings();
      companyProfile = compRes?.data?.data ?? compRes?.data ?? null;
    } catch {
      companyProfile = null;
    }
  }

  if (isManual && resolvedJobCardId) {
    let manualCard = rowOrOrder.card;
    if (!manualCard?.sales_document) {
      try {
        const res = await getManualJobCard(resolvedJobCardId);
        manualCard = res?.data ?? res;
      } catch {
        manualCard = rowOrOrder.card || null;
      }
    }
    const sd = manualCard?.sales_document || rowOrOrder.sales_document;
    const doc = manualCard?.manual_document || rowOrOrder.manual_document;
    const cust = sd?.customer_details || {};
    const lines = sd?.product_lines || [];
    return {
      ...rowOrOrder,
      card: manualCard,
      salesDocument: sd,
      salesOrder: null,
      customer: {
        name: cust.customer_name || rowOrOrder.customer_name,
        contact_name: cust.contact_person,
        phone: cust.phone,
        email: cust.email,
        address_line1: cust.billing_address,
      },
      productLines: lines.map((l) => ({
        product_name: l.product_name,
        product_code: l.product_code,
        quantity: l.quantity,
        unit: l.uom,
        uom: l.uom,
        unit_price: l.unit_price,
        line_amount: l.line_amount,
        total_amount: l.total_amount,
      })),
      products: [],
      details: { approval: sd?.approval || doc?.approval },
      companyProfile,
    };
  }

  if (resolvedOrderId) {
    try {
      const [cardRes, soRes, prodList] = await Promise.all([
        getSalesJobCard(resolvedOrderId).catch(() => null),
        getSalesOrderDetail(resolvedOrderId).catch(() => null),
        fetchProductsWithFallback(tenantId).catch(() => []),
      ]);
      const card = cardRes?.data ?? cardRes ?? rowOrOrder.card ?? null;
      const soData = soRes?.data ?? soRes ?? null;
      const form = { ...(card?.form || rowOrOrder.form || {}), notes: card?.form?.notes || "" };
      const salesOrder = soData?.order ?? null;
      const docCustomer = card?.sales_document?.customer_details;
      const customer =
        soData?.customer ??
        (docCustomer
          ? {
              name: docCustomer.customer_name,
              contact_name: docCustomer.contact_person,
              phone: docCustomer.phone,
              email: docCustomer.email,
              address_line1: docCustomer.billing_address,
            }
          : rowOrOrder.customer_name
          ? { name: rowOrOrder.customer_name }
          : null);

      let lines = Array.isArray(soData?.line_items) ? soData.line_items : [];
      if (!lines.length && Array.isArray(card?.sales_document?.product_lines)) {
        lines = card.sales_document.product_lines.map((r) => ({
          product_id: r.product_id,
          item_description: r.product_name,
          product_name: r.product_name,
          quantity: r.quantity,
          unit: r.uom,
          description: r.description,
          unit_price: r.unit_price,
          line_amount: r.line_amount,
          total_amount: r.total_amount,
        }));
      }
      const productLines = lines.map(mapSoLine);
      const products = Array.isArray(prodList) ? prodList : [];

      const salesDocument =
        card?.sales_document ||
        buildSalesJobCardDocument({
          card,
          form,
          salesOrder,
          customer,
          productLines,
          products,
          details: card?.details,
          companyProfile,
        });

      return {
        ...rowOrOrder,
        card,
        form,
        salesOrder,
        customer,
        productLines,
        products,
        salesDocument,
        details: card?.details,
        companyProfile,
        sales_order_id: resolvedOrderId,
      };
    } catch {
      // return fallback
    }
  }

  return {
    ...rowOrOrder,
    companyProfile,
  };
}
