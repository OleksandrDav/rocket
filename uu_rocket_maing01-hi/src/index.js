import { Environment, Utils } from "uu5g05";
import Spa from "./core/spa.js";

// propagate app version into environment
Environment["appVersion"] = process.env.VERSION;

// consider app as progressive web app, but not on iOS (OIDC login doesn't work there)
if (!navigator.userAgent.match(/iPhone|iPad|iPod/)) {
  let link = document.createElement("link");
  link.rel = "manifest";
  link.href = "assets/manifest.json";
  document.head.appendChild(link);
}

function render(targetElementId) {
  const rootElement = document.getElementById(targetElementId);

  // SMART CHECK:
  // If the server sent us HTML, the rootElement will have children (the app content).
  // If we are just starting (or fallback), it might only contain the "Loading" spinner or be empty.
  
  // Note: We check specifically for meaningful content to avoid hydrating the "Loading" spinner 
  // if SSR failed but the static file was served.
  const hasServerContent = rootElement.hasChildNodes() && !rootElement.querySelector("#uuAppLoading");

  if (hasServerContent) {
    // 1. HYDRATE: Reuse existing HTML (No Flicker)
    console.log("[Client] Hydrating SSR content...");
    Utils.Dom.hydrate(<Spa />, rootElement);
  } else {
    // 2. RENDER: Build from scratch (Standard)
    console.log("[Client] Rendering from scratch...");
    Utils.Dom.render(<Spa />, rootElement);
  }
}

export { render };