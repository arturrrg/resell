import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { getSupabase } from "./supabase";
import { finishPassword } from "./auth";
import "./public-inventory.css";
function AccountCallback() {
  const [ready, setReady] = useState(false), [done, setDone] = useState(false), [password, setPassword] = useState(""), [error, setError] = useState(""), [working, setWorking] = useState(false);
  useEffect(() => { let active = true; void getSupabase().then(async client => { const { data, error } = await client.auth.getSession(); if (!active) return; if (error || !data.session || data.session.user.is_anonymous) setError("This account link has expired. Request a new one in the Resell app."); else setReady(true); }).catch(() => { if (active) setError("Your account link couldn't be opened. Please try again."); }); return () => { active = false; }; }, []);
  return <main className="viewer-site viewer-entry"><div className="viewer-code-panel"><a href="/" className="viewer-wordmark">Resell<span>.</span></a><h1>{done ? "You're all set." : "Secure your account."}</h1><p>{done ? "Return to the Resell app and sign in." : ready ? "Choose a password for the Resell app." : error ? "Open the app to request a new link." : "Opening your secure account link…"}</p>{ready && !done && <form onSubmit={async event => { event.preventDefault(); setWorking(true); setError(""); try { await finishPassword(await getSupabase(), password); setPassword(""); history.replaceState(null, "", "/"); setDone(true); } catch (error) { setError((error as Error).message); } finally { setWorking(false); } }}><label className="viewer-code-field"><span className="viewer-sr-only">New password</span><input type="password" minLength={8} required autoComplete="new-password" placeholder="At least 8 characters" value={password} onChange={event => setPassword(event.target.value)} /><button aria-label="Save password" disabled={working}>→</button></label></form>}{error && <p className="viewer-error" role="alert">{error}</p>}</div></main>;
}
createRoot(document.getElementById("root")!).render(<AccountCallback />);
