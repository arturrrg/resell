import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { InventoryCodeEntry, PublicInventory } from "./public-inventory";
import { viewingCode } from "./sharing";
import { useLanguage, translate } from "./i18n";
function ViewerWebsite() {
  const language = useLanguage();
  useEffect(() => { document.title = translate("Resell — View inventory", language); }, [language]);
  const read = () => viewingCode(new URLSearchParams(location.hash.slice(1)).get("view") || "");
  const [code, setCode] = useState(read);
  useEffect(() => { const changed = () => setCode(read()); window.addEventListener("hashchange", changed); return () => window.removeEventListener("hashchange", changed); }, []);
  return code ? <PublicInventory code={code} /> : <InventoryCodeEntry />;
}
createRoot(document.getElementById("root")!).render(<ViewerWebsite />);
