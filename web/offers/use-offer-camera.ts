import { useEffect, useRef } from "react";
import type { OfferDraft, OfferPhoto } from "../../shared/offer-draft";
import { inNativeApp } from "./native";
import { saveDraft, savedDrafts } from "./draft-store";
import { prepareOfferPhoto } from "./photo";
import { saveCameraPhoto } from "./camera-recovery";

type CaptureResult = { status: "none" | "ready" | "cancelled"; id?: string; owner?: string; draftId?: string; base64?: string; previewBase64?: string; name?: string };
const invoke = <T,>(command: string, args: Record<string, string>) => (window as any).__TAURI__.core.invoke(command, args) as Promise<T>;

export function useOfferCamera(owner: string, ready: boolean, onRecovered: (draft: OfferDraft) => void, onError: (message: string) => void, onPreview: (draftId: string, photo: OfferPhoto | null) => void) {
  const native = inNativeApp() && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const callbacks = useRef({ onRecovered, onError, onPreview });
  callbacks.current = { onRecovered, onError, onPreview };
  const recovering = useRef(false), launching = useRef(false);
  useEffect(() => {
    if (!native || !ready) return;
    let stopped = false;
    async function recover() {
      if (stopped || recovering.current || document.visibilityState !== "visible") return;
      recovering.current = true;
      let previewDraftId: string | undefined;
      try {
        const result = await invoke<CaptureResult>("pending_offer_photo", { owner });
        if (stopped || result.status === "none") return;
        if (result.owner !== owner || !result.id || !result.draftId) throw Error("The camera result has an invalid destination.");
        let draft: OfferDraft | undefined;
        if (result.status === "ready") {
          if (!(result.previewBase64 || result.base64) || !result.name) throw Error("The camera returned an empty photo.");
          const binary = atob(result.previewBase64 || result.base64!);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
          let file = new File([bytes], result.name, { type: "image/jpeg" });
          previewDraftId = result.draftId;
          callbacks.current.onPreview(result.draftId, { id: result.id, name: result.name, type: "image/jpeg", blob: file });
          // Paint the local image before preparing the full-resolution capture.
          await new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0)));
          if (result.previewBase64) {
            // Read the full local file only after the small preview is painted.
            // No Supabase request is involved in either step.
            const full = await invoke<CaptureResult>("pending_offer_photo", { owner, id: result.id });
            if (full.id !== result.id || full.draftId !== result.draftId || full.owner !== owner || !full.base64) throw Error("The captured photo is no longer available.");
            const raw = atob(full.base64), data = new Uint8Array(raw.length);
            for (let i = 0; i < raw.length; i++) data[i] = raw.charCodeAt(i);
            file = new File([data], result.name, { type: "image/jpeg" });
          }
          const photo = await prepareOfferPhoto(file);
          photo.id = result.id;
          draft = await saveCameraPhoto(owner, result.draftId, photo);
        } else {
          draft = (await savedDrafts(owner)).find(item => item.id === result.draftId);
        }
        // Keep the native file until IndexedDB commits; repeated delivery uses the same photo ID.
        if (!stopped && draft) callbacks.current.onRecovered(draft);
        if (!stopped && previewDraftId) callbacks.current.onPreview(previewDraftId, null);
        await invoke("acknowledge_offer_photo", { owner, id: result.id });
      } catch (error) {
        if (!stopped) callbacks.current.onError(error instanceof Error ? error.message : String(error));
      } finally {
        if (!stopped && previewDraftId) callbacks.current.onPreview(previewDraftId, null);
        recovering.current = false;
      }
    }
    let retry: ReturnType<typeof setTimeout>;
    const wake = () => {
      void recover();
      clearTimeout(retry);
      retry = setTimeout(() => void recover(), 800);
    };
    wake();
    document.addEventListener("visibilitychange", wake);
    window.addEventListener("focus", wake);
    return () => { stopped = true; clearTimeout(retry); document.removeEventListener("visibilitychange", wake); window.removeEventListener("focus", wake); };
  }, [native, owner, ready]);
  async function capture(draft: OfferDraft) {
    if (launching.current) return;
    launching.current = true;
    try {
      await saveDraft(draft, owner);
      await invoke("capture_offer_photo", { owner, id: draft.id });
    } catch (error) {
      callbacks.current.onError(error instanceof Error ? error.message : String(error));
    } finally { launching.current = false; }
  }
  return native ? capture : undefined;
}
