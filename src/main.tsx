import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "@/App";
import { DevEnvironmentBadge } from "@/components/DevEnvironmentBadge";
import "@/styles/global.css";

// The signed-in areas must not run inside another site's frame (clickjacking). GitHub Pages cannot send an
// X-Frame-Options or frame-ancestors header, so the app refuses to start when framed on those paths.
const framed = window.self !== window.top;
const signedInArea = /^\/(admin|client|team)(\/|$)/.test(window.location.pathname);

if (framed && signedInArea) {
  document.body.textContent = "This page can't be shown inside another site.";
} else {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
      <DevEnvironmentBadge />
    </StrictMode>,
  );
}
