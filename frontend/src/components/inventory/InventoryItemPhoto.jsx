import { useEffect, useState } from "react";

import { fetchItemPhotoObjectUrl } from "../../utils/inventoryItemPhoto";

export default function InventoryItemPhoto({
  photoFileId,
  alt = "Item photo",
  className = "max-h-48 w-full rounded-lg object-contain",
  emptyClassName = "text-xs text-slate-500",
}) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let objectUrl = null;
    if (!photoFileId) {
      setSrc(null);
      setError(false);
      setLoading(false);
      return undefined;
    }
    setLoading(true);
    setError(false);
    fetchItemPhotoObjectUrl(photoFileId)
      .then((url) => {
        objectUrl = url;
        setSrc(url);
      })
      .catch(() => {
        setError(true);
        setSrc(null);
      })
      .finally(() => setLoading(false));

    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [photoFileId]);

  if (!photoFileId) {
    return <p className={emptyClassName}>No photo uploaded.</p>;
  }
  if (loading) {
    return <p className={emptyClassName}>Loading photo…</p>;
  }
  if (error || !src) {
    return <p className={emptyClassName}>Could not load photo.</p>;
  }
  return <img src={src} alt={alt} className={className} />;
}
