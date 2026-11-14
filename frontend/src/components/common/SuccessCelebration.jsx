import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Check, X } from "lucide-react";

import {
  CONFETTI_PIECES,
  SUCCESS_CELEBRATION_DURATION_MS,
  buildSuccessCelebrationCopy,
  celebrationInitial,
} from "../../utils/successCelebration";
import "../../styles/success-celebration.css";

export default function SuccessCelebration({
  open,
  name,
  entityType = "user",
  message,
  onClose,
}) {
  const closedRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = () => {
    if (closedRef.current) return;
    closedRef.current = true;
    onCloseRef.current?.();
  };

  useEffect(() => {
    if (!open) {
      closedRef.current = false;
      return undefined;
    }
    closedRef.current = false;
    const timer = window.setTimeout(close, SUCCESS_CELEBRATION_DURATION_MS);
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  if (!open || typeof document === "undefined") return null;

  const copy = buildSuccessCelebrationCopy(entityType, name, message);
  const initial = celebrationInitial(name);

  return createPortal(
    <div
      className="success-celebration"
      role="status"
      aria-live="polite"
      aria-label={copy.title}
      onClick={close}
    >
      <div className="success-celebration__confetti" aria-hidden>
        {CONFETTI_PIECES.map((piece, index) => (
          <span
            key={index}
            className="success-celebration__piece"
            style={{
              left: `${piece.left}%`,
              width: piece.size,
              height: piece.size * 1.4,
              background: piece.color,
              animationDelay: `${piece.delay}s`,
              animationDuration: `${piece.duration}s`,
              transform: `rotate(${piece.rotate}deg)`,
            }}
          />
        ))}
      </div>
      <button
        type="button"
        className="success-celebration__close"
        aria-label="Close celebration"
        onClick={(e) => {
          e.stopPropagation();
          close();
        }}
      >
        <X className="h-5 w-5" aria-hidden />
      </button>
      <div
        className="success-celebration__content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="success-celebration__avatar-wrap">
          <div className="success-celebration__avatar" aria-hidden>
            {initial}
          </div>
          <span className="success-celebration__check" aria-hidden>
            <Check className="h-4 w-4" strokeWidth={3} />
          </span>
        </div>
        <h2 className="success-celebration__title">{copy.title}</h2>
        <p className="success-celebration__message">{copy.message}</p>
      </div>
    </div>,
    document.body
  );
}
