import { useState } from "react";
import { forgotPassword } from "../api/auth";
import AuthLayout, { AuthField, AuthInput, AuthLink, AuthSubmit } from "../components/AuthLayout";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [devUrl, setDevUrl] = useState("");
  const [emailSent, setEmailSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");
    setDevUrl("");
    try {
      const res = await forgotPassword(email.trim());
      setSent(true);
      setMessage(res.message);
      setEmailSent(res.email_sent === true);
      if (res.dev_verify_url) setDevUrl(res.dev_verify_url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="忘记密码"
      subtitle="输入注册邮箱；未完成验证的账号也会收到「设置密码」邮件"
      footer={
        <>
          想起密码了？ <AuthLink to="/login">返回登录</AuthLink>
        </>
      }
    >
      {sent ? (
        <div className="space-y-4">
          <p
            className={`text-sm rounded-xl px-3 py-2 border ${
              emailSent
                ? "text-brand-800 bg-brand-50 border-brand-100"
                : "text-amber-900 bg-amber-50 border-amber-200"
            }`}
          >
            {message}
          </p>
          {emailSent ? (
            <p className="text-sm text-gray-600 leading-relaxed">
              请打开邮件中的链接设置密码。
            </p>
          ) : (
            <p className="text-sm text-gray-600 leading-relaxed">
              未找到该邮箱的已验证账号，或邮件未发出。请确认邮箱是否正确、是否已完成注册验证，或检查 SMTP 配置。
            </p>
          )}
          {devUrl && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
              <p className="text-xs font-medium text-amber-800 mb-1">开发环境 · 点击链接设置密码</p>
              <a href={devUrl} className="text-sm text-brand-600 break-all hover:underline">
                {devUrl}
              </a>
            </div>
          )}
          <button
            type="button"
            onClick={() => {
              setSent(false);
              setMessage("");
              setDevUrl("");
              setEmailSent(false);
            }}
            className="w-full text-sm text-gray-500 hover:text-brand-600"
          >
            使用其他邮箱重试
          </button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <AuthField label="注册邮箱">
            <AuthInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@example.com"
              required
              autoComplete="email"
            />
          </AuthField>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <AuthSubmit type="submit" disabled={loading}>
            {loading ? "发送中…" : "发送邮件"}
          </AuthSubmit>
        </form>
      )}
    </AuthLayout>
  );
}
