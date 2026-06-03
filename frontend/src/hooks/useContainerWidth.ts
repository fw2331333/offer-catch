import { useEffect, useState, type RefObject } from "react";

/** Observe container width for Pretext layout (ResizeObserver). */
export function useContainerWidth(ref: RefObject<HTMLElement | null>, fallback = 680): number {
  const [width, setWidth] = useState(fallback);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = () => {
      const next = el.clientWidth;
      if (next > 0) setWidth(next);
    };

    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);

  return width;
}
