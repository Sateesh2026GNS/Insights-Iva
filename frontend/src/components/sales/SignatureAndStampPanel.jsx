import { useCallback, useEffect, useRef, useState } from "react";
import { Check, Upload, X } from "lucide-react";

const PRIMARY = "var(--color-primary)";

function paintCanvasStyle(ctx) {
  ctx.strokeStyle = "#1a1a1f";
  ctx.lineWidth = 2;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
}

/**
 * Signature pad + stamp upload for Create Invoice (screenshot match).
 */
export default function SignatureAndStampPanel({
  companyName = "My Company",
  enabled,
  signatureDataUrl,
  stampDataUrl,
  onSignatureChange,
  onStampChange,
}) {
  const canvasRef = useRef(null);
  const drawing = useRef(false);
  const fileRef = useRef(null);
  const dirtyRef = useRef(false);
  const [savedFlash, setSavedFlash] = useState(false);

  const sizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const parent = canvas.parentElement;
    if (!parent) return;

    const w = Math.max(Math.floor(parent.clientWidth), 280);
    const h = 140;
    if (canvas.width === w && canvas.height === h) return;

    const prev = canvas.width > 0 ? canvas.toDataURL("image/png") : null;
    const hadInk = dirtyRef.current || Boolean(prev && prev.length > 100);

    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    paintCanvasStyle(ctx);

    if (!hadInk || !prev) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      paintCanvasStyle(ctx);
    };
    img.src = prev;
  }, []);

  // Size canvas when shown / on resize — do not depend on signatureDataUrl
  // (that was wiping strokes and breaking Clear/Save).
  useEffect(() => {
    if (!enabled) return;
    const id = requestAnimationFrame(() => sizeCanvas());
    window.addEventListener("resize", sizeCanvas);
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("resize", sizeCanvas);
    };
  }, [enabled, sizeCanvas]);

  // Restore saved signature from parent without resetting dimensions.
  useEffect(() => {
    if (!enabled) return;
    const canvas = canvasRef.current;
    if (!canvas || !canvas.width) return;
    const ctx = canvas.getContext("2d");
    if (!signatureDataUrl) {
      if (!dirtyRef.current) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        paintCanvasStyle(ctx);
      }
      return;
    }
    if (dirtyRef.current) return;
    const img = new Image();
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      paintCanvasStyle(ctx);
    };
    img.src = signatureDataUrl;
  }, [enabled, signatureDataUrl]);

  if (!enabled) return null;

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const src = e.touches ? e.touches[0] : e;
    return {
      x: ((src.clientX - rect.left) / rect.width) * canvas.width,
      y: ((src.clientY - rect.top) / rect.height) * canvas.height,
    };
  };

  const start = (e) => {
    e.preventDefault();
    drawing.current = true;
    dirtyRef.current = true;
    const ctx = canvasRef.current.getContext("2d");
    paintCanvasStyle(ctx);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current.getContext("2d");
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => {
    drawing.current = false;
  };

  const clear = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    paintCanvasStyle(ctx);
    dirtyRef.current = false;
    setSavedFlash(false);
    onSignatureChange?.(null);
  };

  const save = (e) => {
    e.preventDefault();
    e.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Detect blank canvas (all transparent / white)
    const blank = (() => {
      try {
        const { data } = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height);
        for (let i = 3; i < data.length; i += 4) {
          if (data[i] !== 0) return false;
        }
        return true;
      } catch {
        return false;
      }
    })();
    if (blank) {
      dirtyRef.current = false;
      onSignatureChange?.(null);
      setSavedFlash(false);
      return;
    }
    const url = canvas.toDataURL("image/png");
    dirtyRef.current = false;
    onSignatureChange?.(url);
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1500);
  };

  const onStampFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => onStampChange?.(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  return (
    <div className="border-t border-[#ececf0] px-4 py-6 text-center">
      <p className="text-[13px] text-[#4a4a55]">
        Certified that the particular given above are true and correct,
      </p>
      <p className="mt-1 text-[13px] font-semibold text-[#1a1a1f]">For, {companyName}</p>

      <div className="relative mx-auto mt-4 max-w-sm overflow-hidden rounded-lg border border-dashed border-[#c4c4cc] bg-white">
        {stampDataUrl ? (
          <img
            src={stampDataUrl}
            alt="Stamp"
            className="pointer-events-none absolute bottom-8 right-3 z-[1] h-16 w-16 object-contain opacity-80"
          />
        ) : null}
        <canvas
          ref={canvasRef}
          className="relative z-0 block h-[140px] w-full touch-none cursor-crosshair"
          onMouseDown={start}
          onMouseMove={move}
          onMouseUp={end}
          onMouseLeave={end}
          onTouchStart={start}
          onTouchMove={move}
          onTouchEnd={end}
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-2 z-10 flex items-center justify-center gap-5">
          <button
            type="button"
            onClick={clear}
            onMouseDown={(e) => e.stopPropagation()}
            className="pointer-events-auto inline-flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: PRIMARY }}
          >
            <X className="h-3.5 w-3.5" /> Clear
          </button>
          <button
            type="button"
            onClick={save}
            onMouseDown={(e) => e.stopPropagation()}
            className="pointer-events-auto inline-flex items-center gap-1 text-[12px] font-semibold"
            style={{ color: PRIMARY }}
          >
            <Check className="h-3.5 w-3.5" /> {savedFlash ? "Saved" : "Save"}
          </button>
        </div>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={onStampFile}
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        className="mt-3 inline-flex items-center gap-1.5 text-[13px] font-semibold"
        style={{ color: PRIMARY }}
      >
        <Upload className="h-4 w-4" /> Upload Stamp
      </button>

      <p className="mt-4 text-[13px] font-medium text-[#4a4a55]">Authorised Signatory</p>
    </div>
  );
}
