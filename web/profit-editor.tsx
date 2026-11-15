import { useEffect, useState } from "react";
import { TrendingUp, Check } from "lucide-react";
import { saveSaleDetails, type Device } from "./storage";
export function ProfitEditor({
  device,
  onSaved,
  onError,
}: {
  device: Device;
  onSaved: () => Promise<void>;
  onError: (message: string) => void;
}) {
  const [value, setValue] = useState(String(device.expectedProfit ?? "")),
    [saved, setSaved] = useState(false);
  useEffect(() => {
    setValue(String(device.expectedProfit ?? ""));
  }, [device.expectedProfit]);
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(false), 1600);
    return () => clearTimeout(timer);
  }, [saved]);
  async function save() {
    if (value === String(device.expectedProfit ?? "")) return;
    const amount = value.trim() === "" ? undefined : Number(value);
    if (amount !== undefined && (!Number.isFinite(amount) || amount < 0)) {
      onError("Enter a valid profit amount.");
      return;
    }
    try {
      await saveSaleDetails(
        device.id,
        device.saleStatus || "in_progress",
        amount,
      );
      await onSaved();
      setSaved(true);
    } catch (e) {
      onError((e as Error).message);
    }
  }
  return (
    <div
      className="profit-inline"
      title={saved ? "Profit saved" : "Private profit in MDL"}
    >
      <div className="profit-editor-icon">
        {saved ? <Check /> : <TrendingUp />}
      </div>
      <label htmlFor={`profit-${device.id}`}>
        <div>
          <input
            id={`profit-${device.id}`}
            type="number"
            min="0"
            step="0.01"
            inputMode="decimal"
            placeholder="Profit"
            aria-label="Private profit in MDL"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => void save()}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
          />
          <span>MDL</span>
        </div>
      </label>
    </div>
  );
}
