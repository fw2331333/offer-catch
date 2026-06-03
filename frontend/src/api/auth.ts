import { api } from "./client";

export type RegisterResponse = {
  message: string;
  email: string;
  email_sent?: boolean;
  dev_verify_url?: string | null;
};

export type InspectTokenResponse = {
  valid: boolean;
  purpose: string;
  email_masked: string;
};

export type CompleteTokenResponse = {
  message: string;
  email: string;
};

export async function registerAccount(body: {
  email: string;
  username: string;
}): Promise<RegisterResponse> {
  return api<RegisterResponse>("/api/v1/auth/register", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function resendVerification(email: string): Promise<{
  message: string;
  dev_verify_url?: string | null;
}> {
  return api("/api/v1/auth/resend-verification", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function forgotPassword(email: string): Promise<{
  message: string;
  email_sent?: boolean;
  dev_verify_url?: string | null;
}> {
  return api("/api/v1/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function inspectEmailToken(token: string): Promise<InspectTokenResponse> {
  return api<InspectTokenResponse>("/api/v1/auth/inspect-email-token", {
    method: "POST",
    body: JSON.stringify({ token }),
  });
}

export async function completeEmailToken(
  token: string,
  password: string
): Promise<CompleteTokenResponse> {
  return api<CompleteTokenResponse>("/api/v1/auth/complete-email-token", {
    method: "POST",
    body: JSON.stringify({ token, password }),
  });
}
