import { useCallback, useEffect, useRef, useState } from "react";
import { Maximize2, RefreshCw, User } from "lucide-react";

import { getEmployeeMapLocation } from "../../data/siteVisitData";
import { isGoogleMapsConfigured, loadGoogleMaps } from "../../utils/googleMapsLoader";

function buildMarkerIcon(maps, initials) {
  const label = String(initials || "?").slice(0, 2).toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="48" height="56" viewBox="0 0 48 56">
    <path d="M24 54 C24 54 44 36 44 24 C44 13.5 35.5 5 24 5 C12.5 5 4 13.5 4 24 C4 36 24 54 24 54Z" fill="#0751b2"/>
    <circle cx="24" cy="22" r="12" fill="white"/>
    <text x="24" y="26" text-anchor="middle" font-size="10" font-family="Arial,sans-serif" fill="#0751b2" font-weight="bold">${label}</text>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new maps.Size(40, 48),
    anchor: new maps.Point(20, 48),
  };
}

export function MockSiteVisitMap({ employee, className = "" }) {
  const initial = employee?.initials || employee?.name?.slice(0, 1)?.toUpperCase() || "?";

  return (
    <div
      className={`relative min-h-[360px] overflow-hidden rounded-lg border border-[var(--color-border-soft)] bg-[#e8f4ea] ${className}`.trim()}
    >
      <div className="absolute left-3 top-3 flex overflow-hidden rounded-md border border-[var(--color-border-soft)] bg-white text-xs font-semibold shadow-sm">
        <span className="bg-[var(--color-primary)] px-3 py-1.5 text-white">Map</span>
        <span className="px-3 py-1.5 text-[var(--color-text-muted)]">Satellite</span>
      </div>

      <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden>
        <rect width="100%" height="100%" fill="#e8f4ea" />
        <path d="M-10 280 L200 120 L450 200 L700 80 L900 150 L1100 50" stroke="#c5d4c8" strokeWidth="28" fill="none" />
        <path d="M100 400 L350 250 L600 320" stroke="#d4e4d8" strokeWidth="18" fill="none" />
      </svg>

      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="relative">
          <div className="h-12 w-8 rounded-t-full bg-[var(--kpi-info)] shadow-md" />
          <div className="absolute left-1/2 top-1.5 h-7 w-7 -translate-x-1/2 overflow-hidden rounded-full border-2 border-white bg-[var(--color-surface-muted)]">
            {employee?.has_avatar ? (
              <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-[var(--color-primary)]">
                {initial}
              </span>
            ) : (
              <User className="mx-auto mt-1 h-4 w-4 text-[var(--color-text-muted)]" />
            )}
          </div>
          <div className="mx-auto h-0 w-0 border-l-[6px] border-r-[6px] border-t-[8px] border-l-transparent border-r-transparent border-t-[var(--kpi-info)]" />
        </div>
      </div>

      <div className="absolute bottom-2 left-2 text-[10px] text-[var(--color-text-faint)]">Preview map</div>
    </div>
  );
}

function GoogleSiteVisitMap({ employee, className = "" }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const [mapType, setMapType] = useState("roadmap");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  const placeMarker = useCallback((maps, map, emp) => {
    if (markerRef.current) {
      markerRef.current.setMap(null);
      markerRef.current = null;
    }
    const loc = getEmployeeMapLocation(emp);
    markerRef.current = new maps.Marker({
      map,
      position: loc,
      icon: buildMarkerIcon(maps, emp?.initials || emp?.name?.slice(0, 2)),
      title: emp?.name || "Employee",
    });
    map.panTo(loc);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError("");

    loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !containerRef.current) return;
        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            center: getEmployeeMapLocation(employee),
            zoom: 14,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            zoomControl: true,
          });
        }
        placeMarker(maps, mapRef.current, employee);
        setReady(true);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Map unavailable");
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- map instance is created once per mount
  }, [placeMarker]);

  useEffect(() => {
    if (!ready || !mapRef.current || !window.google?.maps || !employee) return;
    placeMarker(window.google.maps, mapRef.current, employee);
  }, [employee, placeMarker, ready]);

  useEffect(() => {
    if (!mapRef.current || !window.google?.maps) return;
    mapRef.current.setMapTypeId(
      mapType === "satellite"
        ? window.google.maps.MapTypeId.SATELLITE
        : window.google.maps.MapTypeId.ROADMAP
    );
  }, [mapType]);

  const handleRefresh = () => {
    if (!mapRef.current || !window.google?.maps || !employee) return;
    placeMarker(window.google.maps, mapRef.current, employee);
    mapRef.current.setZoom(14);
  };

  const handleFullscreen = () => {
    const el = containerRef.current?.parentElement;
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.();
  };

  if (error) {
    return <MockSiteVisitMap employee={employee} className={className} />;
  }

  return (
    <div className={`relative min-h-[360px] overflow-hidden rounded-lg border border-[var(--color-border-soft)] ${className}`.trim()}>
      <div ref={containerRef} className="absolute inset-0 h-full w-full" aria-label="Employee site visit map" />

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute left-3 top-3 flex overflow-hidden rounded-md border border-[var(--color-border-soft)] bg-white text-xs font-semibold shadow-sm">
          <button
            type="button"
            onClick={() => setMapType("roadmap")}
            className={`px-3 py-1.5 ${mapType === "roadmap" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`}
          >
            Map
          </button>
          <button
            type="button"
            onClick={() => setMapType("satellite")}
            className={`px-3 py-1.5 ${mapType === "satellite" ? "bg-[var(--color-primary)] text-white" : "text-[var(--color-text-muted)]"}`}
          >
            Satellite
          </button>
        </div>
        <button
          type="button"
          onClick={handleFullscreen}
          className="pointer-events-auto absolute right-3 top-3 grid h-8 w-8 place-items-center rounded border border-[var(--color-border-soft)] bg-white text-[var(--color-text-muted)] shadow-sm"
          aria-label="Fullscreen"
        >
          <Maximize2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={handleRefresh}
          className="pointer-events-auto absolute bottom-3 right-3 grid h-8 w-8 place-items-center rounded-full border border-[var(--color-border-soft)] bg-white text-[var(--color-text-muted)] shadow-sm"
          aria-label="Refresh map"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>

      {!ready ? (
        <div className="absolute inset-0 grid place-items-center bg-[var(--color-surface-muted)]/80 text-sm text-[var(--color-text-muted)]">
          Loading map…
        </div>
      ) : null}
    </div>
  );
}

/** Site visit map — uses Google Maps when `VITE_GOOGLE_MAPS_API_KEY` is set, otherwise preview map. */
export default function SiteVisitMap({ employee, className = "" }) {
  if (!employee) return null;
  if (isGoogleMapsConfigured()) {
    return <GoogleSiteVisitMap employee={employee} className={className} />;
  }
  return <MockSiteVisitMap employee={employee} className={className} />;
}
