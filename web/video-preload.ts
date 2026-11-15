import { useEffect, useState } from "react";
// Bound background media work even when hundreds of records are saved.
let occupied = 0;
const waiting = new Set<() => void>();
export function useVideoWarmup(eligible: boolean) {
  const [allowed, setAllowed] = useState(false);
  useEffect(() => {
    if (!eligible) {
      setAllowed(false);
      return;
    }
    let held = false,
      disposed = false;
    const take = () => {
      if (!disposed && !held && occupied < 2) {
        occupied++;
        held = true;
        waiting.delete(take);
        setAllowed(true);
      }
    };
    waiting.add(take);
    take();
    return () => {
      disposed = true;
      waiting.delete(take);
      if (held) occupied--;
      setAllowed(false);
      for (const next of waiting) next();
    };
  }, [eligible]);
  return allowed && eligible;
}
