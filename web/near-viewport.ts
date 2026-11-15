import { useEffect, useState, type RefObject } from "react";

// One observer for the inventory, rather than one per card. Hidden cards stop
// warming neighbors; native image lazy-loading still handles the current photo.
const listeners = new Map<Element, (near: boolean) => void>();
let observer: IntersectionObserver | undefined;
export function useNearViewport(ref: RefObject<Element | null>) {
  const [near, setNear] = useState(false);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    observer ||= new IntersectionObserver(
      (entries) => {
        for (const entry of entries)
          listeners.get(entry.target)?.(entry.isIntersecting);
      },
      { rootMargin: "160px" },
    );
    listeners.set(element, setNear);
    observer.observe(element);
    return () => {
      observer?.unobserve(element);
      listeners.delete(element);
      if (!listeners.size) {
        observer?.disconnect();
        observer = undefined;
      }
    };
  }, [ref]);
  return near;
}
