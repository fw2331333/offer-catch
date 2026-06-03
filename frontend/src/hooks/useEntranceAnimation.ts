import { useGSAP } from "@gsap/react";
import type { RefObject } from "react";
import { gsap } from "../lib/gsap";
import { usePrefersReducedMotion } from "./usePrefersReducedMotion";

type EntranceOptions = {
  selector: string;
  y?: number;
  duration?: number;
  stagger?: number;
  delay?: number;
};

/** Safe entrance: explicit end state + clearProps so UI never stays invisible. */
export function useEntranceAnimation(
  scopeRef: RefObject<HTMLElement | null>,
  deps: unknown[],
  options: EntranceOptions
) {
  const reduced = usePrefersReducedMotion();
  const { selector, y = 14, duration = 0.42, stagger = 0.07, delay = 0 } = options;

  useGSAP(
    () => {
      if (reduced) return;
      const scope = scopeRef.current;
      if (!scope) return;

      const els = gsap.utils.toArray<HTMLElement>(scope.querySelectorAll(selector));
      if (!els.length) return;

      gsap.fromTo(
        els,
        { autoAlpha: 0, y },
        {
          autoAlpha: 1,
          y: 0,
          duration,
          stagger,
          delay,
          ease: "power2.out",
          clearProps: "opacity,visibility,transform",
          overwrite: "auto",
        }
      );
    },
    { scope: scopeRef, dependencies: deps }
  );
}
