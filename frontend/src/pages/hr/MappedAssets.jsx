import { useCallback, useEffect, useState } from "react";

import Loader from "../../components/common/Loader";
import { ListPageShell } from "../../components/common/ListPageShell";
import usePageRefresh from "../../hooks/usePageRefresh";
import { getMappedAssets } from "../../api/hrApi";
import "./mappedAssets.css";

function MappedIllustration() {
  return (
    <div className="hr-mapped-assets__illustration" aria-hidden>
      <div className="hr-mapped-assets__hand" />
      <div className="hr-mapped-assets__float hr-mapped-assets__float--laptop" />
      <div className="hr-mapped-assets__float hr-mapped-assets__float--monitor" />
      <div className="hr-mapped-assets__float hr-mapped-assets__float--keyboard" />
    </div>
  );
}

export default function MappedAssets() {
  const [loading, setLoading] = useState(true);
  const [mapped, setMapped] = useState([]);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const res = await getMappedAssets();
      const rows = res?.data?.items || res?.data || [];
      setMapped(Array.isArray(rows) ? rows : []);
    } catch {
      setMapped([]);
    } finally {
      setLoading(false);
    }
  }, []);

  usePageRefresh(() => load(true));
  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <Loader label="Loading mapped assets..." />;

  const isEmpty = mapped.length === 0;

  return (
    <ListPageShell>
      <div className="hr-mapped-assets min-w-0">
        <h1 className="hr-mapped-assets__title">Mapped Assets</h1>

        <div className="hr-mapped-assets__card">
          {isEmpty ? (
            <>
              <MappedIllustration />
              <p className="hr-mapped-assets__empty-text">No mapped assets</p>
            </>
          ) : (
            <p className="hr-mapped-assets__empty-text">Mapped assets will appear here.</p>
          )}
        </div>
      </div>
    </ListPageShell>
  );
}
