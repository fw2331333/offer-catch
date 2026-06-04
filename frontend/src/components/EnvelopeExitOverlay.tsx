import { useGSAP } from "@gsap/react";
import { useEffect, useRef } from "react";
import { gsap } from "../lib/gsap";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

const LETTER_NESTED_Y = 56;
const ENVELOPE_DROP_Y = 240;

type Props = {
  onComplete: () => void;
};

/** 登录启封动画的倒放：信笺收回信封后跳转登录页 */
export default function EnvelopeExitOverlay({ onComplete }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const envelopeRef = useRef<HTMLDivElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);
  const pocketRef = useRef<HTMLDivElement>(null);
  const letterRef = useRef<HTMLDivElement>(null);
  const reduced = usePrefersReducedMotion();
  const onCompleteRef = useRef(onComplete);
  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useGSAP(
    () => {
      if (reduced) {
        onCompleteRef.current();
        return;
      }
      const bg = bgRef.current;
      const stage = stageRef.current;
      const envelope = envelopeRef.current;
      const flap = flapRef.current;
      const pocket = pocketRef.current;
      const letter = letterRef.current;
      if (!bg || !stage || !envelope || !flap || !pocket || !letter) {
        onCompleteRef.current();
        return;
      }

      gsap.set(bg, { autoAlpha: 1 });
      gsap.set(stage, { autoAlpha: 1, y: 0 });
      gsap.set(letter, { y: 0, scale: 1, autoAlpha: 1 });
      gsap.set(flap, { rotateX: 108, transformOrigin: "50% 0%" });
      gsap.set(envelope, {
        left: "50%",
        top: "50%",
        xPercent: -50,
        yPercent: -50,
        y: ENVELOPE_DROP_Y,
        rotateX: 22,
        autoAlpha: 0,
        transformOrigin: "50% 20%",
      });
      gsap.set(pocket, { y: 48, autoAlpha: 0 });

      const tl = gsap.timeline({ onComplete: () => onCompleteRef.current() });

      tl.to(letter, {
        y: LETTER_NESTED_Y,
        scale: 0.97,
        autoAlpha: 0,
        duration: 0.55,
        ease: "power2.in",
      })
        .to(
          envelope,
          {
            y: 0,
            rotateX: 0,
            autoAlpha: 1,
            duration: 0.65,
            ease: "power2.out",
          },
          0.2
        )
        .to(
          pocket,
          { y: 0, autoAlpha: 1, duration: 0.45, ease: "power2.out" },
          0.28
        )
        .to(
          flap,
          { rotateX: 0, duration: 0.5, ease: "power2.inOut" },
          0.45
        )
        .to(stage, { autoAlpha: 0, duration: 0.35 }, 0.85)
        .to(bg, { autoAlpha: 0, duration: 0.3 }, 0.9);
    },
    { scope: root, dependencies: [reduced] }
  );

  if (reduced) return null;

  return (
    <div ref={root} className="fixed inset-0 z-[70] overflow-hidden">
      <div ref={bgRef} className="absolute inset-0 bg-gray-50" aria-hidden />
      <div className="relative min-h-screen flex flex-col items-center justify-center px-4">
        <div
          ref={stageRef}
          className="relative flex w-full max-w-[400px] items-center justify-center"
          style={{ perspective: "1200px", minHeight: "min(72vh, 520px)" }}
        >
          <div
            ref={letterRef}
            className="relative z-10 mx-auto w-full max-w-[340px] rounded-2xl border border-gray-100 bg-white px-6 py-8 shadow-lg text-center"
          >
            <p className="text-sm text-gray-500">正在退出…</p>
          </div>

          <div
            ref={envelopeRef}
            className="absolute z-20 h-[248px] w-full max-w-[400px] rounded-2xl pointer-events-none"
            style={{ transformStyle: "preserve-3d", left: "50%", top: "50%" }}
            aria-hidden
          >
            <div className="absolute inset-0 rounded-2xl border border-gray-200 bg-white shadow-md" />
            <div
              ref={flapRef}
              className="absolute left-0 right-0 top-0 z-30 h-[56%]"
              style={{ transformStyle: "preserve-3d", transformOrigin: "50% 0%" }}
            >
              <div
                className="w-full h-full"
                style={{
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  background: "linear-gradient(180deg, #f9fafb 0%, #e5e7eb 100%)",
                }}
              />
              <div className="absolute left-1/2 top-[42%] -translate-x-1/2 w-11 h-11 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-bold ring-4 ring-white">
                O
              </div>
            </div>
            <div ref={pocketRef} className="absolute left-0 right-0 bottom-0 z-20 h-[58%]">
              <div
                className="absolute inset-0 rounded-b-2xl"
                style={{
                  clipPath: "polygon(0 38%, 50% 5%, 100% 38%, 100% 100%, 0 100%)",
                  background: "linear-gradient(180deg, #f3f4f6 0%, #e5e7eb 100%)",
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
