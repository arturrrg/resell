import { ArrowUpRight } from "lucide-react";
import "./create-offer-button.css";

export function CreateOfferButton({ onClick }: { onClick: () => void }) {
  return <button className="create-offer-button" onClick={onClick}>Create an offer<ArrowUpRight /></button>;
}
