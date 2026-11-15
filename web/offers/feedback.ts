import { inNativeApp } from "./native";
export function selectionFeedback() {
  if (inNativeApp()) {
    const native = (window as any).__TAURI__.core;
    void native.invoke("offer_haptic").catch(() => {});
  } else navigator.vibrate?.(12);
}
