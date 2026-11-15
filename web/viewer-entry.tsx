import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { InventoryCodeEntry, PublicInventory } from "./public-inventory";
import { viewingCode } from "./sharing";
function ViewerWebsite() {
  const read = () => viewingCode(new URLSearchParams(location.hash.slice(1)).get("view") || "");
  const [code, setCode] = useState(read);
  useEffect(() => { document.title = "Resell — View inventory"; const changed = () => setCode(read()); window.addEventListener("hashchange", changed); return () => window.removeEventListener("hashchange", changed); }, []);
  return code ? <PublicInventory code={code} /> : <InventoryCodeEntry />;
}
createRoot(document.getElementById("root")!).render(<ViewerWebsite />);
