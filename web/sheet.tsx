import { useEffect, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { restoreDialogFocus } from "./pointer-intent";
import { useBackAction, backActions } from "./back-navigation";
export function Sheet({
  title,
  onClose,
  children,
  wide = false,
  className = "",
  hideTitle = false,
  suspended = false,
  centered = false,
  headerActions,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  hideTitle?: boolean;
  suspended?: boolean;
  centered?: boolean;
  headerActions?: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const inactive = useRef(suspended);
  inactive.current = suspended;
  useBackAction(!suspended, onClose);
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    return () => {
      ref.current?.close();
      restoreDialogFocus(before);
    };
  }, []);
  useEffect(() => {
    if (suspended) ref.current?.close();
    else if (!ref.current?.open) ref.current?.showModal();
  }, [suspended]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!centered || !viewport) return;
    const fit = () => {
      const dialog = ref.current;
      if (!dialog) return;
      dialog.style.top = viewport.offsetTop + "px";
      dialog.style.bottom = Math.max(0, innerHeight - viewport.height - viewport.offsetTop) + "px";
      dialog.style.maxHeight = Math.max(180, viewport.height - 24) + "px";
    };
    fit(); viewport.addEventListener("resize", fit); viewport.addEventListener("scroll", fit);
    return () => { viewport.removeEventListener("resize", fit); viewport.removeEventListener("scroll", fit); };
  }, [centered]);
  return createPortal(
    <dialog
      ref={ref}
      className={`workspace-sheet ${wide ? "sheet-wide" : ""} ${centered ? "sheet-centered" : ""} ${className}`}
      aria-label={title}
      onCancel={(e) => {
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        e.stopPropagation();
        if (!backActions.handleSystem()) onClose();
      }}
      onClick={(e) => {
        if (e.currentTarget !== e.target) return;
        const bounds = e.currentTarget.getBoundingClientRect();
        if (e.clientX < bounds.left || e.clientX > bounds.right || e.clientY < bounds.top || e.clientY > bounds.bottom) onClose();
      }}
      onClose={event => {
        if (event.target !== event.currentTarget) return;
        // Some repeated platform close requests are non-cancellable. A route
        // Back may have changed this sheet's contents without unmounting it.
        // Reconcile that still-mounted route; a real dismissal unmounts it.
        queueMicrotask(() => {
          const node = ref.current;
          if (!node?.isConnected || node.open || inactive.current) return;
          node.style.animation = "none";
          node.showModal();
        });
      }}
    >
      <div className="sheet-heading">
        {!hideTitle && <h2>{title}</h2>}
        {headerActions}
        <button aria-label={`Close ${title}`} onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>,
    document.body,
  );
}
