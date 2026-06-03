import { useGSAP } from "@gsap/react";
import type { RefObject } from "react";
import { gsap, ScrollTrigger } from "../lib/gsap";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type ScrollStaggerOptions = {
  selector: string;
  scrollerRef?: RefObject<HTMLElement | null>;
  start?: string;
  y?: number;
  duration?: number;
  stagger?: number;
};

/** Scroll-driven stagger reveal; does not pre-hide elements (avoids stuck invisible cards). */
export function useScrollStagger(
  scopeRef: RefObject<HTMLElement | null>,
  deps: unknown[],
  options: ScrollStaggerOptions
) {
  const reduced = usePrefersReducedMotion();
  const {
    selector,
    scrollerRef,
    start = "top 88%",
    y = 24,
    duration = 0.45,
    stagger = 0.07,
  } = options;

  useGSAP(
    () => {
      if (reduced) return;
      const scope = scopeRef.current;
      if (!scope) return;

      const scroller = scrollerRef?.current ?? undefined;
      const cards = gsap.utils.toArray<HTMLElement>(scope.querySelectorAll(selector));
      if (!cards.length) return;

      ScrollTrigger.batch(cards, {
        scroller,
        start,
        once: true,
        onEnter: (batch) => {
          gsap.fromTo(
            batch,
            { autoAlpha: 0, y },
            {
              autoAlpha: 1,
              y: 0,
              duration,
              stagger,
              ease: "power2.out",
              clearProps: "opacity,visibility,transform",
              overwrite: "auto",
            }
          );
        },
      });

      requestAnimationFrame(() => ScrollTrigger.refresh());
    },
    { scope: scopeRef, dependencies: deps }
  );
}
