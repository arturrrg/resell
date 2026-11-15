import React from "react";
import { createRoot } from "react-dom/client";
import "../resell.css";
import { OfferLab } from "./offer-lab";
createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <OfferLab />
  </React.StrictMode>,
);
