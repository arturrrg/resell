import { useEffect, useState, useRef, type ComponentProps } from "react";
import { createPortal } from "react-dom";
import {
  Check,
  ArrowLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Link2,
  LoaderCircle,
  LockKeyhole,
  Plus,
  Pencil,
  UserRound,
  Trash2,
} from "lucide-react";
import { Sheet } from "../sheet";
import {
  marketplaceProfile,
  cachedMarketplaceProfile,
  rememberMarketplaceProfile,
  type MarketplaceProfile,
} from "./native";
import { marketplaceNickname, marketplaceAccountName } from "./marketplace-identity";
import { MarketplaceAvatar, loadMarketplaceAvatar } from "./marketplace-avatar";
import { selectionFeedback } from "./feedback";
import "./marketplace-connection.css";
import { useBackAction } from "../back-navigation";
function invoke(command: string, args: Record<string, unknown>) {
  return (window as any).__TAURI__.core.invoke(command, args);
}
function MarketplaceSurface({ embedded, ...props }: ComponentProps<typeof Sheet> & { embedded?: boolean }) {
  return embedded ? <>{props.children}</> : <Sheet {...props} />;
}
export function MarketplaceSignInSheet({
  owner,
  onClose,
  onSaved,
  required = false,
  embedded = false,
  pricing,
}: {
  owner: string;
  onClose: () => void;
  onSaved?: (accounts: { id: string; login: string }[]) => void;
  required?: boolean;
  embedded?: boolean;
  pricing?: { price: string; currency: string; accountPrices?: Record<string, string> };
}) {
  const [profile, setProfile] = useState<MarketplaceProfile | null>(
    () => cachedMarketplaceProfile(owner, true) || null,
  );
  const [selectedIds, setSelectedIds] = useState<string[]>(() => {
    const value = cachedMarketplaceProfile(owner, true);
    return value?.selectedId ? [value.selectedId] : [];
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [login, setLogin] = useState(""),
    [password, setPassword] = useState("");
  const [visible, setVisible] = useState(false),
    [working, setWorking] = useState(!cachedMarketplaceProfile(owner, true));
  const [error, setError] = useState(""),
    [forget, setForget] = useState<string | null>(null);
  const selecting = useRef(false);
  const backToAccounts = () => {
    setEditing(null);
    setPassword("");
    setError("");
  };
  useBackAction(
    editing !== null && !!profile?.accounts.length,
    backToAccounts,
    110,
  );
  async function selectAccount(id: string) {
    if (selecting.current || working || profile?.selectedId === id) return;
    selecting.current = true;
    setError("");
    const previous = profile!;
    const next = {
      ...previous,
      selectedId: id,
      login: previous.accounts.find((a) => a.id === id)!.login,
    };
    setProfile(next);
    rememberMarketplaceProfile(owner, next);
    try {
      await invoke("select_marketplace_login", { owner, id });
      rememberMarketplaceProfile(owner, {
        ...previous,
        selectedId: id,
        login: previous.accounts.find((a) => a.id === id)!.login,
      });
      selectionFeedback();
    } catch {
      setProfile(previous);
      rememberMarketplaceProfile(owner, previous);
      setError("Could not select this account. Try again.");
    } finally {
      selecting.current = false;
    }
  }
  useEffect(() => {
    let alive = true;
    void marketplaceProfile(owner)
      .then((value) => {
        if (!alive) return;
        setProfile(value);
        setSelectedIds(value.selectedId ? [value.selectedId] : []);
        if (value.available && !value.accounts.length) setEditing("");
      })
      .catch(() => {
        if (alive) setError("Could not open saved accounts. Try again.");
      })
      .finally(() => {
        if (alive) setWorking(false);
      });
    return () => {
      alive = false;
    };
  }, [owner]);
  const close = () => {
    setPassword("");
    onClose();
  };
  async function run(work: () => Promise<void>) {
    setWorking(true);
    setError("");
    try {
      await work();
      selectionFeedback();
    } catch {
      setError("Could not update this connection. Please try again.");
    } finally {
      setWorking(false);
    }
  }
  const edit = (id: string) => {
    setEditing(id);
    setLogin(profile?.accounts.find((item) => item.id === id)?.login || "");
    setPassword("");
    setVisible(false);
    setError("");
  };
  return (
    <>
      <MarketplaceSurface
        embedded={embedded}
        title="Marketplace accounts"
        hideTitle
        onClose={close}
        className="marketplace-sheet"
      >
        <div className="marketplace-connection">
          <div className="marketplace-topline">
            {editing !== null && !!profile?.accounts.length && (
              <button
                className="marketplace-account-back"
                aria-label="Back to accounts"
                disabled={working}
                onClick={backToAccounts}
              >
                <ArrowLeft />
              </button>
            )}
            <div className="marketplace-brand">
              999<span>.md</span>
            </div>
          </div>
          <h3>
            {editing === null
              ? "Accounts"
              : editing
                ? "Edit account"
                : "Add account"}
          </h3>
          <p>
            {required
              ? selectedIds.length > 1
                ? "Publishes on each account in order, then returns to this draft."
                : "Publishes on this account, then returns to Inventory."
              : "Saved securely on this device."}
          </p>
          {working && !profile ? (
            <div className="marketplace-loading">
              <LoaderCircle className="spinning" />
            </div>
          ) : profile?.available ? (
            editing === null ? (
              <>
                <div
                  className="marketplace-account-list"
                  aria-label="Saved marketplace accounts"
                >
                  {profile.accounts.map((account) => (
                    <div className="marketplace-account-row" key={account.id}>
                      <button
                        className="marketplace-account-select"
                        disabled={working}
                        aria-label={"Select " + account.login}
                        aria-pressed={
                          required
                            ? selectedIds.includes(account.id)
                            : profile.selectedId === account.id
                        }
                        onClick={() =>
                          required
                            ? setSelectedIds((ids) =>
                                ids.includes(account.id)
                                  ? ids.filter((id) => id !== account.id)
                                  : [...ids, account.id],
                              )
                            : void selectAccount(account.id)
                        }
                      >
                        <MarketplaceAvatar owner={owner} account={account} />
                        <span>
                          <strong title={account.login}>
                            {marketplaceAccountName(account)}
                          </strong>
                          <small>
                            {required && pricing ? (pricing.accountPrices?.[account.id]?.trim() || pricing.price) + " " + pricing.currency + " · " : ""}
                            {(
                              required
                                ? selectedIds.includes(account.id)
                                : profile.selectedId === account.id
                            )
                              ? "Selected"
                              : "Saved account"}
                          </small>
                        </span>
                        <span
                          className="marketplace-account-indicator"
                          aria-hidden="true"
                        >
                          {(required
                            ? selectedIds.includes(account.id)
                            : profile.selectedId === account.id) && (
                            <Check className="marketplace-account-check" />
                          )}
                        </span>
                      </button>
                      <button
                        className="marketplace-account-edit"
                        aria-label={"Edit " + account.login}
                        disabled={working}
                        onClick={() => edit(account.id)}
                      >
                        <Pencil />
                      </button>
                      <button
                        className="marketplace-account-delete"
                        aria-label={"Remove " + account.login}
                        disabled={working}
                        onClick={() => setForget(account.id)}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  ))}
                </div>
                <button
                  className="marketplace-add"
                  disabled={working || profile.accounts.length >= 20}
                  onClick={() => edit("")}
                >
                  <Plus />
                  <span>Add account</span>
                </button>
                {required && profile.saved && (
                  <button
                    className="studio-primary marketplace-continue"
                    disabled={working || !selectedIds.length}
                    onClick={() =>
                      onSaved?.(
                        selectedIds.flatMap((id) =>
                          profile.accounts.filter((a) => a.id === id),
                        ),
                      )
                    }
                  >
                    Publish on {selectedIds.length}{" "}
                    {selectedIds.length === 1 ? "account" : "accounts"}
                    <ChevronRight />
                  </button>
                )}
              </>
            ) : (
              <>
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (
                      profile.accounts.some(
                        (item) =>
                          item.id !== editing &&
                          item.login.toLowerCase() ===
                            login.trim().toLowerCase(),
                      )
                    ) {
                      setError("This login is already saved.");
                      return;
                    }
                    void run(async () => {
                      await invoke("save_marketplace_login", {
                        owner,
                        id: editing || null,
                        login,
                        password,
                      });
                      setPassword("");
                      const next = await marketplaceProfile(owner, true);
                      setProfile(next);
                      const savedAccount = next.accounts.find(a => a.login.toLowerCase() === login.trim().toLowerCase());
                      if (required)
                        setSelectedIds((ids) =>
                          [...new Set([...ids, next.selectedId])].filter(
                            Boolean,
                          ),
                        );
                      setEditing(null);
                      if (savedAccount && !savedAccount.username) {
                        await invoke("connect_marketplace_account", { owner, id: savedAccount.id });
                      }
                    });
                  }}
                >
                  <div className="marketplace-form-fields">
                    <label className="studio-field">
                      <span>Login or email</span>
                      <input
                        value={login}
                        onChange={(event) => setLogin(event.target.value)}
                        autoComplete="username"
                        autoCapitalize="none"
                        spellCheck={false}
                        maxLength={60}
                        required
                      />
                    </label>
                    <label className="studio-field marketplace-password">
                      <span>Password</span>
                      <input
                        type={visible ? "text" : "password"}
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        autoComplete="current-password"
                        maxLength={150}
                        required
                      />
                      <button
                        type="button"
                        aria-label={visible ? "Hide password" : "Show password"}
                        onClick={() => setVisible(!visible)}
                      >
                        {visible ? <EyeOff /> : <Eye />}
                      </button>
                    </label>
                  </div>
                  <button
                    className="studio-primary"
                    disabled={working || !login.trim() || !password}
                  >
                    {working && <LoaderCircle className="spinning" />}
                    {editing ? "Save changes" : "Save account"}
                  </button>
                </form>
                {editing && <button className="marketplace-verify" disabled={working} onClick={() => void run(async () => {
                  await invoke("connect_marketplace_account", { owner, id: editing });
                })}><UserRound /><span>{profile.accounts.find(a => a.id === editing)?.username ? "Refresh profile from 999.md" : "Sign in to verify profile"}</span><ChevronRight /></button>}
              </>
            )
          ) : (
            <p className="marketplace-unavailable">
              Account connections are available in the installed Resell mobile app.
            </p>
          )}
          {profile?.available && (
            <div className="marketplace-security">
              <LockKeyhole />
              <span>Encrypted on this device. Never synced.</span>
            </div>
          )}
          {error && (
            <p className="studio-notice" role="alert">
              {error}
            </p>
          )}
        </div>
      </MarketplaceSurface>
      {forget && (
        <Sheet
          title="Remove saved account?"
          className="marketplace-remove-sheet"
          onClose={() => setForget(null)}
        >
          <div className="studio-confirm">
            <p>
              Remove the saved sign-in for{" "}
              <strong>
                {marketplaceNickname(
                  profile?.accounts.find((a) => a.id === forget)?.login || "",
                )}
              </strong>
              ? Drafts stay saved.
            </p>
            <button
              className="studio-danger"
              disabled={working}
              onClick={() =>
                void run(async () => {
                  await invoke("forget_marketplace_login", {
                    owner,
                    id: forget,
                  });
                  const next = await marketplaceProfile(owner, true);
                  setProfile(next);
                  setSelectedIds((ids) =>
                    ids.filter((id) => next.accounts.some((a) => a.id === id)),
                  );
                  setForget(null);
                  setEditing(next.accounts.length ? null : "");
                  setLogin("");
                  setPassword("");
                })
              }
            >
              Remove account
            </button>
            <button disabled={working} onClick={() => setForget(null)}>
              Keep account
            </button>
          </div>
        </Sheet>
      )}
    </>
  );
}
export function MarketplaceConnection({
  owner,
  compact = false,
  onOpenChange,
  profileNickname,
  profileEmail,
  onProfilePhoto,
  open: controlledOpen,
  embeddedHost,
}: {
  owner: string;
  compact?: boolean;
  onOpenChange?: (open: boolean) => void;
  profileNickname?: string;
  profileEmail?: string;
  onProfilePhoto?: (url: string) => void;
  open?: boolean;
  embeddedHost?: HTMLElement | null;
}) {
  const [ownOpen, setOpen] = useState(false);
  const open = controlledOpen ?? ownOpen;
  const [profileRevision, setProfileRevision] = useState(0);
  useEffect(() => {
    let alive = true;
    void marketplaceProfile(owner)
      .then(async (profile) => {
        const matching = profile.accounts.find(
          (a) =>
            (a.username || !a.login.includes("@")) &&
            (a.login.toLocaleLowerCase() === profileEmail?.toLocaleLowerCase() ||
              marketplaceAccountName(a).toLocaleLowerCase() === profileNickname?.toLocaleLowerCase()),
        );
        const url = matching
          ? await loadMarketplaceAvatar(owner, matching.id, matching.username || matching.login)
          : "";
        if (alive) onProfilePhoto?.(url);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [owner, profileNickname, profileEmail, onProfilePhoto, profileRevision]);
  const change = (next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
    if (!next) setProfileRevision((value) => value + 1);
  };
  return (
    <>
      <button
        className="marketplace-settings-entry"
        aria-label="999.md accounts"
        onClick={() => change(true)}
      >
        <span className="marketplace-settings-icon">
          <Link2 />
        </span>
        <span>
          <strong>Marketplace accounts</strong>
          <small>999.md · Connections on this device</small>
        </span>
        <ChevronRight />
      </button>
      {open && (
        embeddedHost
          ? createPortal(<MarketplaceSignInSheet embedded owner={owner} onClose={() => change(false)} />, embeddedHost)
          : <MarketplaceSignInSheet owner={owner} onClose={() => change(false)} />
      )}
    </>
  );
}
