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
  Utils.Dom.render(<Spa />, document.getElementById(targetElementId));
}

export { render };
