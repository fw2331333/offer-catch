import {
  layout,
  prepareWithSegments,
  walkLineRanges,
  type PreparedTextWithSegments,
} from "@chenglou/pretext";

/** Matches rendered UI (15px body, system CJK stack). */
export const PRETEXT_BODY_FONT =
  '15px/1.65 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Microsoft YaHei", sans-serif';

export const PRETEXT_BODY_LINE_HEIGHT = 25;
export const PRETEXT_BUBBLE_PAD_X = 16;
export const PRETEXT_BUBBLE_PAD_Y = 12;
export const PRETEXT_BUBBLE_MAX_RATIO = 0.78;

export type WrapMetrics = {
  lineCount: number;
  height: number;
  maxLineWidth: number;
};

export function prepareBubbleText(text: string): PreparedTextWithSegments {
  return prepareWithSegments(text, PRETEXT_BODY_FONT, { whiteSpace: "pre-wrap" });
}

export function collectWrapMetrics(
  prepared: PreparedTextWithSegments,
  maxWidth: number
): WrapMetrics {
  let maxLineWidth = 0;
  const lineCount = walkLineRanges(prepared, maxWidth, (line) => {
    if (line.width > maxLineWidth) maxLineWidth = line.width;
  });
  return {
    lineCount,
    height: lineCount * PRETEXT_BODY_LINE_HEIGHT,
    maxLineWidth,
  };
}

/** Pretext demo: shrink-wrap bubble width without extra horizontal slack. */
export function findTightWrapMetrics(
  prepared: PreparedTextWithSegments,
  maxWidth: number
): WrapMetrics {
  const initial = collectWrapMetrics(prepared, maxWidth);
  let lo = 1;
  let hi = Math.max(1, Math.ceil(maxWidth));

  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const midLineCount = layout(prepared, mid, PRETEXT_BODY_LINE_HEIGHT).lineCount;
    if (midLineCount <= initial.lineCount) {
      hi = mid;
    } else {
      lo = mid + 1;
    }
  }

  return collectWrapMetrics(prepared, lo);
}

export function computeTightBubbleWidth(
  text: string,
  containerWidth: number
): { width: number; minHeight: number } {
  const bubbleMax = Math.floor(containerWidth * PRETEXT_BUBBLE_MAX_RATIO);
  const contentMax = Math.max(48, bubbleMax - PRETEXT_BUBBLE_PAD_X * 2);
  const prepared = prepareBubbleText(text);
  const tight = findTightWrapMetrics(prepared, contentMax);
  const width = Math.min(
    bubbleMax,
    Math.ceil(tight.maxLineWidth) + PRETEXT_BUBBLE_PAD_X * 2
  );
  return {
    width: Math.max(width, 72),
    minHeight: tight.height + PRETEXT_BUBBLE_PAD_Y * 2,
  };
}
