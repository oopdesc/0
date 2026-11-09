import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import "./concept-pathway.css";

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
  const opener = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const modal = dialog.current;
    modal?.showModal();
    restoreViewport?.();
    return () => {
      if (modal) {
        modal.close();
        opener.current?.focus({ preventScroll: true });
      }
    };
  }, [expanded, restoreViewport]);

  return (
    <>
      <div className="concept-map-actions">
        <button
          ref={opener}
          type="button"
          className="concept-map-expand"
          aria-haspopup="dialog"
          onClick={() => setExpanded(true)}
        >
          全画面で見る <span aria-hidden="true">⤢</span>
        </button>
      </div>
      {expanded ? (
        <dialog
          ref={dialog}
          className="concept-map-fullscreen"
          aria-label={label}
          onCancel={(event) => {
            event.preventDefault();
            setExpanded(false);
          }}
        >
          <header className="concept-map-fullscreen-bar">
            <strong>{label}</strong>
            <button type="button" onClick={() => setExpanded(false)} autoFocus>
              全画面を閉じる
            </button>
          </header>
          {children}
        </dialog>
      ) : children}
    </>
  );
}
