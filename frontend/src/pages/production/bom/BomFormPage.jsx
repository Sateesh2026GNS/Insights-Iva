import { useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Search, Trash2, X } from "lucide-react";

import { createBom, fetchBomDetail, updateBomVersion } from "../../../api/bomModuleApi";
import Button from "../../../components/common/Button";
import FieldError from "../../../components/common/states/FieldError";
import { PermissionDeniedState } from "../../../components/common/states";
import { ListPageShell } from "../../../components/common/ListPageShell";
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
  const [productId, setProductId] = useState("");
  const [baseQty, setBaseQty] = useState("1000");
  const [baseUom, setBaseUom] = useState("Pcs");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState([emptyLine()]);
  const [versionId, setVersionId] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
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
        setProductId(String(data.product_id));
        setVersionId(v.id);
      } else {
        setName(`${data.name} (copy)`);
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
      <ListPageShell>
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

  const save = async (activateAfter) => {
    setSaving(true);
    setFieldErrors({});
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
    <ListPageShell>
      <div className="ui-card p-4 space-y-4 max-w-4xl">
        <div>
          <label className="text-sm font-medium">Name</label>
          <input className="ui-input mt-1 w-full" value={name} onChange={(e) => setName(e.target.value)} />
          <FieldError message={fieldErrors.name} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Finished product</label>
            <select className="ui-input mt-1 w-full" value={productId} onChange={(e) => setProductId(e.target.value)} disabled={isEdit}>
              <option value="">Select</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <FieldError message={fieldErrors.product_id} />
          </div>
          <div>
            <label className="text-sm font-medium">Base quantity</label>
            <input className="ui-input mt-1 w-full" value={baseQty} onChange={(e) => setBaseQty(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Base UOM</label>
            <input className="ui-input mt-1 w-full" value={baseUom} onChange={(e) => setBaseUom(e.target.value)} />
          </div>
          <div>
            <label className="text-sm font-medium">Effective from</label>
            <input type="date" className="ui-input mt-1 w-full" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <div className="sm:col-span-2">
            <label className="text-sm font-medium">Notes</label>
            <input className="ui-input mt-1 w-full" value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
        </div>
        <FieldError message={fieldErrors.components} />
        <div className="border-t border-[var(--color-border)] pt-3 pb-20">
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
          {lines.map((line, idx) => (
            <div key={idx} className="grid grid-cols-[minmax(0,2fr)_minmax(4rem,1fr)_minmax(4rem,1fr)_minmax(4rem,1fr)_2.5rem] sm:grid-cols-6 gap-2 mb-2 items-end border-b border-[var(--color-border)] pb-2">
              <select
                className="ui-input sm:col-span-2"
                value={line.component_item_id}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx].component_item_id = e.target.value;
                  const picked = allItems.find((p) => String(p.id) === e.target.value);
                  if (picked?.unit) next[idx].uom = picked.unit;
                  setLines(next);
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
                className="ui-input"
                placeholder="Qty"
                value={line.quantity}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx].quantity = e.target.value;
                  setLines(next);
                }}
              />
              <input
                className="ui-input"
                placeholder="UOM"
                value={line.uom}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx].uom = e.target.value;
                  setLines(next);
                }}
              />
              <input
                className="ui-input"
                placeholder="Scrap %"
                value={line.scrap_percent}
                onChange={(e) => {
                  const next = [...lines];
                  next[idx].scrap_percent = e.target.value;
                  setLines(next);
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="mb-0.5 rounded-lg border border-red-200 bg-red-50 text-red-600 hover:border-red-300 hover:bg-red-100 hover:text-red-700"
                aria-label={`Remove component ${idx + 1}`}
                title="Remove component"
                onClick={() => setLines(lines.filter((_, i) => i !== idx))}
              >
                <Trash2 className="h-4 w-4 text-red-600" aria-hidden />
              </Button>
              <p className="text-xs text-[var(--color-text-muted)] col-span-full">
                Gross: {grossComponentQuantity(line.quantity, line.scrap_percent)} {line.uom}
              </p>
            </div>
          ))}
          <Button type="button" variant="secondary" onClick={() => setLines([...lines, emptyLine()])}>
            Add line
          </Button>
        </div>
      </div>
      <div className="mt-4 flex w-full max-w-4xl justify-end gap-2 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] p-3">
        <Button variant="primary" disabled={saving} onClick={() => save(false)}>Save</Button>
        {isEdit && <Button disabled={saving} onClick={() => save(true)}>Save and activate</Button>}
        <Button variant="secondary" to="/production/bom">Cancel</Button>
      </div>
    </ListPageShell>
  );
}
