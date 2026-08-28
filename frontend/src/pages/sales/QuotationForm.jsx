import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Building2, ChevronDown, FileText, Grid2x2, ImagePlus, MapPin, NotebookPen, Package, PenLine, Plane, Plus, Ban, Search, Share2, Ship, TrainFront, Trash2, Truck, User, X } from "lucide-react";

import Loader from "../../components/common/Loader";
import { SearchBar } from "../../components/common/SearchFilter";
import AddBankAccountModal from "../../components/sales/AddBankAccountModal";
import AddContactPersonModal from "../../components/sales/AddContactPersonModal";
import AddCustomFieldModal from "../../components/sales/AddCustomFieldModal";
import AddInvoiceDiscountModal from "../../components/sales/AddInvoiceDiscountModal";
import AddNewItemModal from "../../components/sales/AddNewItemModal";
import AddNewPartyModal from "../../components/sales/AddNewPartyModal";
import AddNoteModal from "../../components/sales/AddNoteModal";
import AddOtherChargesModal, {
  computeOtherChargeTotal,
} from "../../components/sales/AddOtherChargesModal";
import AddPrefixModal from "../../components/sales/AddPrefixModal";
import AddTermsAndConditionsModal from "../../components/sales/AddTermsAndConditionsModal";
import AddTransporterDetailsModal from "../../components/sales/AddTransporterDetailsModal";
import DispatchAddressPicker from "../../components/sales/DispatchAddressPicker";
import EditCompanyDetailsModal from "../../components/sales/EditCompanyDetailsModal";
import ShareToSalesTeamModal from "../../components/sales/ShareToSalesTeamModal";
import SignatureAndStampPanel from "../../components/sales/SignatureAndStampPanel";
import TermsAndConditionsPicker, {
  DEFAULT_TERMS_BODY,
} from "../../components/sales/TermsAndConditionsPicker";
import { createQuotation, getQuotation, updateQuotation } from "../../api/salesApi";
import { getCompanySettings, updateCompanySettings } from "../../api/settingsApi";
import { getProducts } from "../../api/productsApi";
import useTenantId from "../../hooks/useTenantId";
import usePermissions from "../../hooks/usePermissions";
import { useToast } from "../../context/ToastContext";
import { apiErrorMessage } from "../../utils/apiError";
import {
  customerToConsigneeFields,
  fetchCustomersWithFallback,
  filterCustomers,
  resolveCustomerId,
} from "../../utils/customerOptions";
import {
  MANUFACTURING_EVENTS,
  notifyManufacturingSpine,
} from "../../utils/manufacturingEvents";
import {
  ERP_PRIMARY,
  ERP_PRIMARY_SOFT,
  FieldLabel,
  SoftInput,
  SoftSelect,
  Pill,
} from "../../design-system/erpFormControls";

const YELLOW = "var(--color-primary)";
const PREFIX_STORAGE_KEY = "gns_quotation_prefixes";
const DEFAULT_PREFIXES = ["QUO"];
const ADD_PREFIX_VALUE = "__add_prefix__";

function loadCustomPrefixes() {
  try {
    const raw = localStorage.getItem(PREFIX_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveCustomPrefixes(list) {
  try {
    localStorage.setItem(PREFIX_STORAGE_KEY, JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

const emptyItem = () => ({
  item_description: "",
  hsn: "",
  qty: "",
  unit: "",
  rate: "",
  tax_type: "Exclusive",
  discount: "",
  discount_type: "₹",
  gst_pct: "",
  amount: 0,
});

function money(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

function lineTotals(row) {
  const qty = Number(row.qty) || 0;
  const rate = Number(row.rate) || 0;
  let discount = Number(row.discount) || 0;
  if (row.discount_type === "%" && discount > 0) {
    discount = money((qty * rate * discount) / 100);
  }
  const gstPct = Number(row.gst_pct) || 0;
  let taxable = money(qty * rate - discount);
  if (String(row.tax_type).toLowerCase() === "inclusive" && gstPct > 0) {
    taxable = money(taxable / (1 + gstPct / 100));
  }
  const gst = money((taxable * gstPct) / 100);
  return { taxable, gst, total: money(taxable + gst) };
}

const TRANSPORT_MODES = [
  { id: "Road", label: "Road", Icon: Truck },
  { id: "Rail", label: "Rail", Icon: TrainFront },
  { id: "Air", label: "Air", Icon: Plane },
  { id: "Ship/Road Cum Ship", label: "Ship/Road Cum Ship", Icon: Ship },
  { id: "Not Applicable", label: "Not-Applicable", Icon: Ban },
];

function transportDocLabels(mode) {
  if (mode === "Rail") {
    return { number: "RR Number", numberPh: "Enter RR Number", date: "RR Date" };
  }
  if (mode === "Air") {
    return {
      number: "Airway Bill Number",
      numberPh: "Enter Airway Bill Number",
      date: "Airway Bill Date",
    };
  }
  if (mode === "Ship/Road Cum Ship") {
    return {
      number: "Lading Number",
      numberPh: "Enter Lading Number",
      date: "Lading Date",
    };
  }
  return { number: "LR Number", numberPh: "Enter LR Number", date: "LR Date" };
}

function showsVehicleNo(mode) {
  return mode === "Road" || mode === "Ship/Road Cum Ship" || mode === "Not Applicable";
}

function SectionHeader({ icon: Icon, title, children, className = "", collapsible, open, onToggle }) {
  const titleRow = (
    <div className="flex min-w-0 items-center gap-2 text-[13px] font-bold uppercase tracking-wide text-slate-800">
      {Icon ? <Icon className="h-4 w-4 shrink-0" /> : null}
      <span className="truncate">{title}</span>
      {collapsible ? (
        <ChevronDown
          className={`ml-0.5 h-4 w-4 shrink-0 text-[#6b6b76] transition-transform ${
            open ? "rotate-180" : ""
          }`}
        />
      ) : null}
    </div>
  );

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 border-b border-[#d0d0d8] px-4 py-3 ${className}`}
      style={{ background: ERP_PRIMARY_SOFT }}
    >
      {collapsible ? (
        <button
          type="button"
          onClick={onToggle}
          className="flex min-w-0 items-center text-left"
          aria-expanded={Boolean(open)}
        >
          {titleRow}
        </button>
      ) : (
        titleRow
      )}
      {children ? (
        <div className="relative z-10 flex flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}

const INDIAN_STATES = [
  "Andhra Pradesh",
  "Delhi",
  "Gujarat",
  "Karnataka",
  "Maharashtra",
  "Tamil Nadu",
  "Telangana",
  "Uttar Pradesh",
  "West Bengal",
];

export default function QuotationForm() {
  const tenantId = useTenantId();
  const navigate = useNavigate();
  const { id: routeId } = useParams();
  const editId = routeId || null;
  const isEdit = Boolean(editId);
  const { addToast } = useToast();
  const { isAdmin } = usePermissions();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState([]);
  const [company, setCompany] = useState(null);
  const [customerSearch, setCustomerSearch] = useState("");
  const [showBuyerPicker, setShowBuyerPicker] = useState(false);
  const [dispatchAddress, setDispatchAddress] = useState(null);
  const [editCompanyOpen, setEditCompanyOpen] = useState(false);
  const [addBuyerOpen, setAddBuyerOpen] = useState(false);
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [otherChargeOpen, setOtherChargeOpen] = useState(false);
  const [otherChargeMeta, setOtherChargeMeta] = useState(null);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountMeta, setDiscountMeta] = useState(null);
  const [sameAsBuyer, setSameAsBuyer] = useState(true);
  const [showConsigneePicker, setShowConsigneePicker] = useState(false);
  const [consigneeSearch, setConsigneeSearch] = useState("");
  const [taxModeOverride, setTaxModeOverride] = useState("auto");
  const [declOpen, setDeclOpen] = useState(false);
  const [transportOpen, setTransportOpen] = useState(true);
  const [otherDetailsOpen, setOtherDetailsOpen] = useState(true);
  const [termsOpen, setTermsOpen] = useState(false);
  const [termsAttached, setTermsAttached] = useState(false);
  const [termsPickerOpen, setTermsPickerOpen] = useState(false);
  const [termsAddOpen, setTermsAddOpen] = useState(false);
  const [transporterModalOpen, setTransporterModalOpen] = useState(false);
  const [customFieldOpen, setCustomFieldOpen] = useState(false);
  const [customFields, setCustomFields] = useState([]);
  const [bankModalOpen, setBankModalOpen] = useState(false);
  const [bankAccount, setBankAccount] = useState(null);
  const [contactPerson, setContactPerson] = useState(null);
  const [contactOpen, setContactOpen] = useState(false);
  const [extraNote, setExtraNote] = useState("");
  const [noteOpen, setNoteOpen] = useState(false);
  const [prefixModalOpen, setPrefixModalOpen] = useState(false);
  const [customPrefixes, setCustomPrefixes] = useState(loadCustomPrefixes);
  const [signatureOn, setSignatureOn] = useState(false);
  const [signatureDataUrl, setSignatureDataUrl] = useState(() => {
    try { return localStorage.getItem("gns_invoice_signature_data") || null; } catch { return null; }
  });
  const [stampDataUrl, setStampDataUrl] = useState(() => {
    try { return localStorage.getItem("gns_invoice_stamp_data") || null; } catch { return null; }
  });
  const [shareOpen, setShareOpen] = useState(false);
  const [form, setForm] = useState({
    tenant_id: tenantId,
    customer_id: "",
    sales_order_id: searchParams.get("sales_order_id")
      ? Number(searchParams.get("sales_order_id"))
      : null,
    invoice_prefix: "",
    invoice_number: "1",
    issue_date: new Date().toISOString().slice(0, 10),
    valid_until: new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10),
    due_date: "",
    discount: 0,
    other_charge: 0,
    round_off: 0,
    consignee_name: "",
    consignee_address1: "",
    consignee_address2: "",
    consignee_state: "",
    consignee_state_code: "",
    consignee_gstin: "",
    consignee_phone: "",
    consignee_email: "",
    notes: "",
    terms_of_delivery: "",
    delivery_note: "",
    delivery_note_date: "",
    reference_no: "",
    other_references: "",
    po_number: "",
    po_date: "",
    dispatch_doc_no: "",
    lr_number: "",
    transporter_name: "DTDC",
    destination: "",
    ewaybill_number: "",
    declaration: "",
    rejection_policy: "",
    sales_person: "",
    reverse_charge: false,
    payment_terms: "Net 30 Days",
  });
  const [products, setProducts] = useState([]);
  const [itemPickerIdx, setItemPickerIdx] = useState(null);
  const [itemSearch, setItemSearch] = useState("");
  const [items, setItems] = useState([emptyItem(), emptyItem(), emptyItem()]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [custRes, companyRes, productsRes] = await Promise.allSettled([
          fetchCustomersWithFallback(),
          getCompanySettings(),
          getProducts(),
        ]);
        if (cancelled) return;
        setCustomers(custRes.status === "fulfilled" ? custRes.value || [] : []);
        const co = companyRes.status === "fulfilled" ? companyRes.value?.data || null : null;
        setCompany(co);
        const prodRaw =
          productsRes.status === "fulfilled"
            ? productsRes.value?.data ?? productsRes.value ?? []
            : [];
        setProducts(Array.isArray(prodRaw) ? prodRaw : []);
        if (co) {
          if (co.stamp_url) {
            setStampDataUrl((prev) => prev || co.stamp_url);
            try {
              if (!localStorage.getItem("gns_invoice_stamp_data")) {
                localStorage.setItem("gns_invoice_stamp_data", co.stamp_url);
              }
            } catch {}
          }
          if (co.signature_url) {
            setSignatureDataUrl((prev) => prev || co.signature_url);
            try {
              if (!localStorage.getItem("gns_invoice_signature_data")) {
                localStorage.setItem("gns_invoice_signature_data", co.signature_url);
              }
            } catch {}
          }
        }
        if (co?.invoice_prefix) {
          setForm((f) =>
            f.invoice_prefix ? f : { ...f, invoice_prefix: co.invoice_prefix }
          );
        }
        if (co?.bank_name) {
          setBankAccount({
            ifsc: co.bank_ifsc || "",
            bank_name: co.bank_name || "",
            account_holder: "",
            account_number: co.bank_account_number || "",
            branch_name: co.bank_branch || "",
            upi_id: "",
            show_upi_qr: true,
            notes: null,
          });
        }
        if (editId) {
          const quote = (await getQuotation(editId)).data;
          if (!quote) throw new Error("Quotation not found");
          const qn = String(quote.quote_number || "");
          const prefixMatch = qn.match(/^([A-Za-z-]+)/);
          const meta = quote.meta_json || {};
          const trans = meta.transportation || meta.dispatch || {};
          const cons = meta.consignee || {};
          if (meta.tax_mode) setTaxModeOverride(meta.tax_mode);
          if (meta.terms || meta.delivery_terms || trans.delivery_terms) {
            setTermsAttached(true);
          }
          setForm((f) => ({
            ...f,
            customer_id: quote.customer_id || "",
            consignee_name: cons.name || quote.customer_name || f.consignee_name,
            consignee_address1: cons.address || f.consignee_address1,
            consignee_state: cons.state || f.consignee_state,
            consignee_state_code: cons.state_code || f.consignee_state_code,
            consignee_gstin: cons.gstin || f.consignee_gstin,
            consignee_phone: cons.phone || f.consignee_phone,
            invoice_prefix: prefixMatch?.[1] || f.invoice_prefix,
            invoice_number: qn.replace(/^[A-Za-z-]+/, "") || qn,
            issue_date: quote.quote_date
              ? String(quote.quote_date).slice(0, 10)
              : f.issue_date,
            valid_until: quote.valid_until
              ? String(quote.valid_until).slice(0, 10)
              : f.valid_until,
            discount: Number(quote.discount) || 0,
            other_charge: Number(meta.other_charge) || 0,
            round_off: Number(meta.round_off) || 0,
            notes: meta.terms || meta.delivery_terms || quote.notes || f.notes,
            terms_of_delivery: meta.delivery_terms || trans.delivery_terms || f.terms_of_delivery,
            sales_person: quote.sales_person || "",
            delivery_note: trans.delivery_note || meta.delivery_note || "",
            delivery_note_date: trans.delivery_note_date ? String(trans.delivery_note_date).slice(0, 10) : "",
            reference_no: trans.reference_no || meta.reference_no || "",
            other_references: trans.other_references || meta.other_references || "",
            po_number: trans.buyer_order_no || trans.buyers_order_no || trans.po_number || meta.po_number || "",
            po_date: trans.buyer_order_date || trans.po_date ? String(trans.buyer_order_date || trans.po_date).slice(0, 10) : "",
            dispatch_doc_no: trans.dispatch_doc_no || trans.lr_number || meta.dispatch_doc_no || "",
            lr_number: trans.dispatch_doc_no || trans.lr_number || meta.lr_number || "",
            transporter_name: trans.dispatched_through || trans.transporter_name || "DTDC",
            destination: trans.destination || meta.destination || "",
            ewaybill_number: meta.ewaybill_number || meta.eway_bill_no || trans.ewaybill_number || "",
            declaration: meta.declaration || "",
            rejection_policy: meta.rejection_policy || meta.quotation_policy || "",
            payment_terms: meta.payment_terms || "Net 30 Days",
          }));
          if (Array.isArray(meta.items) && meta.items.length > 0) {
            setItems(meta.items.map((it) => ({
              ...emptyItem(),
              item_description: it.item_description || "",
              hsn: it.hsn || "",
              qty: it.qty ?? 1,
              unit: it.unit || "pcs",
              rate: it.rate ?? 0,
              tax_type: it.tax_type || "Exclusive",
              discount: it.discount ?? 0,
              discount_type: it.discount_type || "₹",
              gst_pct: it.gst_pct ?? 18,
              amount: it.amount ?? 0,
            })));
          }
        }
      } catch (err) {
        if (!cancelled) {
          addToast(apiErrorMessage(err, "Failed to load quotation"), "error");
          if (editId) navigate("/sales/quotations");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [editId, addToast, navigate]);

  const filteredCustomers = useMemo(
    () => filterCustomers(customers, customerSearch),
    [customers, customerSearch]
  );

  const filteredConsignees = useMemo(
    () => filterCustomers(customers, consigneeSearch),
    [customers, consigneeSearch]
  );

  const selectedBuyer = customers.find((c) => String(c.id) === String(form.customer_id));

  const prefixOptions = useMemo(() => {
    const set = new Set([
      ...DEFAULT_PREFIXES,
      ...customPrefixes,
      ...(company?.invoice_prefix ? [company.invoice_prefix] : []),
      ...(form.invoice_prefix ? [form.invoice_prefix] : []),
    ]);
    return [...set].filter(Boolean);
  }, [customPrefixes, company?.invoice_prefix, form.invoice_prefix]);

  const handleCustomerChange = (customerId) => {
    const customer = customers.find((c) => String(c.id) === String(customerId));
    setForm((f) => ({
      ...f,
      customer_id: customerId,
      ...(sameAsBuyer ? customerToConsigneeFields(customer) : {}),
      consignee_phone: sameAsBuyer ? (customer?.phone || customer?.mobile || "") : f.consignee_phone,
      consignee_email: sameAsBuyer ? (customer?.email || "") : f.consignee_email,
    }));
    setShowBuyerPicker(false);
  };

  const updateItem = (idx, field, val) => {
    setItems((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      next[idx].amount = lineTotals(next[idx]).total;
      return next;
    });
  };

  const selectProductForRow = (idx, product) => {
    const gstPct = Number(product.gst_percent ?? product.gst_pct ?? company?.default_gst_pct ?? 18) || 0;
    setItems((prev) => {
      const next = [...prev];
      const row = {
        ...emptyItem(),
        product_id: product.id,
        item_description: product.name || product.sku || "",
        hsn: product.hsn_code || product.hsn || "",
        qty: next[idx]?.qty || 1,
        unit: product.unit || "pcs",
        rate: product.unit_price ?? product.sale_price ?? product.price_per_unit ?? "",
        tax_type: "Exclusive",
        gst_pct: gstPct,
        stock: product.current_stock != null ? Number(product.current_stock) : null,
      };
      row.amount = lineTotals(row).total;
      next[idx] = row;
      return next;
    });
    setItemPickerIdx(null);
    setItemSearch("");
  };

  const filteredProducts = useMemo(() => {
    const q = itemSearch.trim().toLowerCase();
    if (!q) return products.slice(0, 40);
    return products
      .filter((p) =>
        [p.name, p.sku, p.hsn_code, p.product_code, p.category]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      )
      .slice(0, 40);
  }, [products, itemSearch]);

  const removeItem = (idx) => {
    setItems((prev) => (prev.length <= 1 ? [emptyItem()] : prev.filter((_, i) => i !== idx)));
  };

  const filledItems = items.filter((i) => i.item_description?.trim());
  const taxableAmount = filledItems.reduce((s, i) => s + lineTotals(i).taxable, 0);
  const gstAmount = filledItems.reduce((s, i) => s + lineTotals(i).gst, 0);
  const itemsTotal = filledItems.reduce((s, i) => s + lineTotals(i).total, 0);
  const otherCharge = Number(form.other_charge) || 0;
  const invoiceDiscount = Number(form.discount) || 0;
  const finalAmount = money(itemsTotal + otherCharge - invoiceDiscount + (Number(form.round_off) || 0));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.customer_id) {
      addToast("Please select a buyer", "error");
      setShowBuyerPicker(true);
      return;
    }
    if (filledItems.length === 0) {
      addToast("Add at least one item", "error");
      return;
    }
    setSaving(true);
    try {
      const customerId = await resolveCustomerId(form.customer_id, customers, tenantId);
      const buyer = customers.find((c) => String(c.id) === String(customerId));
      const quoteNumber = [form.invoice_prefix, form.invoice_number]
        .filter(Boolean)
        .join("")
        .trim() || `QUO-${Date.now().toString().slice(-6)}`;
      const notesParts = [
        termsAttached ? form.notes : null,
        ...customFields.map((f) => `${f.label}: ${f.value}`),
        contactPerson
          ? `Contact: ${contactPerson.name}${
              contactPerson.phone ? ` · ${contactPerson.phone}` : ""
            }${contactPerson.email ? ` · ${contactPerson.email}` : ""}`
          : null,
        extraNote ? `Note: ${extraNote}` : null,
        bankAccount
          ? [
              "Bank Details:",
              bankAccount.bank_name,
              bankAccount.account_number ? `A/C: ${bankAccount.account_number}` : null,
              [bankAccount.ifsc, bankAccount.branch_name].filter(Boolean).join(" · ") || null,
            ]
              .filter(Boolean)
              .join("\n")
          : null,
      ]
        .filter(Boolean)
        .join("\n\n");

      const payload = {
        tenant_id: form.tenant_id,
        customer_id: customerId,
        customer_name: buyer?.name || form.consignee_name || null,
        quote_number: isEdit ? quoteNumber : undefined,
        quote_date: form.issue_date,
        valid_until: form.valid_until || form.due_date || null,
        status: "draft",
        total_amount: finalAmount,
        discount: invoiceDiscount,
        notes: notesParts || null,
        sales_person: form.sales_person || null,
        meta_json: {
          items: filledItems.map((i) => {
            const t = lineTotals(i);
            return {
              item_description: i.item_description.trim(),
              hsn: i.hsn || null,
              qty: Number(i.qty) || 0,
              unit: i.unit || "pcs",
              rate: Number(i.rate) || 0,
              tax_type: i.tax_type || "Exclusive",
              discount: Number(i.discount) || 0,
              discount_type: i.discount_type || "₹",
              gst_pct: Number(i.gst_pct) || 0,
              taxable_value: t.taxable,
              gst_amount: t.gst,
              amount: t.total,
            };
          }),
          transportation: {
            delivery_note: form.delivery_note || form.challan_number || "",
            delivery_note_date: form.delivery_note_date || "",
            reference_no: form.reference_no || "",
            other_references: form.other_references || "",
            buyer_order_no: form.po_number || "",
            buyers_order_no: form.po_number || "",
            buyer_order_date: form.po_date || "",
            dispatch_doc_no: form.dispatch_doc_no || form.lr_number || "",
            lr_number: form.dispatch_doc_no || form.lr_number || "",
            dispatched_through: form.transporter_name || "DTDC",
            transporter_name: form.transporter_name || "DTDC",
            destination: form.destination || "",
            delivery_terms: form.terms_of_delivery || form.notes || "",
            ewaybill_number: form.ewaybill_number || "",
            eway_bill_no: form.ewaybill_number || "",
          },
          dispatch: {
            delivery_note: form.delivery_note || form.challan_number || "",
            delivery_note_date: form.delivery_note_date || "",
            reference_no: form.reference_no || "",
            other_references: form.other_references || "",
            buyer_order_no: form.po_number || "",
            buyers_order_no: form.po_number || "",
            buyer_order_date: form.po_date || "",
            dispatch_doc_no: form.dispatch_doc_no || form.lr_number || "",
            lr_number: form.dispatch_doc_no || form.lr_number || "",
            dispatched_through: form.transporter_name || "DTDC",
            transporter_name: form.transporter_name || "DTDC",
            destination: form.destination || "",
            delivery_terms: form.terms_of_delivery || form.notes || "",
          },
          consignee: {
            name: (sameAsBuyer ? buyer?.name : form.consignee_name) || "",
            address: (sameAsBuyer
              ? [buyer?.address_line1, buyer?.address_line2, buyer?.city, buyer?.state, buyer?.pincode].filter(Boolean).join(", ")
              : [form.consignee_address1, form.consignee_address2].filter(Boolean).join(", ")) || "",
            state: (sameAsBuyer ? buyer?.state : form.consignee_state) || "",
            state_code: (sameAsBuyer ? buyer?.state_code : form.consignee_state_code) || "",
            gstin: (sameAsBuyer ? buyer?.gstin : form.consignee_gstin) || "",
            phone: (sameAsBuyer ? buyer?.phone : form.consignee_phone) || "",
          },
          tax_mode: taxModeOverride === "auto"
            ? (buyer?.state_code && company?.state_code && String(buyer.state_code) !== String(company.state_code) ? "igst" : "cgst_sgst")
            : taxModeOverride,
          ewaybill_number: form.ewaybill_number || "",
          eway_bill_no: form.ewaybill_number || "",
          reference_no: form.reference_no || "",
          payment_terms: form.payment_terms || "Net 30 Days",
          terms: termsAttached ? (form.terms_of_delivery || form.notes) : null,
          declaration: form.declaration || null,
          rejection_policy: form.rejection_policy || null,
          quotation_policy: form.rejection_policy || null,
          round_off: Number(form.round_off) || 0,
          other_charge: otherCharge,
        },
      };
      const res = isEdit
        ? await updateQuotation(editId, payload)
        : await createQuotation(payload);
      notifyManufacturingSpine(MANUFACTURING_EVENTS.DASHBOARD_REFRESH, {
        quotation_id: res.data?.id || editId,
      });
      addToast(isEdit ? "Quotation updated" : "Quotation created");
      const savedId = res.data?.id || editId;
      navigate(savedId ? `/sales/quotations/${savedId}` : "/sales/quotations");
    } catch (err) {
      console.error(err);
      addToast(apiErrorMessage(err, "Failed to save quotation"), "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[50vh] items-center justify-center bg-[#F5F5F5]">
        <Loader label="Loading…" />
      </div>
    );
  }

  const companyName = company?.company_name || company?.name || "My Company";

  return (
    <form
      onSubmit={handleSubmit}
      className="flex h-full min-h-0 flex-col bg-[#F5F5F5]"
    >
      {/* Sticky header — matches screenshot */}
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#e4e4ea] bg-white px-5 py-3.5">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate("/sales/quotations")}
            className="rounded-lg p-1.5 text-[#4a4a55] hover:bg-[#f5f5f7]"
            aria-label="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3.5 py-2 text-[13px] font-semibold text-emerald-800 hover:bg-emerald-100 transition shadow-xs"
            >
              <Share2 className="h-4 w-4" /> Share to Sales Team
            </button>
          )}
          <button
            type="button"
            onClick={() => navigate("/sales/quotations")}
            className="rounded-lg border border-[#d0d0d8] bg-white px-4 py-2 text-[13px] font-semibold text-[#4a4a55] hover:bg-[#f5f5f7]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg px-5 py-2 text-[13px] font-semibold text-white shadow-sm disabled:opacity-60"
            style={{ background: YELLOW }}
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[1200px] space-y-4 p-5 pb-10">
          {/* Top: quotation meta + supplier */}
          <div className="grid gap-4 lg:grid-cols-[1fr_1.35fr]">
          <section className="rounded-xl border border-[#d0d0d8] bg-white p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <FieldLabel>Quotation Prefix</FieldLabel>
                <SoftSelect
                  value={form.invoice_prefix}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === ADD_PREFIX_VALUE) {
                      setPrefixModalOpen(true);
                      return;
                    }
                    setForm((f) => ({ ...f, invoice_prefix: v }));
                  }}
                >
                  <option value="">No Prefix</option>
                  {prefixOptions.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                  <option
                    value={ADD_PREFIX_VALUE}
                    className="add-new-option text-[#036f71] font-semibold bg-[#e6f4f4] dark:text-[#2dd4bf] dark:bg-[#0d3d38]"
                    style={{ color: "#036f71", fontWeight: "600" }}
                  >
                    + Add New Prefix
                  </option>
                </SoftSelect>
              </label>
              <label className="block">
                <FieldLabel>Quotation No.</FieldLabel>
                <SoftInput
                  value={form.invoice_number}
                  onChange={(e) => setForm((f) => ({ ...f, invoice_number: e.target.value }))}
                />
              </label>
              <label className="block">
                <FieldLabel>Quotation Date</FieldLabel>
                <SoftInput
                  type="date"
                  value={form.issue_date}
                  onChange={(e) => setForm((f) => ({ ...f, issue_date: e.target.value }))}
                />
              </label>
              <label className="block">
                <FieldLabel>Quotation Validity Date</FieldLabel>
                <SoftInput
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
                />
              </label>
            </div>
          </section>

          <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
            <SectionHeader icon={Building2} title="Supplier Details" />
            <div className="flex items-start justify-between gap-4 p-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[15px] font-semibold text-[#1a1a1f]">{companyName}</p>
                  <button
                    type="button"
                    onClick={() => setEditCompanyOpen(true)}
                    className="inline-flex items-center gap-1 text-[13px] font-medium text-[var(--color-primary)] hover:underline"
                  >
                    <PenLine className="h-3.5 w-3.5" />
                    Edit Company Details
                  </button>
                </div>
                <DispatchAddressPicker value={dispatchAddress} onChange={setDispatchAddress} />
                {dispatchAddress ? (
                  <p className="mt-2 max-w-sm text-[12px] leading-relaxed text-[#6b6b76]">
                    {[dispatchAddress.address, dispatchAddress.city, dispatchAddress.state, dispatchAddress.pincode]
                      .filter(Boolean)
                      .join(", ")}
                    {dispatchAddress.gstin ? ` · ${dispatchAddress.gstin}` : ""}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setEditCompanyOpen(true)}
                className="flex h-[72px] w-[72px] shrink-0 flex-col items-center justify-center overflow-hidden rounded-full border border-dashed border-[#c4c4cc] bg-[#fafafa] text-[10px] text-[#9a9aa5]"
              >
                {company?.logo_url ? (
                  <img
                    src={company.logo_url}
                    alt="Logo"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <>
                    <ImagePlus className="mb-1 h-5 w-5" />
                    Add Logo
                  </>
                )}
              </button>
            </div>
          </section>
        </div>

        {/* Buyer */}
        <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
          <SectionHeader icon={User} title="Buyer Details">
            <button
              type="button"
              onClick={() => setShowBuyerPicker((v) => !v)}
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-semibold text-white"
              style={{ background: ERP_PRIMARY }}
            >
              <User className="h-3.5 w-3.5" />
              Select Buyer
            </button>
            <button
              type="button"
              onClick={() => setAddBuyerOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg border border-[#d0d0d8] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#4a4a55]"
            >
              <Plus className="h-3.5 w-3.5" />
              Add New Buyer
            </button>
          </SectionHeader>
          <div className="min-h-[88px] border-t-0 p-4">
            {showBuyerPicker && (
              <div className="mb-3 rounded-lg border border-[#e4e4ea] bg-[#fafafa] p-3">
                <SearchBar
                  size="compact"
                  value={customerSearch}
                  onChange={setCustomerSearch}
                  placeholder="Search"
                  className="mb-2 w-full"
                />
                <div className="max-h-44 overflow-y-auto">
                  {filteredCustomers.length === 0 ? (
                    <p className="p-2 text-[13px] text-[#8a8a95]">
                      No buyers found.{" "}
                      <button
                        type="button"
                        onClick={() => setAddBuyerOpen(true)}
                        className="font-medium"
                        style={{ color: ERP_PRIMARY }}
                      >
                        Add a buyer
                      </button>
                    </p>
                  ) : (
                    filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => handleCustomerChange(c.id)}
                        className={`block w-full rounded-md px-3 py-2 text-left text-[13px] hover:bg-white ${
                          String(form.customer_id) === String(c.id) ? "bg-white font-semibold" : ""
                        }`}
                      >
                        {c.name}
                        {c.gstin ? ` · ${c.gstin}` : ""}
                        {c.state ? ` · ${c.state}` : ""}
                      </button>
                    ))
                  )}
                </div>
              </div>
            )}
            {selectedBuyer ? (
              <div className="grid gap-1 text-[13px] sm:grid-cols-2">
                <p className="font-semibold text-[#1a1a1f]">{selectedBuyer.name}</p>
                <p className="text-[#6b6b76]">{selectedBuyer.gstin || "—"}</p>
                <p className="text-[#6b6b76] sm:col-span-2">
                  {[form.consignee_address1, form.consignee_address2, form.consignee_state]
                    .filter(Boolean)
                    .join(", ") || "—"}
                </p>
              </div>
            ) : (
              <p className="py-4 text-center text-[13px] text-[#a0a0ab]">Select a buyer to continue</p>
            )}
          </div>
        </section>

        {/* Consignee (Ship to) Details */}
        <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
          <SectionHeader icon={MapPin} title="Consignee Details (Ship to)">
            <div className="flex items-center gap-3">
              <label className="inline-flex cursor-pointer items-center gap-1.5 text-[12px] font-semibold text-[#4a4a55]">
                <input
                  type="checkbox"
                  checked={sameAsBuyer}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setSameAsBuyer(checked);
                    if (checked && selectedBuyer) {
                      setForm((f) => ({
                        ...f,
                        ...customerToConsigneeFields(selectedBuyer),
                        consignee_phone: selectedBuyer.phone || selectedBuyer.mobile || "",
                        consignee_email: selectedBuyer.email || "",
                      }));
                    }
                  }}
                  className="h-4 w-4 rounded border-[#c4c4cc] text-[var(--color-primary)] focus:ring-[var(--color-primary)]"
                />
                Same as Buyer (Bill to)
              </label>
              {!sameAsBuyer && (
                <button
                  type="button"
                  onClick={() => setShowConsigneePicker((v) => !v)}
                  className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[12px] font-semibold text-white"
                  style={{ background: ERP_PRIMARY }}
                >
                  <User className="h-3.5 w-3.5" />
                  Select Consignee
                </button>
              )}
            </div>
          </SectionHeader>

          <div className="p-4">
            {showConsigneePicker && !sameAsBuyer && (
              <div className="mb-3 rounded-lg border border-[#e4e4ea] bg-[#fafafa] p-3">
                <div className="relative mb-2">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a9aa5]" />
                  <input
                    type="search"
                    placeholder="Search Consignee..."
                    value={consigneeSearch}
                    onChange={(e) => setConsigneeSearch(e.target.value)}
                    className="w-full rounded-lg border border-[#e4e4ea] bg-white py-2 pl-9 pr-3 text-[13px]"
                  />
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {filteredConsignees.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setForm((f) => ({
                          ...f,
                          consignee_name: c.name || c.company || "",
                          consignee_address1: c.address_line1 || c.address || "",
                          consignee_address2: c.address_line2 || [c.city, c.pincode].filter(Boolean).join(" - ") || "",
                          consignee_state: c.state || "",
                          consignee_state_code: c.state_code || "",
                          consignee_gstin: c.gstin || "",
                          consignee_phone: c.phone || c.mobile || "",
                          consignee_email: c.email || "",
                        }));
                        setShowConsigneePicker(false);
                      }}
                      className="block w-full rounded-md px-3 py-2 text-left text-[13px] hover:bg-white"
                    >
                      {c.name || c.company}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sameAsBuyer ? (
              <div className="rounded-lg border border-[#e4e4ea] bg-[#fafafa] p-4 text-[13px] text-[#6b6b76]">
                <p className="font-semibold text-[#1a1a1f]">Ship to is set to same as Buyer:</p>
                <p className="mt-0.5">{selectedBuyer?.name ? `${selectedBuyer.name} — ${[selectedBuyer.address_line1, selectedBuyer.city, selectedBuyer.state].filter(Boolean).join(", ")}` : "—"}</p>
                <p className="mt-1 text-[11px] text-[#9a9aa5]">Uncheck &quot;Same as Buyer&quot; above if goods need to be shipped to a different party, site, or warehouse.</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <FieldLabel>Consignee Name</FieldLabel>
                  <SoftInput
                    placeholder="Enter Consignee Name"
                    value={form.consignee_name}
                    onChange={(e) => setForm((f) => ({ ...f, consignee_name: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <FieldLabel>GSTIN</FieldLabel>
                  <SoftInput
                    placeholder="Enter Consignee GSTIN"
                    value={form.consignee_gstin}
                    onChange={(e) => setForm((f) => ({ ...f, consignee_gstin: e.target.value }))}
                  />
                </label>
                <label className="block sm:col-span-2">
                  <FieldLabel>Address Line 1</FieldLabel>
                  <SoftInput
                    placeholder="Enter Address"
                    value={form.consignee_address1}
                    onChange={(e) => setForm((f) => ({ ...f, consignee_address1: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <FieldLabel>Address Line 2</FieldLabel>
                  <SoftInput
                    placeholder="City, Pincode"
                    value={form.consignee_address2}
                    onChange={(e) => setForm((f) => ({ ...f, consignee_address2: e.target.value }))}
                  />
                </label>
                <label className="block">
                  <FieldLabel>State</FieldLabel>
                  <SoftInput
                    placeholder="State"
                    value={form.consignee_state}
                    onChange={(e) => setForm((f) => ({ ...f, consignee_state: e.target.value }))}
                  />
                </label>
              </div>
            )}
          </div>
        </section>

        {/* Items */}
        <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
          <SectionHeader icon={Package} title="Item Details">
            <button
              type="button"
              onClick={() => setAddItemOpen(true)}
              className="rounded-lg border border-[#d0d0d8] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#4a4a55]"
            >
              + Add New Item
            </button>
          </SectionHeader>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] border-collapse text-left text-[12px]">
              <thead className="ui-table-head">
                <tr>
                  {["#", "Item Name", "HSN", "Qty Unit", "Price", "Tax Type", "Discount", "Taxable Value", "GST", "Total Amt", ""].map(
                    (h) => (
                      <th key={h || "x"} className="whitespace-nowrap border-b border-r border-[#d0d0d8] px-2 py-2.5 font-semibold last:border-r-0">
                        {h}
                      </th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((row, idx) => {
                  const t = lineTotals(row);
                  const hasDesc = Boolean(row.item_description?.trim());
                  return (
                    <tr key={idx}>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2 text-[#9a9aa5]">{idx + 1}</td>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2">
                        <div className="relative min-w-[180px]">
                          <SearchBar
                            size="compact"
                            value={itemPickerIdx === idx ? itemSearch : row.item_description}
                            onFocus={() => {
                              setItemPickerIdx(idx);
                              setItemSearch(row.item_description || "");
                            }}
                            onChange={(v) => {
                              setItemPickerIdx(idx);
                              setItemSearch(v);
                              updateItem(idx, "item_description", v);
                            }}
                            onBlur={() => {
                              setTimeout(() => {
                                setItemPickerIdx((cur) => (cur === idx ? null : cur));
                              }, 180);
                            }}
                            placeholder="Select Item"
                            clearable={false}
                            className="w-full"
                          />
                          {itemPickerIdx === idx ? (
                            <div className="absolute left-0 right-0 z-30 mt-1 max-h-48 overflow-y-auto rounded-md border border-[#d0d0d8] bg-white shadow-lg">
                              {filteredProducts.length === 0 ? (
                                <p className="px-3 py-2 text-[12px] text-[#8a8a95]">
                                  No products found.{" "}
                                  <button
                                    type="button"
                                    className="font-semibold"
                                    style={{ color: ERP_PRIMARY }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => setAddItemOpen(true)}
                                  >
                                    Add New Item
                                  </button>
                                </p>
                              ) : (
                                filteredProducts.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    className="block w-full px-3 py-2 text-left text-[12px] hover:bg-[#f7f7f9]"
                                    onMouseDown={(e) => e.preventDefault()}
                                    onClick={() => selectProductForRow(idx, p)}
                                  >
                                    <span className="font-semibold text-[#1a1a1f]">{p.name}</span>
                                    <span className="mt-0.5 block text-[11px] text-[#8a8a95]">
                                      {[p.sku, p.hsn_code ? `HSN ${p.hsn_code}` : null, p.current_stock != null ? `Stock ${p.current_stock}` : null]
                                        .filter(Boolean)
                                        .join(" · ")}
                                    </span>
                                  </button>
                                ))
                              )}
                            </div>
                          ) : null}
                        </div>
                      </td>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2">
                        <input
                          value={row.hsn}
                          onChange={(e) => updateItem(idx, "hsn", e.target.value)}
                          className="w-16 rounded-md border border-[#d0d0d8] bg-[#f7f7f9] px-1.5 py-1.5"
                        />
                      </td>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2">
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={row.qty}
                            onChange={(e) => updateItem(idx, "qty", e.target.value)}
                            placeholder="0"
                            className="w-14 rounded-md border border-[#d0d0d8] bg-[#f7f7f9] px-1.5 py-1.5"
                          />
                          <select
                            value={row.unit}
                            onChange={(e) => updateItem(idx, "unit", e.target.value)}
                            className="rounded-md border border-[#d0d0d8] bg-[#f7f7f9] px-1 py-1.5"
                          >
                            <option value="">Unit</option>
                            <option value="pcs">pcs</option>
                            <option value="KGS">KGS</option>
                            <option value="MT">MT</option>
                          </select>
                        </div>
                      </td>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2">
                        <div className="flex items-center gap-0.5">
                          <span className="text-[#9a9aa5]">₹</span>
                          <input
                            type="number"
                            value={row.rate}
                            onChange={(e) => updateItem(idx, "rate", e.target.value)}
                            className="w-20 rounded-md border border-[#d0d0d8] bg-[#f7f7f9] px-1.5 py-1.5"
                          />
                        </div>
                      </td>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2">
                        <select
                          value={row.tax_type}
                          onChange={(e) => updateItem(idx, "tax_type", e.target.value)}
                          className="rounded-md border border-[#d0d0d8] bg-[#f7f7f9] px-1.5 py-1.5"
                        >
                          <option>Exclusive</option>
                          <option>Inclusive</option>
                        </select>
                      </td>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2">
                        <div className="flex gap-1">
                          <input
                            type="number"
                            value={row.discount}
                            onChange={(e) => updateItem(idx, "discount", e.target.value)}
                            className="w-14 rounded-md border border-[#d0d0d8] bg-[#f7f7f9] px-1.5 py-1.5"
                          />
                          <select
                            value={row.discount_type}
                            onChange={(e) => updateItem(idx, "discount_type", e.target.value)}
                            className="rounded-md border border-[#d0d0d8] bg-[#f7f7f9] px-1 py-1.5"
                          >
                            <option value="₹">₹</option>
                            <option value="%">%</option>
                          </select>
                        </div>
                      </td>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2 tabular-nums text-[#6b6b76]">
                        {hasDesc ? t.taxable.toFixed(2) : "—"}
                      </td>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2">
                        <select
                          value={row.gst_pct}
                          onChange={(e) => updateItem(idx, "gst_pct", e.target.value)}
                          className="rounded-md border border-[#d0d0d8] bg-[#f7f7f9] px-1.5 py-1.5"
                        >
                          <option value="">—</option>
                          <option value="0">0%</option>
                          <option value="5">5%</option>
                          <option value="12">12%</option>
                          <option value="18">18%</option>
                          <option value="28">28%</option>
                        </select>
                      </td>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2 font-semibold tabular-nums">
                        {hasDesc ? t.total.toFixed(2) : "—"}
                      </td>
                      <td className="border-b border-r border-[#d0d0d8] px-2 py-2">
                        <button type="button" onClick={() => removeItem(idx)} className="text-red-500 hover:text-red-700">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex flex-col gap-4 border-t border-[#d0d0d8] p-4 sm:flex-row sm:items-start sm:justify-between">
            <button
              type="button"
              onClick={() => setAddItemOpen(true)}
              className="inline-flex items-center justify-center rounded-lg border px-4 py-2 text-[13px] font-semibold"
              style={{ borderColor: ERP_PRIMARY, color: ERP_PRIMARY, background: "#f8f5ff" }}
            >
              + Add More Item
            </button>

            <div className="min-w-[260px] overflow-hidden rounded-lg border border-[#d0d0d8] text-[13px]">
              <div className="flex justify-between border-b border-dashed border-[#d0d0d8] px-3 py-2 text-[#6b6b76]">
                <span>Taxable Amount</span>
                <span className="tabular-nums">₹ {taxableAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-[#d0d0d8] px-3 py-2 text-[#6b6b76]">
                <span>GST Amount</span>
                <span className="tabular-nums">₹ {gstAmount.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-dashed border-[#d0d0d8] px-3 py-2 font-medium text-[#1a1a1f]">
                <span>Total Amount</span>
                <span className="tabular-nums">₹ {itemsTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between border-b border-[#d0d0d8] bg-[#fafafa] px-3 py-2.5 text-[16px] font-bold text-[#1a1a1f]">
                <span>Final Amount</span>
                <span className="tabular-nums">₹ {finalAmount.toFixed(2)}</span>
              </div>
              <div className="flex flex-col gap-2 p-3">
                <button
                  type="button"
                  onClick={() => setOtherChargeOpen(true)}
                  className="rounded-full border bg-white px-3 py-1.5 text-[12px] font-semibold"
                  style={{ borderColor: ERP_PRIMARY, color: ERP_PRIMARY }}
                >
                  {otherChargeMeta?.charge_name
                    ? `${otherChargeMeta.charge_name} · ₹ ${otherCharge.toFixed(2)}`
                    : "+ Add Other Charge"}
                </button>
                <button
                  type="button"
                  onClick={() => setDiscountOpen(true)}
                  className="rounded-full border bg-white px-3 py-1.5 text-[12px] font-semibold"
                  style={{ borderColor: ERP_PRIMARY, color: ERP_PRIMARY }}
                >
                  {invoiceDiscount > 0
                    ? `Discount · ₹ ${invoiceDiscount.toFixed(2)}`
                    : "+ Add Quotation Level Discount"}
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* OPTIONAL FIELDS */}
        <div className="space-y-3">
          <p className="text-center text-[12px] font-bold uppercase tracking-[0.12em] text-[#6b6b76]">
            Optional Fields
          </p>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Transportation */}
            <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
              <SectionHeader
                icon={Truck}
                title="Transportation Details"
                collapsible
                open={transportOpen}
                onToggle={() => setTransportOpen((v) => !v)}
              />
              {transportOpen ? (
                <div className="p-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <FieldLabel>Delivery Note</FieldLabel>
                      <SoftInput
                        placeholder="Delivery Note No."
                        value={form.delivery_note}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            delivery_note: e.target.value,
                            challan_number: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Delivery Note Date</FieldLabel>
                      <SoftInput
                        type="date"
                        value={form.delivery_note_date}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, delivery_note_date: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Reference No. &amp; Date</FieldLabel>
                      <SoftInput
                        placeholder="e.g. REF/2026/09"
                        value={form.reference_no}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, reference_no: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Other References</FieldLabel>
                      <SoftInput
                        placeholder="Other references"
                        value={form.other_references}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, other_references: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Buyer's Order No.</FieldLabel>
                      <SoftInput
                        placeholder="PO Number"
                        value={form.po_number}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, po_number: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Buyer's Order Date (Dated)</FieldLabel>
                      <SoftInput
                        type="date"
                        value={form.po_date}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, po_date: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Dispatch Doc No. (LR No.)</FieldLabel>
                      <SoftInput
                        placeholder="Dispatch Doc / LR No."
                        value={form.dispatch_doc_no || form.lr_number}
                        onChange={(e) =>
                          setForm((f) => ({
                            ...f,
                            dispatch_doc_no: e.target.value,
                            lr_number: e.target.value,
                          }))
                        }
                      />
                    </label>
                    <label className="block">
                      <FieldLabel>Dispatched through</FieldLabel>
                      <SoftInput
                        placeholder="e.g. DTDC"
                        value={form.transporter_name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, transporter_name: e.target.value }))
                        }
                      />
                    </label>
                    <label className="block sm:col-span-2">
                      <FieldLabel>Destination</FieldLabel>
                      <SoftInput
                        placeholder="e.g. INDORE"
                        value={form.destination}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, destination: e.target.value }))
                        }
                      />
                    </label>
                  </div>
                </div>
              ) : null}
            </section>

            {/* Other details */}
            <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
              <SectionHeader
                icon={Grid2x2}
                title="Other Details"
                collapsible
                open={otherDetailsOpen}
                onToggle={() => setOtherDetailsOpen((v) => !v)}
              />
              {otherDetailsOpen ? (
                <div className="space-y-3 p-4">
                  <div className="grid gap-3 sm:grid-cols-1">
                    <label className="block">
                      <FieldLabel>E-Waybill Number</FieldLabel>
                      <SoftInput
                        placeholder="Enter E-Waybill Number"
                        value={form.ewaybill_number}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, ewaybill_number: e.target.value }))
                        }
                      />
                    </label>
                  </div>

                  {/* Custom fields list */}
                  {customFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-start justify-between gap-3 rounded-lg border border-[#e8e8ee] bg-[#fafafa] px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-semibold text-[#1a1a1f]">
                          {field.label}
                        </p>
                        {field.value ? (
                          <p className="mt-0.5 truncate text-[12px] text-[#6b6b76]">{field.value}</p>
                        ) : null}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setCustomFields((rows) => rows.filter((x) => x.id !== field.id))
                        }
                        className="rounded p-1 text-[#9a9aa5] hover:bg-[#f0f0f4] hover:text-[#e11d48]"
                        aria-label={`Remove ${field.label}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  ))}

                  <div className="pt-1">
                    <button
                      type="button"
                      onClick={() => setCustomFieldOpen(true)}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--color-primary)] bg-white px-3 py-2 text-[13px] font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary-soft)] transition-colors"
                    >
                      <Plus className="h-4 w-4" />
                      Add Custom Field
                    </button>
                  </div>
                </div>
              ) : null}
            </section>
          </div>

          {/* Terms of Delivery */}
          <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
            <SectionHeader
              icon={FileText}
              title="Terms of Delivery"
              collapsible
              open={termsOpen}
              onToggle={() => setTermsOpen((v) => !v)}
            >
              {termsAttached ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setTermsAttached(false);
                    setForm((f) => ({ ...f, notes: "", terms_of_delivery: "" }));
                  }}
                  className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white"
                  style={{ background: ERP_PRIMARY }}
                >
                  <X className="h-3.5 w-3.5" /> Remove
                </button>
              ) : null}
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTermsPickerOpen(true);
                }}
                className="inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 text-[12px] font-semibold text-white"
                style={{ background: ERP_PRIMARY }}
              >
                <User className="h-3.5 w-3.5" /> Select Terms of Delivery
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setTermsAddOpen(true);
                }}
                className="rounded-full border border-[#d8d8e0] bg-white px-3.5 py-1.5 text-[12px] font-semibold text-[#4a4a55]"
              >
                + Add New Terms of Delivery
              </button>
            </SectionHeader>
            {termsOpen && termsAttached && (form.notes || form.terms_of_delivery) ? (
              <div className="p-4">
                <textarea
                  rows={3}
                  value={form.terms_of_delivery || form.notes || ""}
                  placeholder="Enter Terms of Delivery (e.g. 1. Door delivery within 7 working days.)"
                  onChange={(e) => {
                    const val = e.target.value;
                    setForm((f) => ({ ...f, notes: val, terms_of_delivery: val }));
                  }}
                  className="w-full rounded-lg border border-[#e4e4ea] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#1a1a1f] focus:border-[var(--color-primary)] focus:outline-none focus:ring-1 focus:ring-[var(--color-primary)]"
                />
              </div>
            ) : null}
          </section>

          {/* GST Mode — CGST + SGST or IGST selector */}
          <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
            <div className="flex items-center gap-3 border-b border-[#e8e8f0] px-4 py-3">
              <Grid2x2 className="h-4 w-4 text-[var(--color-primary)]" />
              <span className="text-[13px] font-semibold text-[#1a1a1f]">GST Tax Mode</span>
            </div>
            <div className="flex flex-wrap items-center gap-3 p-4">
              {[
                { id: "auto", label: "Auto Detect" },
                { id: "cgst_sgst", label: "CGST + SGST (Intra-state)" },
                { id: "igst", label: "IGST (Inter-state / Export)" },
              ].map((opt) => (
                <label key={opt.id} className="flex cursor-pointer items-center gap-2 text-[13px] font-medium">
                  <input
                    type="radio"
                    name="taxModeOverride"
                    checked={taxModeOverride === opt.id}
                    onChange={() => setTaxModeOverride(opt.id)}
                    className="accent-[var(--color-primary)] h-4 w-4"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="px-4 pb-3 text-[11px] text-[#9a9aa5]">
              {taxModeOverride === "auto"
                ? "Tax mode is automatically determined from buyer vs seller state."
                : taxModeOverride === "igst"
                ? "IGST will be applied on all line items."
                : "CGST + SGST will be split equally on all line items."}
            </div>
          </section>

          {/* Declaration & Quotation Policy */}
          <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
            <button
              type="button"
              className="flex w-full items-center gap-3 border-b border-[#e8e8f0] px-4 py-3 text-left"
              onClick={() => setDeclOpen((v) => !v)}
            >
              <FileText className="h-4 w-4 text-[var(--color-primary)]" />
              <span className="text-[13px] font-semibold text-[#1a1a1f]">Declaration &amp; Rejection Policy</span>
              <ChevronDown className={`ml-auto h-4 w-4 text-[#8a8a95] transition-transform ${declOpen ? "rotate-180" : ""}`} />
            </button>
            {declOpen ? (
              <div className="grid gap-4 p-4 md:grid-cols-2">
                <div>
                  <FieldLabel>Declaration</FieldLabel>
                  <textarea
                    rows={4}
                    value={form.declaration || ""}
                    placeholder="Enter Declaration terms..."
                    onChange={(e) => setForm((f) => ({ ...f, declaration: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#e4e4ea] bg-white p-2.5 text-[12px] text-[#1a1a1f]"
                  />
                </div>
                <div>
                  <FieldLabel>Quotation Policy</FieldLabel>
                  <textarea
                    rows={4}
                    value={form.rejection_policy || ""}
                    placeholder="Enter Quotation Policy..."
                    onChange={(e) => setForm((f) => ({ ...f, rejection_policy: e.target.value }))}
                    className="mt-1 w-full rounded-lg border border-[#e4e4ea] bg-white p-2.5 text-[12px] text-[#1a1a1f]"
                  />
                </div>
              </div>
            ) : null}
          </section>

          {/* Notes */}
          <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
            <SectionHeader icon={NotebookPen} title="Notes">
              <button
                type="button"
                onClick={() => setNoteOpen(true)}
                className="rounded-lg border border-[#d8d8e0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#4a4a55]"
              >
                {extraNote ? "Edit Note" : "+ Add New Note"}
              </button>
            </SectionHeader>
            {extraNote ? (
              <div className="border-t border-[#ececf0] p-4 text-[13px] whitespace-pre-wrap text-[#4a4a55]">
                {extraNote}
              </div>
            ) : null}
          </section>

          {/* Signature */}
          <section className="overflow-hidden rounded-xl border border-[#d0d0d8] bg-white">
            <SectionHeader icon={User} title="Signature and Stamp">
              <button
                type="button"
                role="switch"
                aria-checked={signatureOn}
                onClick={() => setSignatureOn((v) => !v)}
                className={`relative h-6 w-11 rounded-full transition ${
                  signatureOn ? "bg-[var(--color-primary)]" : "bg-[#d4d4d8]"
                }`}
              >
                <span
                  className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${
                    signatureOn ? "left-[22px]" : "left-0.5"
                  }`}
                />
              </button>
            </SectionHeader>
            <SignatureAndStampPanel
              companyName={companyName}
              enabled={signatureOn}
              signatureDataUrl={signatureDataUrl}
              stampDataUrl={stampDataUrl}
              onSignatureChange={setSignatureDataUrl}
              onStampChange={setStampDataUrl}
            />
          </section>
        </div>
        </div>
      </div>

      <EditCompanyDetailsModal
        open={editCompanyOpen}
        onClose={() => setEditCompanyOpen(false)}
        onSaved={(data) => setCompany(data)}
      />
      <AddNewPartyModal
        open={addBuyerOpen}
        onClose={() => setAddBuyerOpen(false)}
        onSaved={(buyer) => {
          if (!buyer) return;
          setCustomers((rows) => [buyer, ...rows.filter((c) => c.id !== buyer.id)]);
          setForm((f) => ({
            ...f,
            customer_id: buyer.id,
            ...customerToConsigneeFields(buyer),
          }));
          setShowBuyerPicker(false);
        }}
      />
      <AddNewItemModal
        open={addItemOpen}
        onClose={() => setAddItemOpen(false)}
        onSaved={(line) => {
          if (!line) return;
          const withAmount = {
            ...emptyItem(),
            ...line,
            amount: lineTotals(line).total,
          };
          setItems((prev) => {
            const blankIdx = prev.findIndex((r) => !r.item_description?.trim());
            if (blankIdx >= 0) {
              const next = [...prev];
              next[blankIdx] = withAmount;
              return next;
            }
            return [...prev, withAmount];
          });
        }}
      />
      <AddOtherChargesModal
        open={otherChargeOpen}
        onClose={() => setOtherChargeOpen(false)}
        initial={otherChargeMeta}
        onSave={(charge) => {
          setOtherChargeMeta(charge);
          setForm((f) => ({
            ...f,
            other_charge: computeOtherChargeTotal(charge),
          }));
        }}
      />
      <AddInvoiceDiscountModal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        initial={discountMeta}
        baseAmount={itemsTotal}
        onSave={(disc) => {
          setDiscountMeta(disc);
          setForm((f) => ({ ...f, discount: disc.amount || 0 }));
        }}
      />
      <AddTransporterDetailsModal
        open={transporterModalOpen}
        onClose={() => setTransporterModalOpen(false)}
        initial={{
          transporter_name: form.transporter_name,
          transporter_id: form.transporter_id,
        }}
        onSave={(data) => {
          setForm((f) => ({
            ...f,
            transporter_name: data.transporter_name || "",
            transporter_id: data.transporter_id || "",
          }));
        }}
      />
      <AddCustomFieldModal
        open={customFieldOpen}
        onClose={() => setCustomFieldOpen(false)}
        onSave={(field) => setCustomFields((rows) => [...rows, field])}
      />
      <AddBankAccountModal
        open={bankModalOpen}
        onClose={() => setBankModalOpen(false)}
        initial={bankAccount}
        onSave={(data) => {
          setBankAccount(data);
          updateCompanySettings({
            bank_name: data.bank_name || null,
            bank_account_number: data.account_number || null,
            bank_ifsc: data.ifsc || null,
            bank_branch: data.branch_name || null,
          }).catch(() => {});
        }}
      />
      <TermsAndConditionsPicker
        open={termsPickerOpen}
        onClose={() => setTermsPickerOpen(false)}
        value={form.notes}
        onChange={(body) => {
          setTermsAttached(true);
          setTermsOpen(true);
          setForm((f) => ({ ...f, notes: body }));
        }}
        onRemove={() => {
          setTermsAttached(false);
          setForm((f) => ({ ...f, notes: "" }));
        }}
      />
      <AddTermsAndConditionsModal
        open={termsAddOpen}
        onClose={() => setTermsAddOpen(false)}
        onSave={(item) => {
          try {
            const raw = localStorage.getItem("gns_invoice_terms_templates");
            const list = raw ? JSON.parse(raw) : [];
            const next = Array.isArray(list) ? [...list, item] : [item];
            localStorage.setItem("gns_invoice_terms_templates", JSON.stringify(next));
          } catch {
            /* ignore */
          }
          setTermsAttached(true);
          setTermsOpen(true);
          setForm((f) => ({ ...f, notes: item.body }));
        }}
      />
      <AddPrefixModal
        open={prefixModalOpen}
        onClose={() => setPrefixModalOpen(false)}
        onSubmit={(value) => {
          setCustomPrefixes((prev) => {
            const next = prev.includes(value) ? prev : [...prev, value];
            saveCustomPrefixes(next);
            return next;
          });
          setForm((f) => ({ ...f, invoice_prefix: value }));
        }}
      />
      <AddContactPersonModal
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        initial={contactPerson}
        onSave={setContactPerson}
      />
      <AddNoteModal
        open={noteOpen}
        onClose={() => setNoteOpen(false)}
        initial={extraNote}
        onSave={setExtraNote}
      />
      {isAdmin && (
        <ShareToSalesTeamModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          docType="quotation"
          docNo={[form.invoice_prefix, form.invoice_number].filter(Boolean).join("-") || editId || "Quotation"}
          docId={editId || ""}
          buyerName={customers.find((c) => String(c.id) === String(form.customer_id))?.name || form.consignee_name || ""}
          grandTotal={finalAmount}
        />
      )}
    </form>
  );
}
