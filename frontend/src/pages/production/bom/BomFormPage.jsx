import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Search, Trash2, X } from "lucide-react";

import { createBom, fetchBomDetail, updateBomVersion } from "../../../api/bomModuleApi";
import Button from "../../../components/common/Button";
import FieldError from "../../../components/common/states/FieldError";
import { PermissionDeniedState } from "../../../components/common/states";
import { ListPageShell } from "../../../components/common/ListPageShell";
import { PRODUCTION_MANAGER_PAGE_CHROME } from "../../../config/productionManagerPageChrome";
import { useToast } from "../../../context/ToastContext";
import useAuth from "../../../hooks/useAuth";
import { userCanEditBom } from "../../../config/permissions";
import { apiErrorMessage, mapValidationErrorsToFields } from "../../../utils/apiError";
import { fetchProductsWithFallback } from "../../../utils/productOptions";
import { grossComponentQuantity } from "./bomModuleUtils";

const emptyLine = () => ({
  component_item_id: "",
  quantity: "1",
  uom: "Pcs",
  scrap_percent: "0",
});

export default function BomFormPage() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const copyFrom = searchParams.get("from");
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  const [products, setProducts] = useState([]);
  const [allItems, setAllItems] = useState([]);
  const [itemQuery, setItemQuery] = useState("");
  const [isItemSearchOpen, setIsItemSearchOpen] = useState(false);
  const itemSearchRef = useRef(null);
  const [effectiveFrom, setEffectiveFrom] = useState("");
  const [name, setName] = useState("");
  const [nameEdited, setNameEdited] = useState(false);
  const [productId, setProductId] = useState("");
  const [baseQty, setBaseQty] = useState("1");
  const [baseUom, setBaseUom] = useState("Pcs");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [versionId, setVersionId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [lineErrors, setLineErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const canEdit = userCanEditBom(user);

  useEffect(() => {
    if (isItemSearchOpen) itemSearchRef.current?.focus();
  }, [isItemSearchOpen]);

  useEffect(() => {
    fetchProductsWithFallback().then((list) => {
      const fg = list.filter((p) => /finished/i.test(p.category || ""));
      setProducts(fg.length ? fg : list);
      setAllItems(list);
    });
  }, []);

  useEffect(() => {
    const sourceId = isEdit ? id : copyFrom;
    if (!sourceId) return;
    fetchBomDetail(sourceId).then((data) => {
      const v = data.version;
      if (isEdit) {
        setName(data.name);
        setNameEdited(true);
        setProductId(String(data.product_id));
        setVersionId(v.id);
      } else {
        setName(`${data.name} (copy)`);
        setNameEdited(false);
        setProductId("");
      }
      setBaseQty(String(v.base_quantity));
      setBaseUom(v.base_uom);
      setNotes(v.notes || "");
      setEffectiveFrom(v.effective_from || "");
      setLines(
        (v.components || []).map((c) => ({
          component_item_id: String(c.component_item_id),
          quantity: String(c.quantity),
          uom: c.uom,
          scrap_percent: String(c.scrap_percent),
        })),
      );
    });
  }, [id, isEdit, copyFrom]);

  if (!canEdit) {
    return (
      <ListPageShell plannerChrome={PRODUCTION_MANAGER_PAGE_CHROME.bomForm}>
        <PermissionDeniedState description="You do not have permission to edit BOMs." />
      </ListPageShell>
    );
  }

  const buildPayload = () => ({
    name,
    product_id: Number(productId),
    version: {
      base_quantity: Number(baseQty),
      base_uom: baseUom,
      effective_from: effectiveFrom || null,
      notes,
      components: lines
        .filter((l) => l.component_item_id)
        .map((l, i) => ({
          component_item_id: Number(l.component_item_id),
          quantity: Number(l.quantity),
          uom: l.uom,
          scrap_percent: Number(l.scrap_percent || 0),
          line_no: i + 1,
        })),
    },
  });

  const validateForm = () => {
    const nextErrors = {};
    const nextLineErrors = {};
    const parsedBaseQty = Number(baseQty);

    if (!name.trim()) nextErrors.name = "Enter a name for this BOM.";
    if (!productId) nextErrors.product_id = "Select the finished product this BOM makes.";
    if (!Number.isFinite(parsedBaseQty) || parsedBaseQty <= 0) {
      nextErrors.base_quantity = "Output quantity must be greater than zero.";
    }
    if (!baseUom.trim()) nextErrors.base_uom = "Enter an output unit.";
    if (!lines.length) nextErrors.components = "Add at least one component.";

    lines.forEach((line, index) => {
      const errors = [];
      const quantity = Number(line.quantity);
      const scrap = Number(line.scrap_percent || 0);
      if (!line.component_item_id) errors.push("Select a component.");
      if (!Number.isFinite(quantity) || quantity <= 0) errors.push("Quantity must be greater than zero.");
      if (!String(line.uom || "").trim()) errors.push("Enter a unit.");
      if (!Number.isFinite(scrap) || scrap < 0 || scrap >= 100) errors.push("Scrap must be from 0% to less than 100%.");
      if (errors.length) nextLineErrors[index] = errors.join(" ");
    });

    setFieldErrors(nextErrors);
    setLineErrors(nextLineErrors);
    return Object.keys(nextErrors).length === 0 && Object.keys(nextLineErrors).length === 0;
  };

  const clearFieldError = (field) => {
    setFieldErrors((previous) => {
      if (!previous[field]) return previous;
      const next = { ...previous };
      delete next[field];
      return next;
    });
  };

  const clearLineError = (index) => {
    setLineErrors((previous) => {
      if (!previous[index]) return previous;
      const next = { ...previous };
      delete next[index];
      return next;
    });
  };

  const save = async (activateAfter) => {
    if (!validateForm()) return;
    setSaving(true);
    setFieldErrors({});
    setLineErrors({});
    try {
      if (isEdit) {
        await updateBomVersion(id, versionId, buildPayload().version);
        addToast("BOM draft saved.", "success");
        if (activateAfter) {
          const { activateBomVersion } = await import("../../../api/bomModuleApi");
          await activateBomVersion(id, versionId);
          addToast("BOM activated.", "success");
        }
        navigate(`/production/bom/${id}`);
      } else {
        const created = await createBom(buildPayload());
        addToast("BOM created.", "success");
        navigate(`/production/bom/${created.id}`);
      }
    } catch (e) {
      const mapped = mapValidationErrorsToFields(e);
      if (mapped && Object.keys(mapped).length) setFieldErrors(mapped);
      else addToast(apiErrorMessage(e, "Unable to save BOM."), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ListPageShell plannerChrome={PRODUCTION_MANAGER_PAGE_CHROME.bomForm}>
      <div className="ui-card p-4 space-y-4 max-w-4xl">
        <div>
          <label className="text-sm font-medium">BOM name</label>
          <input
            className="ui-input mt-1 w-full"
            required
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameEdited(true);
              clearFieldError("name");
            }}
            aria-invalid={Boolean(fieldErrors.name)}
          />
          <p className="mt-1 text-xs text-[var(--color-text-muted)]">
            Defaults to the selected product name. Add a qualifier if you maintain different recipes.
          </p>
          <FieldError message={fieldErrors.name} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Finished product</label>
            <select
              className="ui-input mt-1 w-full"
              value={productId}
              required
              onChange={(e) => {
                const selectedId = e.target.value;
                setProductId(selectedId);
                clearFieldError("product_id");
                if (!nameEdited) {
                  const selectedProduct = products.find((product) => String(product.id) === selectedId);
                  setName(selectedProduct ? `${selectedProduct.name} – Standard BOM` : "");
                  clearFieldError("name");
                }
              }}
              disabled={isEdit}
              aria-invalid={Boolean(fieldErrors.product_id)}
            >
              <option value="">Select</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <FieldError message={fieldErrors.product_id} />
          </div>
          <div>
            <label className="text-sm font-medium">Recipe output quantity</label>
            <input
              type="number"
              min="0.001"
              step="any"
              required
              className="ui-input mt-1 w-full"
              value={baseQty}
              onChange={(e) => {
                setBaseQty(e.target.value);
                clearFieldError("base_quantity");
              }}
              aria-invalid={Boolean(fieldErrors.base_quantity)}
            />
            <p className="mt-1 text-xs text-[var(--color-text-muted)]">
              Component quantities below are for this output amount.
            </p>
            <FieldError message={fieldErrors.base_quantity} />
          </div>
          <div>
            <label className="text-sm font-medium">Output unit (UOM)</label>
            <input
              className="ui-input mt-1 w-full"
              value={baseUom}
              required
              onChange={(e) => {
                setBaseUom(e.target.value);
                clearFieldError("base_uom");
              }}
              aria-invalid={Boolean(fieldErrors.base_uom)}
            />
            <FieldError message={fieldErrors.base_uom} />
          </div>
          <div>
            <label className="text-sm font-medium">Effective from</label>
            <input type="date" className="ui-input mt-1 w-full" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Notes</label>
            <textarea
              className="ui-textarea mt-1 min-h-20 w-full resize-y"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <FieldError message={fieldErrors.components} />
        <div className="border-t border-[var(--color-border)] pt-3">
          <div className="mb-3 flex min-w-0 items-center gap-3">
            <p className="shrink-0 text-sm font-semibold">Components</p>
            {isItemSearchOpen ? (
              <input
                ref={itemSearchRef}
                className="ui-input min-w-0 flex-1"
                placeholder="Search raw materials and sub-assemblies"
                value={itemQuery}
                onChange={(e) => setItemQuery(e.target.value)}
              />
            ) : null}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={isItemSearchOpen ? "Close component search" : "Search components"}
              title={isItemSearchOpen ? "Close search" : "Search components"}
              onClick={() => {
                setIsItemSearchOpen((open) => {
                  if (open) setItemQuery("");
                  return !open;
                });
              }}
            >
              {isItemSearchOpen ? <X className="h-4 w-4" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
            </Button>
          </div>
          <div className="mb-1 hidden grid-cols-6 gap-2 px-1 text-xs font-semibold text-[var(--color-text-muted)] sm:grid">
            <span className="col-span-2">Component</span>
            <span>Quantity</span>
            <span>Unit</span>
            <span>Scrap %</span>
            <span className="sr-only">Actions</span>
          </div>
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-[minmax(0,2fr)_minmax(4rem,1fr)_minmax(4rem,1fr)_minmax(4rem,1fr)_2.5rem] sm:grid-cols-6 gap-2 mb-2 items-end border-b border-[var(--color-border)] pb-2">
              <select
                className="ui-input sm:col-span-2"
                value={line.component_item_id}
                aria-label={`Component ${idx + 1}`}
                aria-invalid={Boolean(lineErrors[idx])}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx].component_item_id = e.target.value;
                  const picked = allItems.find((p) => String(p.id) === e.target.value);
                  if (picked?.unit) next[idx].uom = picked.unit;
                  setLines(next);
                  clearLineError(idx);
                }}
              >
                <option value="">Component</option>
                {allItems
                  .filter((p) => {
                    if (itemQuery && !String(p.name || "").toLowerCase().includes(itemQuery.toLowerCase())) return false;
                    if (productId && String(p.id) === String(productId)) return false;
                    return true;
                  })
                  .map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
              </select>
              <input
                type="number"
                min="0.001"
                step="any"
                className="ui-input"
                placeholder="Qty"
                aria-label={`Quantity for component ${idx + 1}`}
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx].quantity = e.target.value;
                  setLines(next);
                  clearLineError(idx);
                }}
              />
              <input
                className="ui-input"
                placeholder="UOM"
                aria-label={`Unit for component ${idx + 1}`}
                value={line.uom}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx].uom = e.target.value;
                  setLines(next);
                  clearLineError(idx);
                }}
              />
              <input
                type="number"
                min="0"
                max="99.99"
                step="any"
                className="ui-input"
                placeholder="Scrap %"
                aria-label={`Scrap percentage for component ${idx + 1}`}
                value={line.scrap_percent}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx].scrap_percent = e.target.value;
                  setLines(next);
                  clearLineError(idx);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-0.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700"
                aria-label={`Remove component ${idx + 1}`}
                title="Remove component"
                onClick={() => {
                  setLines(lines.filter((_, i) => i !== idx));
                  setLineErrors({});
                }}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
              <p className="text-xs text-[var(--color-text-muted)] col-span-full">
                Gross: {grossComponentQuantity(line.quantity, line.scrap_percent)} {line.uom}
              </p>
              {lineErrors[idx] ? (
                <p className="col-span-full text-xs text-[var(--color-danger)]" role="alert">
                  {lineErrors[idx]}
                </p>
              ) : null}
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setLines([...lines, emptyLine()])}>
            Add line
          </Button>
        </div>
        <div className="flex flex-col-reverse gap-3 border-t border-[var(--color-border)] pt-4 sm:flex-row sm:items-center sm:justify-between">
          {!isEdit ? (
            <p className="text-xs text-[var(--color-text-muted)]">
              New BOMs are saved as drafts. You can review and activate them after saving.
            </p>
          ) : <span />}
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="primary" disabled={saving} onClick={() => save(false)}>Save draft</Button>
            {isEdit && (
              <Button variant="secondary" disabled={saving} onClick={() => save(true)}>
                Save and activate
              </Button>
            )}
            <Button variant="secondary" to="/production/bom">Cancel</Button>
          </div>
        </div>
      </div>
    </ListPageShell>
  );
}
