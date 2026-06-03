import { useEffect, useRef, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, setToken } from "../api/client";
import { resendVerification } from "../api/auth";
import EnvelopeLogin, { type EnvelopeLoginHandle } from "../components/EnvelopeLogin";

export default function LoginPage() {
  const nav = useNavigate();
  const location = useLocation();
  const routeState = (location.state as { email?: string; verified?: boolean } | null) ?? {};
  const envelopeRef = useRef<EnvelopeLoginHandle>(null);
  const [email, setEmail] = useState(routeState.email ?? "");
  const [password, setPassword] = useState("");
  const [infoMessage, setInfoMessage] = useState(
    routeState.verified ? "邮箱已验证成功，请登录" : ""
  );
  const [error, setError] = useState("");

  useEffect(() => {
    if (!routeState.verified) return;
    const timer = window.setTimeout(() => setInfoMessage(""), 4000);
    nav("/login", { replace: true, state: { email: routeState.email } });
    return () => window.clearTimeout(timer);
  }, [routeState.verified, routeState.email, nav]);
  const [needsVerify, setNeedsVerify] = useState(false);
  const [resendMsg, setResendMsg] = useState("");
  const [devVerifyUrl, setDevVerifyUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setNeedsVerify(false);
    setResendMsg("");
    setDevVerifyUrl("");
    try {
      const res = await api<{ access_token: string }>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      setToken(res.access_token);
      envelopeRef.current?.playExit();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "登录失败";
      setError(msg);
      setNeedsVerify(msg.includes("尚未验证"));
      setLoading(false);
    }
  };

  const resend = async () => {
    setResendLoading(true);
    setResendMsg("");
    setDevVerifyUrl("");
    try {
      const res = await resendVerification(email.trim());
      setResendMsg(res.message);
      if (res.dev_verify_url) setDevVerifyUrl(res.dev_verify_url);
    } catch (err) {
      setResendMsg(err instanceof Error ? err.message : "发送失败");
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <EnvelopeLogin
      ref={envelopeRef}
      email={email}
      password={password}
      infoMessage={infoMessage}
      error={error}
      needsVerify={needsVerify}
      resendMsg={resendMsg}
      devVerifyUrl={devVerifyUrl}
      resendLoading={resendLoading}
      onResendVerification={resend}
      loading={loading}
      onEmailChange={setEmail}
      onPasswordChange={setPassword}
      onSubmit={submit}
      onOpenComplete={() => nav("/", { replace: true })}
    />
  );
}
