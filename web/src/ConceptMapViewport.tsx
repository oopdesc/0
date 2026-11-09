import { useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./concept-pathway.css";

export const MAP_ZOOM_LEVELS = [0.5, 0.65, 0.8, 1, 1.25];

export default function ConceptMapViewport({
  label,
  children,
  restoreViewport,
}: {
  label: string;
  children: ReactNode;
  restoreViewport?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const id = useId();
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const close = useRef<HTMLButtonElement>(null);
  const wasExpanded = useRef(false);

  useLayoutEffect(() => {
    const modal = dialog.current;
    if (!modal) return;
    if (expanded && !modal.matches(":modal")) {
      modal.open = false;
      modal.showModal();
      close.current?.focus({ preventScroll: true });
    } else if (!expanded) {
      if (modal.matches(":modal")) modal.close();
      modal.open = true;
      if (wasExpanded.current) opener.current?.focus({ preventScroll: true });
    }
    restoreViewport?.();
    wasExpanded.current = expanded;
  }, [expanded, restoreViewport]);

  return (
    <>
      <div className="concept-map-actions">
        <button
          ref={opener}
          type="button"
          className="concept-map-expand"
          aria-haspopup="dialog"
          aria-controls={id}
          aria-expanded={expanded}
          onClick={() => setExpanded(true)}
        >
          全画面で見る <span aria-hidden="true">⤢</span>
        </button>
      </div>
      <dialog
        ref={dialog}
        id={id}
        className={expanded ? "concept-map-fullscreen" : "concept-map-inline"}
        role={expanded ? undefined : "group"}
        aria-label={label}
        onCancel={(event) => {
          event.preventDefault();
          setExpanded(false);
        }}
      >
        {expanded && (
          <header className="concept-map-fullscreen-bar">
            <strong>{label}</strong>
            <button ref={close} type="button" onClick={() => setExpanded(false)}>
              全画面を閉じる
            </button>
          </header>
        )}
        {children}
      </dialog>
    </>
  );
}
