import { useEffect, useState } from "react";
import { Mail, ArrowLeft, LoaderCircle } from "lucide-react";
import { SIGNUP_CODE_LENGTH } from "./auth";
export function VerificationCode({
  email,
  onVerify,
  onResend,
  onBack,
  sentAt = Date.now(),
}: {
  email: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  sentAt?: number;
}) {
  const [code, setCode] = useState(""),
    [working, setWorking] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [nextSend, setNextSend] = useState(sentAt + 60000),
    [now, setNow] = useState(Date.now());
  const remaining = Math.max(0, Math.ceil((nextSend - now) / 1000));
  useEffect(() => {
    if (!remaining) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [nextSend, remaining > 0]);
  return (
    <div className="verification-card">
      <div className="verification-symbol">
        <Mail />
      </div>
      <div className="auth-heading">Check your email</div>
      <p className="account-note">
        Enter the {SIGNUP_CODE_LENGTH}-digit code sent to{" "}
        <strong>{email}</strong>.
      </p>
      <form
        className="account-form"
        onSubmit={async (event) => {
          event.preventDefault();
          if (working) return;
          setWorking(true);
          setError("");
          setNotice("");
          try {
            await onVerify(code);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setWorking(false);
          }
        }}
      >
        <label className="code-label">
          Verification code
          <input
            className="verification-input"
            aria-label="Verification code"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            type="text"
            pattern={`[0-9]{${SIGNUP_CODE_LENGTH}}`}
            maxLength={SIGNUP_CODE_LENGTH}
            minLength={SIGNUP_CODE_LENGTH}
            placeholder="00000000"
            value={code}
            onChange={(event) =>
              setCode(
                event.target.value
                  .replace(/\D/g, "")
                  .slice(0, SIGNUP_CODE_LENGTH),
              )
            }
            required
            spellCheck={false}
            disabled={working}
          />
        </label>
        <button
          className="account-primary"
          type="submit"
          disabled={working || code.length !== SIGNUP_CODE_LENGTH}
        >
          {working && <LoaderCircle className="spinning" />}Verify email
        </button>
      </form>
      {error && (
        <p className="account-notice" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="verification-notice" role="status">
          {notice}
        </p>
      )}
      <div className="verification-actions">
        <button
          disabled={working || remaining > 0}
          onClick={async () => {
            setWorking(true);
            setError("");
            setNotice("");
            try {
              await onResend();
              setNextSend(Date.now() + 60000);
              setNow(Date.now());
              setNotice("A new code is on its way. Use the latest email.");
              setCode("");
            } catch (e) {
              setError((e as Error).message);
            } finally {
              setWorking(false);
            }
          }}
        >
          {remaining ? `Resend code in ${remaining}s` : "Resend code"}
        </button>
        <button disabled={working} onClick={onBack}>
          <ArrowLeft />
          Change email
        </button>
      </div>
      <p className="verification-footnote">Codes expire after 10 minutes.</p>
    </div>
  );
}
