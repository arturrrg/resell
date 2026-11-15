import { useRef, useState, type ChangeEvent } from "react";
import { Camera, ChevronRight, Images, ImagePlus, LoaderCircle } from "lucide-react";
import { Sheet } from "../sheet";
import "./add-offer-photos.css";

export function AddOfferPhotos({ disabled, onChange, onCamera }: {
  disabled: boolean;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onCamera?: () => void;
}) {
  const gallery = useRef<HTMLInputElement>(null);
  const camera = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
    || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function choose(source: "camera" | "gallery") {
    setOpen(false);
    if (source === "camera" && onCamera) { onCamera(); return; }
    (source === "camera" ? camera : gallery).current?.click();
  }
  return <>
    <input ref={gallery} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onChange} aria-label="Choose offer photos from gallery" />
    <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={onChange} aria-label="Take offer photo" />
    <button className="studio-add-photo" onClick={() => mobile ? setOpen(true) : choose("gallery")} disabled={disabled}>
      {disabled ? <LoaderCircle className="spinning" /> : <ImagePlus />}
      <span>Add photos</span>
    </button>
    {open && <Sheet title="Add photos" onClose={() => setOpen(false)} className="offer-photo-source-sheet">
      <div className="offer-photo-sources">
        <button onClick={() => choose("camera")}><Camera /><span>Camera</span><ChevronRight /></button>
        <button onClick={() => choose("gallery")}><Images /><span>Gallery</span><ChevronRight /></button>
      </div>
    </Sheet>}
  </>;
}
