import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { resendVerification } from "../api/auth";

type LocationState = {
  email?: string;
  devVerifyUrl?: string | null;
  message?: string;
  emailSent?: boolean;
};

/** 兼容旧链接；新流程在注册页弹窗提示验证 */
export default function RegisterPendingPage() {
  const nav = useNavigate();
  const location = useLocation();
  const state = (location.state as LocationState) || {};

  useEffect(() => {
    if (!state.email && !state.message) {
      nav("/register", { replace: true });
    }
  }, [state.email, state.message, nav]);
  const [email, setEmail] = useState(state.email ?? "");
  const [devUrl, setDevUrl] = useState(state.devVerifyUrl ?? "");
  const [banner] = useState(state.message ?? "");
  const [emailSent] = useState(state.emailSent !== false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const resend = async () => {
    if (!email.trim()) {
      setError("请输入邮箱");
      return;
    }
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const res = await resendVerification(email.trim());
      setMsg(res.message);
      if (res.dev_verify_url) setDevUrl(res.dev_verify_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发送失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-lg shadow-gray-200/50">
        <h1 className="text-xl font-semibold text-gray-800 mb-2">请验证你的邮箱</h1>
        {banner && (
          <p
            className={`text-sm mb-4 rounded-xl px-3 py-2 border ${
              emailSent
                ? "text-brand-800 bg-brand-50 border-brand-100"
                : "text-amber-900 bg-amber-50 border-amber-200"
            }`}
          >
            {banner}
          </p>
        )}
        <p className="text-sm text-gray-500 mb-6 leading-relaxed">
          {emailSent ? (
            <>
              我们已向 <span className="font-medium text-gray-700">{email || "你的邮箱"}</span>{" "}
              发送验证链接（请同时查看垃圾箱）。验证通过后即可登录。
            </>
          ) : (
            <>
              未能向 <span className="font-medium text-gray-700">{email || "你的邮箱"}</span>{" "}
              发出邮件，请检查 SMTP 或点击下方重发。
            </>
          )}
        </p>

        {msg && <p className="text-sm text-brand-700 bg-brand-50 border border-brand-100 rounded-xl px-3 py-2 mb-4">{msg}</p>}
        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2 mb-4">{error}</p>}

        {devUrl && (
          <div className="mb-6 p-4 rounded-xl bg-amber-50 border border-amber-200">
            <p className="text-xs font-medium text-amber-800 mb-2">开发环境 · 未配置 SMTP</p>
            <p className="text-xs text-amber-900/80 mb-2 break-all">点击下方链接完成验证：</p>
            <a
              href={devUrl}
              className="text-sm text-brand-600 font-medium break-all hover:underline"
            >
              {devUrl}
            </a>
          </div>
        )}

        <div className="space-y-3">
          <label className="text-sm text-gray-600">重新发送验证邮件</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-[15px] focus:outline-none focus:ring-2 focus:ring-brand-500"
            placeholder="注册时使用的邮箱"
          />
          <button
            type="button"
            onClick={resend}
            disabled={loading}
            className="w-full rounded-xl bg-brand-600 text-white py-2.5 font-medium hover:bg-brand-700 disabled:opacity-50"
          >
            {loading ? "发送中…" : "重发验证邮件"}
          </button>
        </div>

        <p className="mt-6 text-center text-sm text-gray-500">
          已验证？{" "}
          <Link to="/login" className="text-brand-600 font-medium hover:underline">
            去登录
          </Link>
        </p>
        <button
          type="button"
          onClick={() => nav("/register")}
          className="mt-3 w-full text-sm text-gray-400 hover:text-gray-600"
        >
          返回注册
        </button>
      </div>
    </div>
  );
}
