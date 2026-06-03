import { useCallback, useEffect, useRef, useState } from "react";

export type FlashTone = "success" | "error" | "info";

const DEFAULT_MS: Record<FlashTone, number> = {
  success: 3500,
  error: 6000,
  info: 4000,
};

export function useFlashMessage() {
  const [message, setMessage] = useState("");
  const [tone, setTone] = useState<FlashTone>("info");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearMessage = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setMessage("");
  }, []);

  const showMessage = useCallback(
    (msg: string, options?: { tone?: FlashTone; duration?: number }) => {
      if (!msg) {
        clearMessage();
        return;
      }
      const t = options?.tone ?? (msg.includes("失败") || msg.includes("错误") ? "error" : "success");
      const ms = options?.duration ?? DEFAULT_MS[t];
      if (timerRef.current) clearTimeout(timerRef.current);
      setMessage(msg);
      setTone(t);
      if (ms > 0) {
        timerRef.current = setTimeout(() => {
          setMessage("");
          timerRef.current = null;
        }, ms);
      }
    },
    [clearMessage]
  );

  useEffect(
    () => () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    },
    []
  );

  return { message, tone, showMessage, clearMessage };
}
