import { useState, useRef, useEffect, useCallback } from "react";
import {
  Camera,
  RotateCw,
  RefreshCw,
  ZoomIn,
  ZoomOut,
  Upload,
  Trash2,
  Check,
  X,
  Move,
} from "lucide-react";
import Button from "../common/Button";
import { useToast } from "../../context/ToastContext";

export default function AdjustProfilePhotoModal({
  open,
  onClose,
  initialImage,
  onSave,
  onRemove,
  userName = "User",
}) {
  const { addToast } = useToast();
  const fileInputRef = useRef(null);

  const [imageSrc, setImageSrc] = useState(initialImage || null);
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0); // 0, 90, 180, 270
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });
  const [saving, setSaving] = useState(false);

  const containerRef = useRef(null);
  const imgRef = useRef(null);

  // Sync initial image when modal opens
  useEffect(() => {
    if (open) {
      setImageSrc(initialImage || null);
      setZoom(1);
      setRotation(0);
      setPan({ x: 0, y: 0 });
    }
  }, [open, initialImage]);

  const handleImageLoad = (e) => {
    const { naturalWidth, naturalHeight } = e.target;
    setNaturalDimensions({ width: naturalWidth, height: naturalHeight });
    setZoom(1);
    setPan({ x: 0, y: 0 });
    setRotation(0);
  };

  const handleFileSelect = (file) => {
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      addToast("Image size must be less than 5MB", "error");
      return;
    }

    const validTypes = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!validTypes.includes(file.type)) {
      addToast("Only PNG, JPG, and WebP images are supported", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result;
      if (typeof dataUrl === "string") {
        setImageSrc(dataUrl);
        setZoom(1);
        setRotation(0);
        setPan({ x: 0, y: 0 });
      }
    };
    reader.onerror = () => {
      addToast("Failed to read image file", "error");
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelect(file);
    }
    e.target.value = "";
  };

  const handleMouseDown = (e) => {
    if (!imageSrc) return;
    e.preventDefault();
    setIsDragging(true);
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleTouchStart = (e) => {
    if (!imageSrc || !e.touches[0]) return;
    setIsDragging(true);
    setDragStart({
      x: e.touches[0].clientX - pan.x,
      y: e.touches[0].clientY - pan.y,
    });
  };

  const handleTouchMove = (e) => {
    if (!isDragging || !e.touches[0]) return;
    setPan({
      x: e.touches[0].clientX - dragStart.x,
      y: e.touches[0].clientY - dragStart.y,
    });
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  const handleReset = () => {
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleCropAndSave = async () => {
    if (!imageSrc) return;
    setSaving(true);

    try {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.src = imageSrc;

      await new Promise((resolve, reject) => {
        if (img.complete) {
          resolve();
        } else {
          img.onload = resolve;
          img.onerror = reject;
        }
      });

      const outputSize = 400; // High quality 400x400
      const canvas = document.createElement("canvas");
      canvas.width = outputSize;
      canvas.height = outputSize;
      const ctx = canvas.getContext("2d");

      if (!ctx) {
        throw new Error("Could not get canvas context");
      }

      // Smooth rendering
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";

      // Viewport dimension in the UI (square crop is 220px)
      const viewportSize = 220;
      const scaleFactor = outputSize / viewportSize;

      // Center the context
      ctx.translate(outputSize / 2, outputSize / 2);

      // Apply rotation
      ctx.rotate((rotation * Math.PI) / 180);

      // Apply pan (scaled to output size)
      let panX = pan.x * scaleFactor;
      let panY = pan.y * scaleFactor;

      // Adjust pan coordinates depending on rotation
      if (rotation === 90) {
        const temp = panX;
        panX = panY;
        panY = -temp;
      } else if (rotation === 180) {
        panX = -panX;
        panY = -panY;
      } else if (rotation === 270) {
        const temp = panX;
        panX = -panY;
        panY = temp;
      }

      ctx.translate(panX, panY);

      // Calculate base image dimensions to fill viewport
      const { width: nw, height: nh } = naturalDimensions;
      if (nw > 0 && nh > 0) {
        let drawWidth, drawHeight;
        if (nw > nh) {
          drawHeight = outputSize * zoom;
          drawWidth = (nw / nh) * drawHeight;
        } else {
          drawWidth = outputSize * zoom;
          drawHeight = (nh / nw) * drawWidth;
        }

        ctx.drawImage(img, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      } else {
        // Fallback
        const drawSize = outputSize * zoom;
        ctx.drawImage(img, -drawSize / 2, -drawSize / 2, drawSize, drawSize);
      }

      const croppedDataUrl = canvas.toDataURL("image/jpeg", 0.92);
      onSave?.(croppedDataUrl);
      addToast("Profile photo updated successfully!", "success");
      onClose?.();
    } catch (err) {
      console.error("Failed to crop photo:", err);
      addToast("Failed to save adjusted photo", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm animate-in fade-in duration-200"
      onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileInputChange}
        accept="image/png,image/jpeg,image/jpg,image/webp"
        className="hidden"
      />

      <div
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 dark:text-slate-100">
                Adjust Profile Photo
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Drag to reposition
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Crop / Preview Area */}
        <div className="p-5">
          {imageSrc ? (
            <div className="flex flex-col items-center">
              {/* Viewport Box */}
              <div
                ref={containerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                className="relative flex h-[240px] w-[240px] select-none items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-inner cursor-grab active:cursor-grabbing dark:border-slate-700"
              >
                {/* Image being transformed */}
                <div
                  className="absolute pointer-events-none transition-transform duration-75 ease-out"
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) rotate(${rotation}deg) scale(${zoom})`,
                  }}
                >
                  <img
                    ref={imgRef}
                    src={imageSrc}
                    alt="Profile preview"
                    onLoad={handleImageLoad}
                    className="max-h-[220px] max-w-[220px] object-contain pointer-events-none"
                    draggable={false}
                  />
                </div>

                {/* Dark mask with square crop boundary */}
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    boxShadow: "0 0 0 9999px rgba(15, 23, 42, 0.65)",
                    borderRadius: "0",
                    margin: "10px",
                    border: "2px solid rgba(20, 184, 166, 0.9)",
                  }}
                />

                {/* Drag hint overlay badge */}
                <div className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-medium text-slate-200 backdrop-blur-sm flex items-center gap-1">
                  <Move className="h-2.5 w-2.5" /> Drag to position
                </div>
              </div>

              {/* Action buttons (Rotate, Reset, Zoom In/Out, Change) */}
              <div className="mt-4 w-full">
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      onClick={handleRotate}
                      title="Rotate 90°"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <RotateCw className="h-3.5 w-3.5" />
                      Rotate
                    </button>
                    <button
                      type="button"
                      onClick={handleReset}
                      title="Reset position and zoom"
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Reset
                    </button>

                    <div className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />

                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.max(0.5, +(z - 0.1).toFixed(2)))}
                      title="Zoom Out"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <ZoomOut className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setZoom((z) => Math.min(3, +(z + 0.1).toFixed(2)))}
                      title="Zoom In"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >
                      <ZoomIn className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="inline-flex items-center gap-1 rounded-lg border border-teal-200 bg-teal-50 px-2.5 py-1.5 text-xs font-semibold text-teal-700 hover:bg-teal-100 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-300"
                  >
                    <Upload className="h-3.5 w-3.5" />
                    New Photo
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Upload Empty State */
            <div
              onClick={() => fileInputRef.current?.click()}
              className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 p-8 text-center transition-colors hover:border-teal-500 hover:bg-teal-50/20 dark:border-slate-700 dark:hover:border-teal-500/50 dark:hover:bg-teal-950/20"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-50 text-teal-600 dark:bg-teal-950/50 dark:text-teal-400">
                <Upload className="h-7 w-7" />
              </div>
              <h4 className="mt-3 text-sm font-bold text-slate-900 dark:text-slate-100">
                Choose Profile Photo
              </h4>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Supports PNG, JPG, JPEG up to 5MB
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                leftIcon={<Camera className="h-3.5 w-3.5" />}
              >
                Browse Files
              </Button>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/70 px-5 py-3 dark:border-slate-800 dark:bg-slate-900/50">
          {imageSrc && onRemove ? (
            <button
              type="button"
              onClick={() => {
                onRemove?.();
                setImageSrc(null);
                onClose?.();
              }}
              className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400"
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remove Photo
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            {imageSrc && (
              <Button
                variant="primary"
                size="sm"
                loading={saving}
                onClick={handleCropAndSave}
                leftIcon={<Check className="h-3.5 w-3.5" />}
              >
                Save Photo
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
