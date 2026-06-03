import { useState } from "react";
import { Link } from "react-router-dom";
import { registerAccount } from "../api/auth";
import { clearToken } from "../api/client";
import AuthLayout, { AuthField, AuthInput, AuthLink, AuthSubmit } from "../components/AuthLayout";
import EmailVerifyModal from "../components/EmailVerifyModal";

type VerifyModalState = {
  email: string;
  message: string;
  emailSent: boolean;
  devVerifyUrl?: string | null;
};

export default function RegisterPage() {
  const [verifyModal, setVerifyModal] = useState<VerifyModalState | null>(null);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      clearToken();
      const res = await registerAccount({
        email: email.trim(),
        username: username.trim(),
      });
      setVerifyModal({
        email: res.email,
        message: res.message,
        emailSent: res.email_sent !== false,
        devVerifyUrl: res.dev_verify_url,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "注册失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <EmailVerifyModal
        open={verifyModal !== null}
        email={verifyModal?.email ?? ""}
        message={verifyModal?.message ?? ""}
        emailSent={verifyModal?.emailSent ?? true}
        devVerifyUrl={verifyModal?.devVerifyUrl}
        onClose={() => setVerifyModal(null)}
      />
      <AuthLayout
        title="创建账号"
        subtitle="一个邮箱仅可注册一个账号，验证邮件中将引导你设置密码"
        footer={
          <>
            已有账号？ <AuthLink to="/login">登录</AuthLink>
          </>
        }
      >
        <form onSubmit={submit} className="space-y-4">
          <AuthField label="邮箱">
            <AuthInput
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@school.edu"
              required
              autoComplete="email"
            />
          </AuthField>
          <AuthField label="昵称">
            <AuthInput
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="你的昵称"
              required
              autoComplete="username"
            />
          </AuthField>
          <p className="text-xs text-gray-500 -mt-2">
            注册后请在邮件链接中设置登录密码，无需在此填写密码。
          </p>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <AuthSubmit type="submit" disabled={loading}>
            {loading ? "提交中..." : "注册并发送验证邮件"}
          </AuthSubmit>
        </form>
      </AuthLayout>
    </>
  );
}
