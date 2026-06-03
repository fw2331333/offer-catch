import { Navigate, useSearchParams } from "react-router-dom";

/** 兼容旧邮件中的 /verify-email 链接 */
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get("token");
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return <Navigate to={`/set-password?token=${encodeURIComponent(token)}`} replace />;
}
