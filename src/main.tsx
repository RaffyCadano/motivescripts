import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { DevEnvironmentBadge } from "@/components/DevEnvironmentBadge";
import "@/styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
    <DevEnvironmentBadge />
  </StrictMode>,
);
