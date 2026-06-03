import { X } from "lucide-react";
import type { FlashTone } from "../hooks/useFlashMessage";

const STYLES: Record<FlashTone, string> = {
  success: "bg-green-50 text-green-800 border-green-100",
  error: "bg-red-50 text-red-800 border-red-100",
  info: "bg-brand-50 text-brand-800 border-brand-100",
};

interface Props {
  message: string;
  tone?: FlashTone;
  onDismiss: () => void;
}

export default function FlashBanner({ message, tone = "info", onDismiss }: Props) {
  if (!message) return null;
  return (
    <div
      className={`shrink-0 mx-4 mt-3 px-4 py-2 rounded-lg border text-sm flex items-start justify-between gap-3 ${STYLES[tone]}`}
      role="status"
    >
      <span className="flex-1">{message}</span>
      <button
        type="button"
        onClick={onDismiss}
        className="p-0.5 rounded hover:bg-black/5 shrink-0"
        aria-label="关闭提示"
      >
        <X size={16} />
      </button>
    </div>
  );
}
