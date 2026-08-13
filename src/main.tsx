import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CareCompanion } from "../app/CareCompanion";
import "../app/globals.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <CareCompanion />
  </StrictMode>,
);
