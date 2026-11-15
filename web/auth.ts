import type { SupabaseClient } from "@supabase/supabase-js";

export async function registerInventory(
  client: SupabaseClient,
  email: string,
  redirect: string,
) {
  const { data, error } = await client.auth.getSession();
  if (error) throw error;
  if (!data.session?.user.is_anonymous)
    throw Error("Your private session is not ready. Please try again.");
  // Upgrade this exact guest identity so inventory ownership never changes hands.
  // A password is chosen only after Supabase verifies the email address.
  const result = await client.auth.updateUser(
    { email: email.trim(), data: { resell_needs_password: true } },
    { emailRedirectTo: redirect },
  );
  if (result.error) throw result.error;
}

export async function finishPassword(client: SupabaseClient, password: string) {
  if (password.length < 8)
    throw Error("Use at least 8 characters for your password.");
  const { error } = await client.auth.updateUser({
    password,
    data: { resell_needs_password: false },
  });
  if (error) throw error;
}

export const SIGNUP_CODE_LENGTH = 8;
export function verificationMessage(error: unknown) {
  const value = error as { code?: string; message?: string; status?: number };
  if (
    value.code === "otp_expired" ||
    /expired|invalid.*token/i.test(value.message || "")
  )
    return "That code is incorrect or expired. Try again or request a new code.";
  if (value.status === 429 || /over_.*rate_limit/.test(value.code || ""))
    return "Please wait a moment before requesting another code.";
  return (
    value.message || "Verification could not be completed. Please try again."
  );
}
export async function verifySignupCode(
  client: SupabaseClient,
  email: string,
  value: string,
) {
  const token = value.replace(/\s/g, "");
  if (!new RegExp(`^\\d{${SIGNUP_CODE_LENGTH}}$`).test(token))
    throw Error(`Enter the ${SIGNUP_CODE_LENGTH}-digit code from your email.`);
  const { data, error } = await client.auth.verifyOtp({
    email: email.trim(),
    token,
    type: "email_change",
  });
  if (error) throw Error(verificationMessage(error));
  if (!data.session || data.session.user.is_anonymous) {
    const refreshed = await client.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    if (!refreshed.data.session || refreshed.data.session.user.is_anonymous)
      throw Error(
        "Your email is not verified yet. Please try the latest code.",
      );
  }
}
export async function resendSignupCode(client: SupabaseClient, email: string) {
  const { error } = await client.auth.resend({
    email: email.trim(),
    type: "email_change",
  });
  if (error) throw Error(verificationMessage(error));
}
