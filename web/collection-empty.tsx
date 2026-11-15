import type { ReactNode } from "react";
import { CreateOfferButton } from "./offers/create-offer-button";
import "./collection-empty.css";

export function CollectionEmpty({ title, description, onCreate, illustration }: { title: string; description: string; onCreate?: () => void; illustration?: ReactNode }) {
  return <div className="collection-empty"><div className="collection-empty-content">{illustration && <div className="collection-empty-illustration" aria-hidden="true">{illustration}</div>}<h1>{title}</h1><p>{description}</p>{onCreate && <CreateOfferButton onClick={onCreate} />}</div></div>;
}
