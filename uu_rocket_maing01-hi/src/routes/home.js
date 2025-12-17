import { Utils, createVisualComponent, useState, useMemo } from "uu5g05";
import { useSsrFetch } from "../hooks/useSsrFetch.js";

import RouteBar from "../core/route-bar.js";
import Config from "./config/config.js";
import Header from "../bricks/rocket/header.js";
import SearchControls from "../bricks/rocket/search-controls.js";
import RocketGrid from "../bricks/rocket/rocket-grid.js";

// Import our new decomposed components

const Css = {
  container: () =>
    Config.Css.css({
      maxWidth: 1200,
      margin: "0 auto",
      padding: "0px 16px 24px",
      fontFamily: "Arial, sans-serif",
      color: "#333",
    }),
  errorBox: () =>
    Config.Css.css({ textAlign: "center", padding: 40, background: "#fff5f5", color: "#c53030", borderRadius: 8 }),
  loading: () => Config.Css.css({ textAlign: "center", padding: 60, fontSize: 18, color: "#999" }),
};

let Home = createVisualComponent({
  uu5Tag: Config.TAG + "Home",

  render(props) {
    // 1. DATA: Fetching
    const { data, status, error } = useSsrFetch(
      "rocketList",
      "http://localhost:8080/uu-rocket-maing01/22222222222222222222222222222222/rocket/list",
    );

    // 2. STATE: Search
    const [searchTerm, setSearchTerm] = useState("");

    // 3. LOGIC (Fix: Calculate list inside, depend on 'data')
    const filteredList = useMemo(() => {
      // Safe extraction inside
      const itemList = Array.isArray(data?.itemList) ? data.itemList : [];
      const term = searchTerm.toLowerCase();

      return itemList.filter(
        (item) => item.name.toLowerCase().includes(term) || item.text.toLowerCase().includes(term),
      );
    }, [data, searchTerm]); // Dependency is now 'data' (stable from hook)

    const attrs = Utils.VisualComponent.getAttrs(props);

    // 4. RENDER
    return (
      <div {...attrs}>
        <RouteBar />

        <div className={Css.container()}>
          <Header />
          <SearchControls value={searchTerm} onChange={setSearchTerm} />

          {status === "pending" && <div className={Css.loading()}>🚀 Fueling up engines... (Loading)</div>}

          {status === "error" && (
            <div className={Css.errorBox()}>
              <strong>Mission Abort!</strong> <br />
              {error?.message ?? "Unknown error occurred."}
            </div>
          )}

          {status === "ready" && <RocketGrid items={filteredList} />}
        </div>
      </div>
    );
  },
});

export { Home };
export default Home;
