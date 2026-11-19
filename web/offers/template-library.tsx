import { ArrowLeft, Layers3, MoreHorizontal, Plus } from "lucide-react";
import type { ReactNode } from "react";
import type { OfferDraft } from "../../shared/offer-draft";
import { Sheet } from "../sheet";

export function TemplateLibrary({ templates, onClose, onCreate, onUse, onActions, title, children }: {
  templates: OfferDraft[];
  onClose: () => void;
  onCreate: () => void;
  onUse: (draft: OfferDraft) => void;
  onActions: (draft: OfferDraft) => void;
  title?: string;
  children?: ReactNode;
}) {
  return <Sheet title={title || "Templates"} onClose={onClose} className="offer-templates-sheet" headerActions={
    children ? <button className="template-add" aria-label="Back to templates" onClick={onClose}><ArrowLeft /></button> : <button className="template-add" aria-label="New template" onClick={onCreate}><Plus /></button>
  }>
    {children || <div className="template-library-list">
      {templates.map(template => {
        const name = template.templateName || template.title || "Phone template";
        return <div className="template-library-row" key={template.id}>
          <button className="template-library-use" aria-label={`Use template ${name}`} onClick={() => onUse(template)}>
            <span className="template-library-name"><strong translate={template.templateName || template.title ? "no" : "yes"}>{name}</strong></span>
          </button>
          <button className="template-library-more" aria-label={`Actions for template ${name}`} onClick={() => onActions(template)}><MoreHorizontal /></button>
        </div>;
      })}
      {!templates.length && <div className="template-library-empty"><Layers3 /><p>No templates yet.</p></div>}
    </div>}
  </Sheet>;
}
