import { Environment, Utils, DynamicLibraryComponent } from "uu5g05";
import Plus4U5 from "uu_plus4u5g02";
import Plus4U5App from "uu_plus4u5g02-app";
import Plus4U5Elements from "uu_plus4u5g02-elements";

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
  Utils.Dom.render(
    <Plus4U5.SpaProvider initialLanguageList={["en", "cs"]} skipAppWorkspaceProvider>
      <Plus4U5.RouteDataProvider>
        <Plus4U5App.Spa>
          <Plus4U5App.RouteController>
            <Plus4U5Elements.RouteContainer header="uuRocketMaing01 apiConsole">
              <DynamicLibraryComponent uu5Tag="UuConsoleCommandLine.ApiClient" loadStrategy="apiConsole" />
            </Plus4U5Elements.RouteContainer>
          </Plus4U5App.RouteController>
        </Plus4U5App.Spa>
      </Plus4U5.RouteDataProvider>
    </Plus4U5.SpaProvider>,
    document.getElementById(targetElementId),
  );
}

export { render };
