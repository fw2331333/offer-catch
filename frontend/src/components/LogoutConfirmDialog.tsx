import { LogOut, X } from "lucide-react";

type Props = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

/** 与登录信笺风格一致的退出确认框 */
export default function LogoutConfirmDialog({ open, onCancel, onConfirm }: Props) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/35 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="logout-confirm-title"
      onClick={onCancel}
    >
      <div
        className="relative w-full max-w-[380px] rounded-2xl border border-gray-100 bg-white px-6 py-6 shadow-xl shadow-gray-200/60"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 p-1.5 rounded-lg text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          aria-label="关闭"
        >
          <X size={18} />
        </button>
        <header className="mb-4 border-b border-gray-100 pb-4 pr-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-600 flex items-center justify-center text-white font-bold shadow-md shadow-brand-600/20">
              O
            </div>
            <div>
              <h2 id="logout-confirm-title" className="text-lg font-semibold text-gray-800">
                退出登录
              </h2>
              <p className="text-sm text-gray-500">Offer 捕手</p>
            </div>
          </div>
        </header>
        <p className="text-sm text-gray-600 leading-relaxed mb-6">
          确定要退出当前账号吗？退出后需重新登录才能继续使用。
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            取消
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-brand-600 text-white py-2.5 text-sm font-medium hover:bg-brand-700"
          >
            <LogOut size={16} />
            确认退出
          </button>
        </div>
      </div>
    </div>
  );
}
