import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { selectionFeedback } from "./feedback";
export function useHoldAction(onHold: () => void) {
  const callback = useRef(onHold);
  callback.current = onHold;
  const state = useRef<{
    x: number;
    y: number;
    timer?: ReturnType<typeof setTimeout>;
    held: boolean;
  }>({ x: 0, y: 0, held: false });
  const cancel = () => clearTimeout(state.current.timer);
  useEffect(() => cancel, []);
  return {
    cancelHold: cancel,
    onPointerDown(event: ReactPointerEvent) {
      if (event.button !== 0) return;
      cancel();
      state.current = { x: event.clientX, y: event.clientY, held: false };
      state.current.timer = setTimeout(() => {
        state.current.held = true;
        selectionFeedback();
        callback.current();
      }, 450);
    },
    onPointerMove(event: ReactPointerEvent) {
      if (
        Math.hypot(
          event.clientX - state.current.x,
          event.clientY - state.current.y,
        ) > 10
      )
        cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu(event: React.MouseEvent) {
      event.preventDefault();
      cancel();
      if (!state.current.held) {
        state.current.held = true;
        selectionFeedback();
        callback.current();
      }
    },
    consumeClick() {
      const held = state.current.held;
      state.current.held = false;
      return held;
    },
  };
}
