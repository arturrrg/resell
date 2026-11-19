import {
  useState,
  useRef,
  useEffect,
  type ReactNode,
} from "react";
import { UserRound, LogOut, LoaderCircle, MailCheck, X } from "lucide-react";
import type { useCloudSync } from "./cloud";
import { OpenInventory, ShareInventory } from "./share-inventory";
import { getSupabase } from "./supabase";
import { registerInventory, finishPassword } from "./auth";
import { Sheet } from "./sheet";
import { useBackAction } from "./back-navigation";
import "./account-settings.css";
import { includeExternalOffers, setIncludeExternalOffers } from "./offers/monitor-settings";
import { NavIcon } from "./nav-icon";
import { MarketplaceConnection } from "./offers/marketplace-connection";
import { marketplaceProfile } from "./offers/native";
import { LanguagePicker } from "./language-picker";
type CloudState = ReturnType<typeof useCloudSync>;
export function hasAccount(cloud: CloudState) {
  return !!cloud.session && !cloud.session.user.is_anonymous;
}
export function needsPassword(cloud: CloudState) {
  return (
    hasAccount(cloud) &&
    (!!cloud.session?.user.user_metadata.resell_needs_password ||
      cloud.recovering)
  );
}
function AuthForm({ cloud }: { cloud: CloudState }) {
  const [mode, setMode] = useState<"signup" | "signin" | "reset">("signup"),
    [email, setEmail] = useState(""),
    [password, setPassword] = useState(""),
    [working, setWorking] = useState(false),
    [notice, setNotice] = useState(""),
    [failed, setFailed] = useState(false);
  const settingPassword = needsPassword(cloud);
  useBackAction(
    !settingPassword && mode !== "signup",
    () => {
      setMode(mode === "reset" ? "signin" : "signup");
      setNotice("");
      setPassword("");
    },
    10,
  );
  const redirect =
    (import.meta as any).env.VITE_PUBLIC_APP_URL || window.location.origin;
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setWorking(true);
    setNotice("");
    setFailed(false);
    try {
      const client = await getSupabase();
      if (settingPassword) {
        await finishPassword(client, password);
        setPassword("");
        cloud.finishRecovery();
      } else if (mode === "signup") {
        await registerInventory(client, email, redirect);
        setNotice(
          "Open the verification link in your email, then choose a password.",
        );
      } else if (mode === "signin") {
        const { error } = await client.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
        setPassword("");
      } else {
        const { error } = await client.auth.resetPasswordForEmail(
          email.trim(),
          { redirectTo: redirect },
        );
        if (error) throw error;
        setNotice(
          "If an account exists for that address, you’ll receive a password reset link.",
        );
      }
    } catch (error) {
      setNotice((error as Error).message);
      setFailed(true);
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="auth-card">
      <div className="auth-symbol">
        <UserRound />
      </div>
      <div className="auth-heading">
        {settingPassword
          ? "Choose your password."
          : mode === "signup"
            ? "Create account"
            : mode === "reset"
              ? "Reset your password."
              : "Welcome back"}
      </div>
      <p className="account-note">
        {settingPassword
          ? "Use at least 8 characters to secure your account."
          : mode === "signup"
            ? "A private home for your inventory."
            : mode === "reset"
              ? "We’ll email you a secure link."
              : "Sign in to your private Resell inventory."}
      </p>
      <form className="account-form" onSubmit={(event) => void submit(event)}>
        {!settingPassword && (
          <label>
            Email
            <input
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </label>
        )}
        {(settingPassword || mode === "signin") && (
          <label>
            Password
            <input
              type="password"
              minLength={settingPassword ? 8 : 1}
              autoComplete={
                settingPassword ? "new-password" : "current-password"
              }
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
        )}
        <button
          className="account-primary"
          disabled={working || !cloud.ready}
          type="submit"
        >
          {working ? <LoaderCircle className="spinning" /> : null}
          {settingPassword
            ? "Save password"
            : mode === "signup"
              ? "Create account"
              : mode === "reset"
                ? "Send reset link"
                : "Sign in"}
        </button>
      </form>
      {notice && (
        <div
          className={failed ? "account-notice" : "auth-success"}
          role={failed ? "alert" : "status"}
        >
          {!failed && <MailCheck aria-hidden="true" />}
          <div>
            {!failed && <strong>Check your inbox</strong>}
            <p>{notice}</p>
          </div>
        </div>
      )}
      {cloud.error && (
        <p className="account-notice" role="alert">
          {cloud.error}
        </p>
      )}
      {!settingPassword && (
        <div className="auth-switch">
          <button
            onClick={() => {
              setMode(mode === "signup" ? "signin" : "signup");
              setNotice("");
              setPassword("");
            }}
          >
            {mode === "signup"
              ? "Already have an account? Sign in"
              : "Create a new account"}
          </button>
          {mode === "signin" && (
            <button
              onClick={() => {
                setMode("reset");
                setNotice("");
                setPassword("");
              }}
            >
              Forgot password?
            </button>
          )}
        </div>
      )}
    </div>
  );
}
export function AuthGate({ cloud }: { cloud: CloudState }) {
  const [viewing, setViewing] = useState(false);
  const gate = useRef<HTMLElement>(null);
  useEffect(() => {
    const shell = gate.current?.closest<HTMLElement>(".auth-shell");
    const viewport = window.visualViewport;
    if (!shell || !viewport) return;
    const resize = () => shell.style.setProperty("--auth-viewport-height", `${viewport.height}px`);
    resize();
    viewport.addEventListener("resize", resize);
    return () => {
      viewport.removeEventListener("resize", resize);
      shell.style.removeProperty("--auth-viewport-height");
    };
  }, []);
  useBackAction(viewing, () => setViewing(false), 10);
  return (
    <section className="auth-gate" ref={gate}>
      <div className="auth-left">
        {viewing ? (
          <OpenInventory onBack={() => setViewing(false)} />
        ) : (
          <AuthForm cloud={cloud} />
        )}
        {!viewing && (
          <button
            className="view-inventory-action"
            onClick={() => setViewing(true)}
          >
            View shared inventory
          </button>
        )}
      </div>
    </section>
  );
}
export function Account({
  cloud,
  onOpenChange,
  icon,
  monitorError,
  restoreMarketplace = false,
}: {
  cloud: CloudState;
  onOpenChange?: (open: boolean) => void;
  icon?: ReactNode;
  monitorError?: string;
  restoreMarketplace?: boolean;
}) {
  const monitorOwner = cloud.workspace || cloud.session?.user.id || "";
  useEffect(() => {
    if (cloud.ready && monitorOwner) void marketplaceProfile(monitorOwner).catch(() => {});
  }, [cloud.ready, monitorOwner]);
  const [showExternal, setShowExternal] = useState(() => includeExternalOffers(monitorOwner));
  useEffect(() => setShowExternal(includeExternalOffers(monitorOwner)), [monitorOwner]);
  const [open, setOpen] = useState(false),
    [marketplaceOpen, setMarketplaceOpen] = useState(false),
    [profilePhoto, setProfilePhoto] = useState(""),
    [working, setWorking] = useState(false),
    [notice, setNotice] = useState("");
  const [marketplaceHost, setMarketplaceHost] = useState<HTMLDivElement | null>(null);
  const root = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const change = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  };
  useEffect(() => {
    setOpen(false);
    setMarketplaceOpen(false);
    setProfilePhoto("");
    setNotice("");
  }, [cloud.session?.user.id]);
  useEffect(() => {
    if (restoreMarketplace) {
      setOpen(true);
      setMarketplaceOpen(true);
    }
  }, [restoreMarketplace]);
  if (!cloud.configured) return null;
  return (
    <div className="account-wrap" ref={root}>
      <button
        className="account-trigger"
        ref={trigger}
        aria-label="Account"
        aria-expanded={open}
        onClick={() => change(!open)}
      >
        {icon || <NavIcon name="account" selected={open} />}
      </button>
      {open && (
        <Sheet
          title={marketplaceOpen ? "Marketplace accounts" : hasAccount(cloud) ? "Account" : "Welcome to Resell"}
          hideTitle={marketplaceOpen}
          className={`account-settings-sheet${marketplaceOpen ? " marketplace-sheet" : ""}`}
          headerActions={!hasAccount(cloud) ? <LanguagePicker iconOnly /> : undefined}
          onClose={() => marketplaceOpen ? setMarketplaceOpen(false) : change(false)}
        >
          <div className="account-panel" style={{ display: marketplaceOpen ? "none" : undefined }}>
            {!hasAccount(cloud) ? (
              <>
                <AuthForm cloud={cloud} />

                {notice && (
                  <p className="account-notice" role="status">
                    {notice}
                  </p>
                )}
              </>
            ) : (
              <>
                <div className="account-profile">
                  <span className="account-avatar">
                    {profilePhoto ? (
                      <img
                        src={profilePhoto}
                        alt=""
                        width="58"
                        height="58"
                        referrerPolicy="no-referrer"
                        decoding="async"
                        onError={() => setProfilePhoto("")}
                      />
                    ) : (
                      (cloud.session?.user.email || "R")
                        .slice(0, 1)
                        .toUpperCase()
                    )}
                  </span>
                  <div>
                    <h3 translate={cloud.session?.user.user_metadata.full_name || cloud.session?.user.email ? "no" : "yes"}>
                      {cloud.session?.user.user_metadata.full_name ||
                        cloud.session?.user.email?.split("@")[0] ||
                        "Resell account"}
                    </h3>
                    <p translate="no">{cloud.session?.user.email}</p>
                  </div>
                </div>
                <h3 className="account-group-title">Workspace</h3>
                <div className="account-settings-group">
                  <ShareInventory
                    key={cloud.workspace}
                    workspace={cloud.workspace!}
                    ready={cloud.ready}
                    inline
                  />
                    <MarketplaceConnection
                      owner={cloud.workspace || cloud.session!.user.id}
                      compact
                      onOpenChange={setMarketplaceOpen}
                      open={marketplaceOpen}
                      embeddedHost={marketplaceHost}
                      profileNickname={cloud.session?.user.email?.split("@")[0]}
                      profileEmail={cloud.session?.user.email}
                      onProfilePhoto={setProfilePhoto}
                    />
                  <LanguagePicker workspace />
                </div>
                {(notice || cloud.error) && (
                  <p className="account-notice" role="status">
                    {notice || cloud.error}
                  </p>
                )}
                <div className="account-monitor-setting">
                  <div><strong>Include other 999.md offers</strong><p>Show public adverts created outside Resell, from connected accounts.</p></div>
                  <button type="button" role="switch" aria-label="Include offers created outside Resell" aria-checked={showExternal} onClick={() => {
                    try { setIncludeExternalOffers(monitorOwner, !showExternal); setShowExternal(!showExternal); } catch { setNotice("Could not save this setting."); }
                  }}><span /></button>
                </div>
                {monitorError && <p className="account-note" role="status">{monitorError}</p>}
                <button
                  className="account-action account-signout"
                  disabled={working}
                  onClick={async () => {
                    setWorking(true);
                    try {
                      const { error } = await (
                        await getSupabase()
                      ).auth.signOut({ scope: "local" });
                      if (error) throw error;
                    } catch (error) {
                      setNotice((error as Error).message);
                    } finally {
                      setWorking(false);
                    }
                  }}
                >
                  <LogOut />
                  Sign out
                </button>
              </>
            )}
          </div>
          <div ref={setMarketplaceHost} hidden={!marketplaceOpen} />
        </Sheet>
      )}
    </div>
  );
}
