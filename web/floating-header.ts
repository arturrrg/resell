import { useEffect, useCallback, useState } from "react";
export function useFloatingHeader() {
  const [node, setNode] = useState<HTMLElement | null>(null);
  const ref = useCallback(
    (element: HTMLElement | null) => setNode(element),
    [],
  );
  useEffect(() => {
    if (!node) return;
    let frame = 0;
    let cards: Element | null = null;
    const update = () => {
      frame = 0;
      const header = node;
      if (!cards?.isConnected)
        cards = header.parentElement?.querySelector(".inventory") || null;
      const next = String(
        !!cards &&
          cards.getBoundingClientRect().top <
            header.getBoundingClientRect().bottom,
      );
      if (header.dataset.floating !== next) header.dataset.floating = next;
    };
    const scroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const paneScroll = (event: Event) => {
      if (
        event.target instanceof Element &&
        event.target.classList.contains("inventory-page")
      )
        scroll();
    };
    node.parentElement?.addEventListener("scroll", paneScroll, {
      passive: true,
      capture: true,
    });
    update();
    window.addEventListener("scroll", scroll, { passive: true });
    window.addEventListener("resize", scroll, { passive: true });
    // Inventory arrives asynchronously and changes when switching workspaces.
    const changes = new MutationObserver((records) => {
      // Counter text, image layers and chart readouts do not move the toolbar.
      if (
        records.some(
          ({ target }) =>
            target === node.parentElement ||
            (target instanceof Element &&
              target.classList.contains("workspace-page")),
        )
      )
        scroll();
    });
    if (node.parentElement)
      changes.observe(node.parentElement, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ["hidden"],
      });
    return () => {
      cancelAnimationFrame(frame);
      node.parentElement?.removeEventListener("scroll", paneScroll, true);
      window.removeEventListener("scroll", scroll);
      window.removeEventListener("resize", scroll);
      changes.disconnect();
    };
  }, [node]);
  return ref;
}
