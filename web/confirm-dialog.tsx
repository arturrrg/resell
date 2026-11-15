import { useRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Trash2 } from "lucide-react";
import { restoreDialogFocus } from "./pointer-intent";
import { useBackAction } from "./back-navigation";
export function DeleteDialog({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [working, setWorking] = useState(false),
    [error, setError] = useState("");
  useBackAction(true, () => {
    if (!working) onCancel();
  });
  useEffect(() => {
    const before = document.activeElement as HTMLElement | null,
      overflow = document.body.style.overflow;
    dialog.current?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog.current?.close();
      document.body.style.overflow = overflow;
      restoreDialogFocus(before);
    };
  }, []);
  async function remove() {
    setWorking(true);
    setError("");
    try {
      await onConfirm();
    } catch (e) {
      setError((e as Error).message);
      setWorking(false);
    }
  }
  return createPortal(
    <dialog
      className="confirm-dialog"
      ref={dialog}
      aria-labelledby="delete-title"
      aria-describedby="delete-description"
      onCancel={(e) => {
        e.preventDefault();
        if (!working) onCancel();
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !working) onCancel();
      }}
    >
      <div className="confirmation-body">
        <div className="confirmation-symbol">
          <Trash2 />
        </div>
        <h2 id="delete-title">Delete this device?</h2>
        <p id="delete-description">
          Remove <strong>{name}</strong> from your inventory?
        </p>
        {error && (
          <p role="alert" className="account-notice">
            {error}
          </p>
        )}
        <div className="confirmation-actions">
          <button autoFocus disabled={working} onClick={onCancel}>
            Cancel
          </button>
          <button
            className="destructive"
            disabled={working}
            onClick={() => void remove()}
          >
            {working ? "Deleting…" : "Delete device"}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
}
