import { useCallback, useEffect, useState } from "react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getAllocatedAssets } from "../../api/hrApi";
import "./allocateAssets.css";

function AllocateIllustration() {
  return (
    <div className="hr-allocate-assets__illustration" aria-hidden>
      <div className="hr-allocate-assets__checklist">
        <span />
        <span />
        <span />
      </div>
      <div className="hr-allocate-assets__connector" />
      <div className="hr-allocate-assets__devices">
        <div className="hr-allocate-assets__device hr-allocate-assets__device--laptop" />
        <div className="hr-allocate-assets__device hr-allocate-assets__device--monitor" />
        <div className="hr-allocate-assets__device hr-allocate-assets__device--scanner" />
      </div>
    </div>
  );
}

export default function AllocateAssets() {
  const [loading, setLoading] = useState(true);
  const [allocations, setAllocations] = useState([]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getAllocatedAssets();
      const rows = res?.data?.items || res?.data || [];
      setAllocations(Array.isArray(rows) ? rows : []);
    } catch {
      setAllocations([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loader label="Loading allocated assets..." />;

  const isEmpty = allocations.length === 0;

  return (
    <ListPageShell>
      <div className="hr-allocate-assets min-w-0">
        <h1 className="hr-allocate-assets__title">Allocate Assets</h1>

        <div className="hr-allocate-assets__card">
          {isEmpty ? (
            <>
              <AllocateIllustration />
              <p className="hr-allocate-assets__empty-text">No assets allocated</p>
            </>
          ) : (
            <p className="hr-allocate-assets__empty-text">Allocated assets will appear here.</p>
          )}
        </div>
      </div>
    </ListPageShell>
  );
}
