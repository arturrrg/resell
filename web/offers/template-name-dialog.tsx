import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import { Sheet } from "../sheet";

export function TemplateNameDialog({ initialName, onClose, onSave }: {
  initialName: string; onClose: () => void; onSave: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState(initialName), [busy, setBusy] = useState(false), [error, setError] = useState("");
  return <Sheet title="Save template" centered className="template-save-sheet" onClose={() => { if (!busy) onClose(); }}>
    <form onSubmit={async event => {
      event.preventDefault(); if (!name.trim() || busy) return;
      setBusy(true); setError("");
      try { await onSave(name.trim()); } catch (e) { setError((e as Error).message); setBusy(false); }
    }}>
      <label className="template-name-field"><span>Name</span><input aria-label="Template name" autoFocus autoComplete="off" maxLength={100} value={name} disabled={busy} onChange={event => setName(event.target.value)} /></label>
      {error && <p role="alert">{error}</p>}
      <button className="studio-primary" disabled={busy || !name.trim()}>{busy && <LoaderCircle className="spinning" />}Save</button>
    </form>
  </Sheet>;
}
