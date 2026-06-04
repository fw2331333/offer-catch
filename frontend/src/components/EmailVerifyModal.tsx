import { useState } from "react";
import { Link } from "react-router-dom";
import { resendVerification } from "../api/auth";

type Props = {
  open: boolean;
  email: string;
  message: string;
  emailSent: boolean;
  devVerifyUrl?: string | null;
  onClose: () => void;
};

export default function EmailVerifyModal({
  open,
  email,
  message,
  emailSent,
  devVerifyUrl,
  onClose,
}: Props) {
  const [resendMsg, setResendMsg] = useState("");
  const [devUrl, setDevUrl] = useState(devVerifyUrl ?? "");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!open) return null;

  const resend = async () => {
    setLoading(true);
    setError("");
    setResendMsg("");
    try {
      const res = await resendVerification(email);
      setResendMsg(res.message);
      if (res.dev_verify_url) setDevUrl(res.dev_verify_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-verify-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl border border-gray-100">
        <h2 id="email-verify-title" className="text-lg font-semibold text-gray-800 mb-2">
          请验证邮箱
        </h2>
        <p
          className={`text-sm mb-4 rounded-xl px-3 py-2 border ${
            emailSent
              ? "text-brand-800 bg-brand-50 border-brand-100"
              : "text-amber-900 bg-amber-50 border-amber-200"
          }`}
        >
          {message}
        </p>
        <p className="text-sm text-gray-600 leading-relaxed mb-4">
          {emailSent ? (
            <>
              已向 <span className="font-medium text-gray-800">{email}</span> 发送验证邮件。
              请打开邮件中的链接，<strong>设置登录密码</strong>完成注册后再登录。
            </>
          ) : (
            <>
              未能向 <span className="font-medium text-gray-800">{email}</span> 发信，请检查 SMTP 或重试。
            </>
          )}
        </p>
        {/* <p className="text-xs text-gray-500 mb-4 leading-relaxed">
          手机 QQ 邮箱打开链接若提示 Invalid url，请把电脑 <code className="text-gray-700">.env</code>{" "}
          里的 <code className="text-gray-700">APP_PUBLIC_URL</code> 改成电脑局域网地址（如{" "}
          <code className="text-gray-700">http://192.168.1.100:8080</code>），重建 api 后重新注册发信。
        </p> */}

        {resendMsg && (
          <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 mb-3">
            {resendMsg}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        {devUrl && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs font-medium text-amber-800 mb-1">开发环境验证链接</p>
            <a href={devUrl} className="text-sm text-brand-600 break-all hover:underline">
              {devUrl}
            </a>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={resend}
            disabled={loading}
            className="w-full rounded-xl border border-brand-200 text-brand-700 py-2.5 text-sm font-medium hover:bg-brand-50 disabled:opacity-50"
          >
            {loading ? "发送中…" : "重发验证邮件"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl bg-brand-600 text-white py-2.5 font-medium hover:bg-brand-700"
          >
            我知道了
          </button>
          <Link
            to="/login"
            state={{ email }}
            className="w-full text-center text-sm text-gray-500 hover:text-brand-600 py-1"
            onClick={onClose}
          >
            已完成验证，去登录
          </Link>
        </div>
      </div>
    </div>
  );
}
