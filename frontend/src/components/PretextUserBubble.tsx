import { useMemo } from "react";
import { computeTightBubbleWidth } from "../lib/pretextTypography";
import { usePrefersReducedMotion } from "../hooks/usePrefersReducedMotion";

type Props = {
  text: string;
  containerWidth: number;
};

export default function PretextUserBubble({ text, containerWidth }: Props) {
  const reduced = usePrefersReducedMotion();

  const layout = useMemo(() => {
    if (reduced || !text.trim()) return null;
    try {
      return computeTightBubbleWidth(text, containerWidth);
    } catch {
      return null;
    }
  }, [text, containerWidth, reduced]);

  return (
    <div
      className="rounded-2xl bg-brand-600 text-white text-[15px] leading-[1.65] whitespace-pre-wrap break-words px-4 py-3 shadow-sm"
      style={
        layout
          ? {
              width: layout.width,
              minHeight: layout.minHeight,
              maxWidth: `${Math.floor(containerWidth * 0.85)}px`,
            }
          : { maxWidth: "85%" }
      }
    >
      {text}
    </div>
  );
}
