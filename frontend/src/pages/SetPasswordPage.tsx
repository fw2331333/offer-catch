import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { completeEmailToken, inspectEmailToken } from "../api/auth";
import { clearToken } from "../api/client";

export default function SetPasswordPage() {
  const [params] = useSearchParams();
  const nav = useNavigate();
  const token = params.get("token")?.trim() ?? "";

  const [purpose, setPurpose] = useState<"verify_email" | "reset_password" | "">("");
  const [emailMasked, setEmailMasked] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "submitting" | "ok" | "error">(
    token ? "loading" : "error"
  );
  const [message, setMessage] = useState(token ? "" : "链接无效，缺少令牌");
  const [successEmail, setSuccessEmail] = useState("");

  useEffect(() => {
    clearToken();
  }, []);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await inspectEmailToken(token);
        if (cancelled) return;
        setPurpose(res.purpose as "verify_email" | "reset_password");
        setEmailMasked(res.email_masked);
        setStatus("ready");
      } catch (err) {
        if (cancelled) return;
        setStatus("error");
        setMessage(err instanceof Error ? err.message : "链接无效或已过期");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const isLocalhost =
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

  const title =
    purpose === "reset_password" ? "重置密码" : purpose === "verify_email" ? "设置密码并完成注册" : "设置密码";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setMessage("两次输入的密码不一致");
      return;
    }
    setStatus("submitting");
    setMessage("");
    try {
      const res = await completeEmailToken(token, password);
      setSuccessEmail(res.email);
      setStatus("ok");
      setMessage(res.message);
    } catch (err) {
      setStatus("ready");
      setMessage(err instanceof Error ? err.message : "设置失败");
    }
  };

  const goLogin = () => {
    clearToken();
    nav("/login", {
      replace: true,
      state: { email: successEmail, verified: true },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-gray-100 bg-white p-8 shadow-lg">
        {status === "loading" && (
          <div className="text-center">
            <div className="w-10 h-10 border-2 border-brand-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-600 text-sm">正在校验链接…</p>
          </div>
        )}

        {(status === "ready" || status === "submitting") && (
          <>
            <h1 className="text-xl font-semibold text-gray-800 mb-1">{title}</h1>
            {emailMasked && (
              <p className="text-sm text-gray-500 mb-4">
                账号：<span className="font-medium text-gray-700">{emailMasked}</span>
              </p>
            )}
            {isLocalhost && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-4">
                手机 QQ 打开 localhost 链接会失败，请用电脑浏览器，或将 APP_PUBLIC_URL 改为局域网 IP。
              </p>
            )}
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="text-sm text-gray-600">新密码</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="至少 6 位"
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="text-sm text-gray-600">确认密码</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500"
                  placeholder="再次输入"
                  minLength={6}
                  required
                  autoComplete="new-password"
                />
              </div>
              {message && <p className="text-sm text-red-600">{message}</p>}
              <button
                type="submit"
                disabled={status === "submitting"}
                className="w-full rounded-xl bg-brand-600 text-white py-2.5 font-medium hover:bg-brand-700 disabled:opacity-50"
              >
                {status === "submitting" ? "提交中…" : "确认设置密码"}
              </button>
            </form>
          </>
        )}

        {status === "ok" && (
          <div className="text-center">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center mx-auto mb-4 text-xl">
              ✓
            </div>
            <p className="text-gray-700 mb-4">{message}</p>
            <button
              type="button"
              onClick={goLogin}
              className="w-full rounded-xl bg-brand-600 text-white py-2.5 font-medium hover:bg-brand-700"
            >
              前往登录
            </button>
          </div>
        )}

        {status === "error" && (
          <div className="text-center">
            <p className="text-gray-700 mb-4">{message}</p>
            <div className="flex flex-col gap-2 text-sm">
              <Link to="/forgot-password" className="text-brand-600 hover:underline">
                忘记密码 / 重发邮件
              </Link>
              <Link to="/register" className="text-brand-600 hover:underline">
                注册新账号
              </Link>
              <Link to="/login" className="text-gray-500 hover:underline">
                返回登录
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
