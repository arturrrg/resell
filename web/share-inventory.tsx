import { PublicInventory } from "./public-inventory";
import { useEffect, useState } from "react";
import { Share2, Copy, ScanLine } from "lucide-react";
import { getSupabase } from "./supabase";
import { Sheet } from "./sheet";
import { viewingCode, viewLink, formatViewingCode } from "./sharing";
import {
  cachedShareAsset,
  prepareShareAsset,
  invalidateShareAsset,
  shareAssetKey,
} from "./share-assets";
export function OpenInventory({ onBack }: { onBack?: () => void }) {
  const [value, setValue] = useState(""),
    [error, setError] = useState("");
  return (
    <div className="open-inventory">
      <ScanLine />
      <h2>Open an inventory</h2>
      <p>Enter a viewing code or open its QR link. No account needed.</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const code = viewingCode(value);
          if (!code) {
            setError("Enter a valid viewing code or link.");
            return;
          }
          window.location.hash = "view=" + code;
        }}
      >
        <label>
          Viewing code
          <input
            autoComplete="off"
            spellCheck={false}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Paste code or link"
            required
          />
        </label>
        <button className="account-primary">View inventory</button>
      </form>
      {error && <p role="alert">{error}</p>}
      {onBack && (
        <button className="text-action" onClick={onBack}>
          Back to sign in
        </button>
      )}
    </div>
  );
}
export function ShareInventory({
  ready,
  workspace,
  inline = false,
}: {
  ready: boolean;
  workspace: string;
  inline?: boolean;
}) {
  const origin =
    (import.meta as any).env.VITE_PUBLIC_APP_URL || window.location.origin;
  const assetKey = shareAssetKey(workspace, origin);
  const initial = cachedShareAsset(assetKey);
  const [open, setOpen] = useState(false),
    [code, setCode] = useState(initial?.code || ""),
    [qr, setQr] = useState(initial?.qr || ""),
    [error, setError] = useState(""),
    [working, setWorking] = useState(false),
    [copied, setCopied] = useState(false);
  async function renderQR(url: string) {
    const { toDataURL } = await import("qrcode");
    return toDataURL(url, {
      width: 320,
      margin: 2,
      errorCorrectionLevel: "M",
      color: { dark: "#000000", light: "#ffffff" },
    });
  }
  async function loadAsset(kind: "read" | "create") {
    return prepareShareAsset(
      assetKey,
      origin,
      async () => {
        const { data, error } = await (
          await getSupabase()
        ).rpc(
          kind === "read"
            ? "resell_existing_view_code"
            : "resell_share_inventory",
        );
        if (error) throw error;
        return data;
      },
      renderQR,
      kind,
    );
  }
  useEffect(() => {
    if (!ready) return;
    let active = true;
    // Loading an existing code does not create public viewing access.
    void import("qrcode").catch(() => {});
    void loadAsset("read")
      .then((asset) => {
        if (active && asset) {
          setCode(asset.code);
          setQr(asset.qr);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [assetKey, ready]);
  async function generate() {
    setWorking(true);
    setError("");
    try {
      const asset = await loadAsset("create");
      if (asset) {
        setCode(asset.code);
        setQr(asset.qr);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setWorking(false);
    }
  }
  return (
    <>
      <button
        className={inline ? "account-action account-share" : "tool-trigger"}
        aria-label="Share inventory"
        title="Share inventory"
        disabled={!ready}
        onClick={() => {
          setOpen(true);
          const asset = cachedShareAsset(assetKey);
          if (asset) {
            setCode(asset.code);
            setQr(asset.qr);
          } else {
            setCode("");
            setQr("");
            void generate();
          }
        }}
      >
        <Share2 />
        {inline && <span>Share inventory</span>}
      </button>
      {open && (
        <Sheet
          title="Share inventory"
          onClose={() => {
            setOpen(false);
            setCopied(false);
            setError("");
          }}
        >
          <p className="sheet-note">
            Anyone with this code can view available devices. Profit and sales
            history stay private. Viewers cannot edit.
          </p>
          {qr && (
            <img
              className="share-qr"
              src={qr}
              width="240"
              height="240"
              alt="Scan to view this inventory"
            />
          )}
          {code && (
            <>
              <code className="view-code">{formatViewingCode(code)}</code>
              <div className="share-actions">
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        formatViewingCode(code),
                      );
                      setCopied(true);
                    } catch {
                      setError("Select and copy the code above.");
                    }
                  }}
                >
                  <Copy />
                  Copy code
                </button>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(
                        viewLink(code, origin),
                      );
                      setCopied(true);
                    } catch {
                      setError(
                        "Clipboard unavailable. Copy the viewing code instead.",
                      );
                    }
                  }}
                >
                  Copy link
                </button>
              </div>
              {copied && (
                <p role="status" className="sheet-note">
                  Copied.
                </p>
              )}
              <button
                className="text-action danger"
                disabled={working}
                onClick={async () => {
                  setWorking(true);
                  try {
                    const { error } = await (
                      await getSupabase()
                    ).rpc("resell_revoke_view");
                    if (error) throw error;
                    invalidateShareAsset(assetKey);
                    setCode("");
                    setQr("");
                    setCopied(false);
                  } catch (e) {
                    setError((e as Error).message);
                  } finally {
                    setWorking(false);
                  }
                }}
              >
                Stop sharing
              </button>
            </>
          )}
          {!code && (
            <button
              className="account-primary"
              disabled={working}
              onClick={() => void generate()}
            >
              {working ? "Preparing…" : "Create viewing code"}
            </button>
          )}
          {error && (
            <p className="account-notice" role="alert">
              {error}
            </p>
          )}
        </Sheet>
      )}
    </>
  );
}
export function SharedInventory({ code }: { code: string }) {
  return <PublicInventory code={code} onExit={() => { history.replaceState(history.state, "", location.pathname + location.search); window.dispatchEvent(new HashChangeEvent("hashchange")); }} />;
}
