//@@viewOn:imports
import { Utils, createVisualComponent, useState } from "uu5g05";

import RouteBar from "../core/route-bar.js";
import Config from "./config/config.js";
import { useSsrFetch } from "../hooks/useSsrFetch.js";
//@@viewOff:imports

//@@viewOn:css
const Css = {
  // ... (Same CSS as before) ...
  h1: () => Config.Css.css({ fontSize: 48, lineHeight: "1em", color: "red" }),
  greeting: () => Config.Css.css({ fontSize: 24, margin: "20px 0", color: "blue" }),
  list: () => Config.Css.css({ marginTop: 16 }),
  item: () => Config.Css.css({ padding: "8px 0", borderBottom: "1px solid #eee" }),
  error: () => Config.Css.css({ marginTop: 12, color: "crimson" }),
};
//@@viewOff:css

let Home = createVisualComponent({
  uu5Tag: Config.TAG + "Home",

  render(props) {
    const [count, setCount] = useState(0);

    // ============================================================
    // THE SENIOR UPGRADE:
    // One line to handle Fetching, Caching, Hydration, and SSR Signal
    // ============================================================
    const { data, status, error } = useSsrFetch(
      "rocketList", // Unique Key for this data
      "http://localhost:8080/uu-rocket-maing01/22222222222222222222222222222222/rocket/list",
    );

    // Extract the specific list from the raw API response
    const itemList = Array.isArray(data?.itemList) ? data.itemList : [];

    const attrs = Utils.VisualComponent.getAttrs(props);

    return (
      <div {...attrs}>
        <RouteBar />

        <h1 className={Css.h1()}>My message to the World:</h1>
        <div className={Css.greeting()}>
          <b>Hello </b>
          <i>World!</i>
        </div>

        <div>
          <button onClick={() => setCount(count + 1)}>increment</button>
          <button onClick={() => setCount(count - 1)}>decrement</button>
          <p>Count: {count}</p>
        </div>

        <div className={Css.list()}>
          <h2>Rockets</h2>

          {/* Clean status checking */}
          {status === "pending" && <div>Loading…</div>}

          {status === "error" && (
            <div className={Css.error()}>Failed to load rockets: {error?.message ?? "Unknown error"}</div>
          )}

          {status === "ready" && (
            <div>
              {itemList.length === 0 ? (
                <div>No rockets found.</div>
              ) : (
                itemList.map((item) => (
                  <div key={item.id ?? item.oid} className={Css.item()}>
                    <div>
                      <b>{item.name}</b>
                    </div>
                    <div>{item.text}</div>
                    <div>id: {item.id}</div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    );
  },
});

export { Home };
export default Home;
