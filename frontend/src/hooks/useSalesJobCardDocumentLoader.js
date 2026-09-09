import { useCallback, useEffect, useState } from "react";

import { getSalesOrderDetail } from "../api/salesApi";
import { getCompanySettings } from "../api/settingsApi";
import { getSalesJobCard } from "../api/workflowApi";
import { fetchProductsWithFallback } from "../utils/productOptions";
import { buildSalesJobCardDocument } from "../utils/salesJobCardDocument";
import { apiErrorMessage, classifyApiError } from "../utils/apiError";

function mapSoLine(line) {
  return {
    id: line.id ?? line.line_id,
    product_id: line.product_id ?? "",
    product_name: line.item_description || line.product_name || "",
    quantity: line.quantity ?? "",
    unit: line.unit || "Nos",
    description: line.description || line.item_description || "",
  };
}

export function useSalesJobCardDocumentLoader(orderId, tenantId, enabled = true) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [card, setCard] = useState(null);
  const [form, setForm] = useState(null);
  const [salesOrder, setSalesOrder] = useState(null);
  const [customer, setCustomer] = useState(null);
  const [productLines, setProductLines] = useState([]);
  const [products, setProducts] = useState([]);
  const [companyProfile, setCompanyProfile] = useState(null);

  const load = useCallback(async () => {
    if (!orderId || !enabled) return;
    setLoading(true);
    setError("");
    try {
      const [cardRes, soRes, companyRes, prodList] = await Promise.all([
        getSalesJobCard(orderId),
        getSalesOrderDetail(orderId).catch(() => null),
        getCompanySettings().catch(() => null),
        fetchProductsWithFallback(tenantId),
      ]);
      const data = cardRes?.data ?? cardRes;
      const soData = soRes?.data ?? soRes;
      setCard(data);
      setForm({ ...(data?.form || {}), notes: data?.form?.notes || "" });
      setSalesOrder(soData?.order ?? null);
      const docCustomer = data?.sales_document?.customer_details;
      setCustomer(
        soData?.customer ??
          (docCustomer
            ? {
                name: docCustomer.customer_name,
                contact_name: docCustomer.contact_person,
                phone: docCustomer.phone,
                email: docCustomer.email,
                address_line1: docCustomer.billing_address,
              }
            : null)
      );
      let lines = Array.isArray(soData?.line_items) ? soData.line_items : [];
      if (!lines.length && Array.isArray(data?.sales_document?.product_lines)) {
        lines = data.sales_document.product_lines.map((row) => ({
          product_id: row.product_id,
          item_description: row.product_name,
          product_name: row.product_name,
          quantity: row.quantity,
          unit: row.uom,
          description: row.description,
        }));
      }
      setProductLines(lines.map(mapSoLine));
      setProducts(Array.isArray(prodList) ? prodList : []);
      setCompanyProfile(companyRes?.data?.data ?? companyRes?.data ?? null);
    } catch (err) {
      const classified = classifyApiError(err, "Could not load job card.");
      setError(classified.message || apiErrorMessage(err));
      setCard(null);
      setForm(null);
    } finally {
      setLoading(false);
    }
  }, [orderId, tenantId, enabled]);

  useEffect(() => {
    if (enabled && orderId) load();
    else {
      setCard(null);
      setForm(null);
      setError("");
    }
  }, [enabled, orderId, load]);

  const printPayload = () => {
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
      card,
      form,
      salesOrder,
      customer,
      productLines,
      products,
      salesDocument,
      details: card?.details,
      companyProfile,
      sales_order_id: orderId,
    };
  };

  return {
    loading,
    error,
    card,
    form,
    salesOrder,
    customer,
    productLines,
    products,
    companyProfile,
    load,
    printPayload,
  };
}

export default useSalesJobCardDocumentLoader;
